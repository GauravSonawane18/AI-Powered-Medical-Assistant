"""
Email service using fastapi-mail with Gmail SMTP.
Sends password reset emails with a 6-digit OTP code.
"""
import logging
import secrets

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


def _get_mail_config() -> ConnectionConfig:
    s = get_settings()
    return ConnectionConfig(
        MAIL_USERNAME=s.smtp_user,
        MAIL_PASSWORD=s.smtp_password,
        MAIL_FROM=s.smtp_user,
        MAIL_FROM_NAME=s.email_from_name,
        MAIL_PORT=s.smtp_port,
        MAIL_SERVER=s.smtp_host,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


def generate_otp() -> str:
    """Generate a 6-digit numeric OTP."""
    return str(secrets.randbelow(900000) + 100000)


async def send_password_reset_email(to_email: str, user_name: str, otp: str) -> bool:
    """
    Send a password reset OTP email.
    Returns True on success, False on failure (so the caller can decide whether to surface the error).
    """
    settings = get_settings()

    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("SMTP credentials not configured — skipping email send.")
        return False

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; margin: 0; padding: 20px; }}
        .container {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
        .header {{ background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center; }}
        .header h1 {{ color: #ffffff; margin: 0; font-size: 24px; letter-spacing: -0.5px; }}
        .header p {{ color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px; }}
        .body {{ padding: 32px 24px; }}
        .greeting {{ font-size: 16px; color: #1e293b; margin-bottom: 16px; }}
        .otp-box {{ background: #f8fafc; border: 2px dashed #2563eb; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }}
        .otp-label {{ font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }}
        .otp-code {{ font-size: 42px; font-weight: 800; letter-spacing: 10px; color: #2563eb; font-family: monospace; }}
        .expiry {{ font-size: 13px; color: #64748b; text-align: center; margin-top: -8px; }}
        .warning {{ background: #fef9c3; border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 8px; margin-top: 24px; font-size: 13px; color: #713f12; }}
        .footer {{ background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🩺 MedAssist</h1>
          <p>Your trusted AI medical companion</p>
        </div>
        <div class="body">
          <p class="greeting">Hello <strong>{user_name}</strong>,</p>
          <p style="color:#475569;font-size:15px;">We received a request to reset your password. Use the OTP code below in the MedAssist app:</p>

          <div class="otp-box">
            <div class="otp-label">Your Reset Code</div>
            <div class="otp-code">{otp}</div>
          </div>
          <p class="expiry">⏰ This code expires in <strong>30 minutes</strong></p>

          <div class="warning">
            🔒 If you did not request a password reset, please ignore this email. Your account is safe.
          </div>
        </div>
        <div class="footer">
          &copy; 2026 MedAssist &nbsp;·&nbsp; AI-powered medical assistance<br>
          This is an automated email — please do not reply.
        </div>
      </div>
    </body>
    </html>
    """

    try:
        message = MessageSchema(
            subject="🔐 Your MedAssist Password Reset Code",
            recipients=[to_email],
            body=html_body,
            subtype=MessageType.html,
        )
        fm = FastMail(_get_mail_config())
        await fm.send_message(message)
        logger.info("Password reset email sent to %s", to_email)
        return True
    except Exception as exc:
        logger.error("Failed to send reset email to %s: %s", to_email, exc)
        return False
