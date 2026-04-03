"""
Lightweight startup migrations.
Adds columns that were introduced after initial table creation.
"""
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session


_MIGRATIONS = [
    ("doctor_notes", "patient_reply", "TEXT"),
    ("doctor_notes", "patient_reply_at", "TIMESTAMPTZ"),
    ("chats", "attachment_url", "VARCHAR(500)"),
    ("patients", "patient_code", "VARCHAR(20)"),
]


def _generate_code(existing_codes: set[str]) -> str:
    import random

    for _ in range(200):
        code = f"MDBT-{random.randint(1000, 9999)}"
        if code not in existing_codes:
            return code
    return f"MDBT-{random.randint(10000, 99999)}"


def _dialect_name(db: Session) -> str:
    bind = db.get_bind()
    if bind is None:
        raise RuntimeError("Database session is not bound to an engine.")
    return bind.dialect.name


def _table_columns(db: Session, table_name: str) -> set[str]:
    bind = db.get_bind()
    if bind is None:
        return set()
    if _dialect_name(db) == "postgresql":
        return {
            row[0]
            for row in db.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = :table_name
                    """
                ),
                {"table_name": table_name},
            ).fetchall()
        }
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if table_name not in tables:
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _adapt_column_type(db: Session, column_type: str) -> str:
    if _dialect_name(db) == "sqlite" and column_type == "TIMESTAMPTZ":
        return "TIMESTAMP"
    return column_type


def _add_column_if_missing(db: Session, table_name: str, column_name: str, column_type: str) -> None:
    if _dialect_name(db) == "postgresql":
        adapted_type = _adapt_column_type(db, column_type)
        db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {adapted_type}"))
        return

    columns = _table_columns(db, table_name)
    if not columns or column_name in columns:
        return

    adapted_type = _adapt_column_type(db, column_type)
    db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {adapted_type}"))


def _ensure_unique_index(db: Session, table_name: str, column_name: str, index_name: str) -> None:
    if _dialect_name(db) == "postgresql":
        db.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} ON {table_name} ({column_name})"))
        return

    columns = _table_columns(db, table_name)
    if not columns or column_name not in columns:
        return
    db.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} ON {table_name} ({column_name})"))


def _postgres_constraint_exists(db: Session, constraint_name: str) -> bool:
    if _dialect_name(db) != "postgresql":
        return False
    row = db.execute(
        text("SELECT 1 FROM pg_constraint WHERE conname = :constraint_name LIMIT 1"),
        {"constraint_name": constraint_name},
    ).first()
    return row is not None


def _ensure_postgres_constraint(db: Session, constraint_name: str, ddl: str) -> None:
    if _dialect_name(db) != "postgresql":
        return
    if not _postgres_constraint_exists(db, constraint_name):
        db.execute(text(ddl))


def _ensure_postgres_user_links(db: Session) -> None:
    if _dialect_name(db) != "postgresql":
        return

    patient_columns = _table_columns(db, "patients")
    if not patient_columns or "patient_code" not in patient_columns:
        return

    _add_column_if_missing(db, "patients", "user_id", "INTEGER")
    db.execute(
        text(
            """
            UPDATE patients AS p
            SET user_id = u.id
            FROM users AS u
            WHERE p.user_id IS NULL
              AND u.role = 'patient'
              AND u.created_at = p.created_at
            """
        )
    )

    unmapped_patients = db.execute(text("SELECT COUNT(*) FROM patients WHERE user_id IS NULL")).scalar_one()
    if unmapped_patients:
        raise RuntimeError(
            f"Could not map {unmapped_patients} patient rows to users. "
            "Manual cleanup is required before startup can continue."
        )

    db.execute(text("ALTER TABLE patients ALTER COLUMN user_id SET NOT NULL"))
    _ensure_unique_index(db, "patients", "user_id", "uq_patients_user_id")
    _ensure_postgres_constraint(
        db,
        "fk_patients_user_id",
        "ALTER TABLE patients ADD CONSTRAINT fk_patients_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
    )


def _ensure_supported_patient_schema(db: Session) -> None:
    patient_columns = _table_columns(db, "patients")
    if not patient_columns:
        return
    required = {"patient_code", "user_id"}
    if required.issubset(patient_columns):
        return

    raise RuntimeError(
        "Patients table is missing required columns. The current app expects patients.patient_code "
        "as the primary key and patients.user_id as the link to users."
    )


def run_migrations(db: Session) -> None:
    for table_name, column_name, column_type in _MIGRATIONS:
        _add_column_if_missing(db, table_name, column_name, column_type)
    _ensure_unique_index(db, "patients", "patient_code", "uq_patients_patient_code")
    _ensure_postgres_user_links(db)
    db.commit()

    _ensure_supported_patient_schema(db)

    patient_columns = _table_columns(db, "patients")
    if "patient_code" not in patient_columns:
        return

    rows = db.execute(text("SELECT created_at, patient_code FROM patients WHERE patient_code IS NULL")).fetchall()
    if rows:
        existing = {
            row[0]
            for row in db.execute(text("SELECT patient_code FROM patients WHERE patient_code IS NOT NULL")).fetchall()
            if row[0]
        }
        for created_at, _ in rows:
            code = _generate_code(existing)
            existing.add(code)
            db.execute(
                text("UPDATE patients SET patient_code = :code WHERE created_at = :created_at"),
                {"code": code, "created_at": created_at},
            )
        db.commit()
