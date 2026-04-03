import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Alert from '../components/Alert';
import TabBar from '../components/TabBar';
import { api } from '../api';
import { useWebSocket } from '../useWebSocket';
import { useTheme } from '../ThemeContext';
import { usePushNotifications } from '../usePushNotifications';
import { shared as staticShared } from '../theme';

function buildTabs(unreviewedCount) {
  return [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'patients', label: 'Patients' },
    { key: 'flagged', label: unreviewedCount > 0 ? `Priority (${unreviewedCount})` : 'Priority' },
  ];
}

function formatDate(v) {
  if (!v) return '';
  return new Date(v).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SEVERITY_CONFIG = {
  critical: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'CRITICAL' },
  high:     { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', label: 'HIGH' },
  medium:   { bg: '#fefce8', text: '#a16207', border: '#fde68a', label: 'MEDIUM' },
  low:      { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'LOW' },
};

function SeverityBadge({ level }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const s = SEVERITY_CONFIG[level] || SEVERITY_CONFIG.low;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

function ReviewedTag({ isReviewed, reviewedAt }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!isReviewed) return null;
  return (
    <View style={styles.reviewedTag}>
      <Text style={styles.reviewedTagText}>✓ Reviewed {reviewedAt ? formatDate(reviewedAt) : ''}</Text>
    </View>
  );
}

const STAT_ICONS = { Patients: '👥', Flagged: '🚩', Critical: '🔴', Unreviewed: '🕐' };

function StatCard({ label, value, color }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.statCard, { borderTopColor: color, backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={{ fontSize: 18, marginBottom: 4 }}>{STAT_ICONS[label] || '📊'}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

// ─── Patient Detail ────────────────────────────────────────────────────────────
function PatientDetail({ patient, onBack, onSaved, doctorId }) {
  const { colors, shared } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [noteForm, setNoteForm] = useState({
    selectedChatId: null,
    notes: '',
    diagnosis: '',
    recommendation: '',
    message_to_patient: '',
  });
  const [historyForm, setHistoryForm] = useState({ condition: '', notes: '' });
  const [alert, setAlert] = useState({ message: '', type: 'error' });
  const [busy, setBusy] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  function resetNoteForm() {
    setNoteForm({ selectedChatId: null, notes: '', diagnosis: '', recommendation: '', message_to_patient: '' });
  }

  async function saveNote() {
    if (!noteForm.selectedChatId) return;
    const hasContent = noteForm.notes.trim() || noteForm.diagnosis.trim() || noteForm.recommendation.trim() || noteForm.message_to_patient.trim();
    if (!hasContent) return;
    setBusy(true);
    setAlert({ message: '' });
    try {
      const result = await api.addDoctorNote({
        chat_id: noteForm.selectedChatId,
        notes: noteForm.notes,
        diagnosis: noteForm.diagnosis || null,
        recommendation: noteForm.recommendation || null,
        message_to_patient: noteForm.message_to_patient || null,
      });
      resetNoteForm();
      if (result.interaction_warnings?.length > 0) {
        setAlert({
          message: `Note saved.\n\n${result.interaction_warnings.join('\n')}`,
          type: 'error',
        });
      } else {
        setAlert({ message: 'Note saved and patient notified.', type: 'success' });
      }
      onSaved();
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function saveHistory() {
    if (!historyForm.condition.trim()) return;
    setBusy(true);
    setAlert({ message: '' });
    try {
      await api.addMedicalHistory({ patient_id: patient.id, condition: historyForm.condition, notes: historyForm.notes || null });
      setHistoryForm({ condition: '', notes: '' });
      setAlert({ message: 'Medical history updated.', type: 'success' });
      onSaved();
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function markReviewed(chatId) {
    setReviewingId(chatId);
    try {
      await api.reviewChat(chatId);
      onSaved();
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    } finally {
      setReviewingId(null);
    }
  }

  const sortedChats = [...(patient.chats || [])].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity_level] ?? 3) - (order[b.severity_level] ?? 3);
  });

  const criticalCount = sortedChats.filter(c => c.severity_level === 'critical' && !c.is_reviewed).length;
  const highCount = sortedChats.filter(c => c.severity_level === 'high' && !c.is_reviewed).length;

  return (
    <View style={[shared.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.detailHeader, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailTitle}>{patient.user?.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {patient.patient_code && (
              <View style={styles.detailCodeBadge}>
                <Text style={styles.detailCodeText}>{patient.patient_code}</Text>
              </View>
            )}
            <Text style={styles.detailSub}>{patient.user?.email}</Text>
          </View>
        </View>
        {(criticalCount > 0 || highCount > 0) && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>⚠ Urgent</Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Alert message={alert.message} type={alert.type} />

        {/* Patient Info */}
        <View style={shared.card}>
          <Text style={shared.kicker}>Patient Profile</Text>
          <View style={styles.infoGrid}>
            {[
              ['Age', patient.age], ['Gender', patient.gender],
              ['Blood Group', patient.blood_group],
              ['Weight', patient.weight ? `${patient.weight} ${patient.weight_unit || ''}` : null],
              ['Allergies', patient.allergies], ['Phone', patient.phone_number],
            ].map(([label, val]) => val ? (
              <View key={label} style={styles.infoItem}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{val}</Text>
              </View>
            ) : null)}
          </View>
        </View>

        {/* Stats */}
        {(criticalCount > 0 || highCount > 0) && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertBannerText}>
              ⚠ {criticalCount > 0 ? `${criticalCount} critical` : ''}{criticalCount > 0 && highCount > 0 ? ', ' : ''}{highCount > 0 ? `${highCount} high-risk` : ''} chat{criticalCount + highCount > 1 ? 's' : ''} awaiting review
            </Text>
          </View>
        )}

        {/* Medical History */}
        <Text style={styles.sectionTitle}>Medical History</Text>
        {patient.medical_history?.length ? (
          patient.medical_history.map((item) => (
            <View key={item.id} style={shared.card}>
              <Text style={shared.cardTitle}>{item.condition}</Text>
              {item.notes ? <Text style={shared.muted}>{item.notes}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={[shared.muted, { marginBottom: 12 }]}>No history entries.</Text>
        )}

        {/* Add Medical History */}
        <View style={[shared.card, { borderStyle: 'dashed', borderColor: colors.primary }]}>
          <Text style={shared.kicker}>Update Medical Record</Text>
          <Text style={shared.label}>Condition</Text>
          <TextInput style={shared.input} value={historyForm.condition} onChangeText={(v) => setHistoryForm((f) => ({ ...f, condition: v }))} placeholder="e.g. Type 2 Diabetes" />
          <Text style={shared.label}>Notes (optional)</Text>
          <TextInput style={[shared.textarea, { height: 70 }]} value={historyForm.notes} onChangeText={(v) => setHistoryForm((f) => ({ ...f, notes: v }))} placeholder="Medication, monitoring details…" multiline />
          <TouchableOpacity style={[shared.secondaryBtn, busy && { opacity: 0.6 }]} onPress={saveHistory} disabled={busy}>
            <Text style={shared.secondaryBtnText}>{busy ? 'Saving…' : 'Add to Medical Record'}</Text>
          </TouchableOpacity>
        </View>

        {/* Chat History */}
        <Text style={styles.sectionTitle}>Chat History (sorted by priority)</Text>
        {sortedChats.length === 0 && <Text style={[shared.muted, { marginBottom: 12 }]}>No chats yet.</Text>}
        {sortedChats.map((chat) => {
          const sc = SEVERITY_CONFIG[chat.severity_level] || SEVERITY_CONFIG.low;
          const isSelected = noteForm.selectedChatId === chat.id;
          return (
            <View key={chat.id} style={[shared.card, { borderLeftWidth: 4, borderLeftColor: sc.text, backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Header */}
              <View style={styles.chatCardHeader}>
                <SeverityBadge level={chat.severity_level} />
                <Text style={shared.muted}>{formatDate(chat.created_at)}</Text>
              </View>

              <ReviewedTag isReviewed={chat.is_reviewed} reviewedAt={chat.reviewed_at} />

              {/* Patient Message */}
              <View style={styles.messageBox}>
                <Text style={styles.messageLabel}>Patient</Text>
                <Text style={styles.messageText}>{chat.message}</Text>
                {chat.symptoms ? <Text style={shared.muted}>Symptoms: {chat.symptoms}</Text> : null}
              </View>

              {/* AI Response */}
              <View style={styles.aiBox}>
                <Text style={styles.aiLabel}>AI Response</Text>
                <Text style={styles.aiText}>{chat.response}</Text>
              </View>

              {/* Risk reason */}
              {chat.risk_reason && (
                <View style={[styles.riskBox, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.riskText, { color: sc.text }]}>⚑ {chat.risk_reason}</Text>
                </View>
              )}

              {/* Existing Doctor Notes */}
              {chat.doctor_notes?.length > 0 && (
                <View style={styles.existingNotes}>
                  <Text style={styles.existingNotesLabel}>Doctor Notes</Text>
                  {chat.doctor_notes.map((n) => (
                    <View key={n.id} style={styles.existingNote}>
                      {n.diagnosis && <Text style={styles.noteFieldLabel}>Diagnosis: <Text style={styles.noteFieldValue}>{n.diagnosis}</Text></Text>}
                      <Text style={styles.noteFieldLabel}>Note: <Text style={styles.noteFieldValue}>{n.notes}</Text></Text>
                      {n.recommendation && <Text style={styles.noteFieldLabel}>Recommendation: <Text style={styles.noteFieldValue}>{n.recommendation}</Text></Text>}
                      {n.message_to_patient && (
                        <View style={styles.msgToPatient}>
                          <Text style={styles.msgToPatientLabel}>💬 Message sent to patient:</Text>
                          <Text style={styles.msgToPatientText}>{n.message_to_patient}</Text>
                        </View>
                      )}
                      {n.patient_reply && (
                        <View style={styles.patientReplyBox}>
                          <Text style={styles.patientReplyLabel}>↩ Patient replied · {n.patient_reply_at ? formatDate(n.patient_reply_at) : ''}</Text>
                          <Text style={styles.patientReplyText}>{n.patient_reply}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Action Buttons */}
              {chat.is_flagged && (
                <View style={styles.actionRow}>
                  {!chat.is_reviewed && (
                    <TouchableOpacity
                      style={styles.reviewBtn}
                      onPress={() => markReviewed(chat.id)}
                      disabled={reviewingId === chat.id}
                    >
                      {reviewingId === chat.id
                        ? <ActivityIndicator size="small" color={colors.success} />
                        : <Text style={styles.reviewBtnText}>✓ Mark Reviewed</Text>}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.replyBtn, isSelected && styles.replyBtnActive]}
                    onPress={() => setNoteForm((f) => ({ ...f, selectedChatId: isSelected ? null : chat.id, notes: '', diagnosis: '', recommendation: '', message_to_patient: '' }))}
                  >
                    <Text style={[styles.replyBtnText, isSelected && { color: '#fff' }]}>
                      {isSelected ? '✕ Cancel' : '✏ Add Note / Message'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Reply Form */}
              {isSelected && (
                <View style={styles.replyForm}>
                  <Text style={styles.replyFormTitle}>Doctor's Response to this Chat</Text>

                  <Text style={[shared.label, { color: colors.label }]}>Clinical Notes</Text>
                  <TextInput
                    style={[shared.textarea, { height: 80, color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    value={noteForm.notes}
                    onChangeText={(v) => setNoteForm((f) => ({ ...f, notes: v }))}
                    placeholder="Observations, concerns, follow-up actions…"
                    placeholderTextColor={colors.muted}
                    multiline
                  />

                  <Text style={[shared.label, { color: colors.label }]}>Diagnosis</Text>
                  <TextInput
                    style={[shared.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    value={noteForm.diagnosis}
                    onChangeText={(v) => setNoteForm((f) => ({ ...f, diagnosis: v }))}
                    placeholder="e.g. Viral fever, Stage 1 hypertension"
                    placeholderTextColor={colors.muted}
                  />

                  <Text style={[shared.label, { color: colors.label }]}>Recommendation</Text>
                  <TextInput
                    style={[shared.textarea, { height: 70, color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    value={noteForm.recommendation}
                    onChangeText={(v) => setNoteForm((f) => ({ ...f, recommendation: v }))}
                    placeholder="Prescribed medications, lifestyle changes…"
                    placeholderTextColor={colors.muted}
                    multiline
                  />

                  <Text style={[shared.label, { color: colors.primary }]}>💬 Message to Patient</Text>
                  <TextInput
                    style={[shared.textarea, { height: 80, color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.primary }]}
                    value={noteForm.message_to_patient}
                    onChangeText={(v) => setNoteForm((f) => ({ ...f, message_to_patient: v }))}
                    placeholder="Write a direct message the patient will see in their chat…"
                    placeholderTextColor={colors.muted}
                    multiline
                  />

                  <TouchableOpacity style={[shared.primaryBtn, busy && { opacity: 0.6 }]} onPress={saveNote} disabled={busy}>
                    <Text style={shared.primaryBtnText}>{busy ? 'Sending…' : 'Save & Send to Patient'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Main Doctor Screen ────────────────────────────────────────────────────────
export default function DoctorScreen({ user, onLogout }) {
  const { colors, shared, dark, toggle: toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  usePushNotifications(true);
  const [tab, setTab] = useState('dashboard');
  const [patients, setPatients] = useState([]);
  const [flaggedChats, setFlaggedChats] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [alert, setAlert] = useState({ message: '', type: 'error' });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPatient, setLoadingPatient] = useState(false);

  const unreviewedCount = flaggedChats.filter((c) => !c.is_reviewed).length;
  const criticalCount = flaggedChats.filter((c) => c.severity_level === 'critical' && !c.is_reviewed).length;
  const highCount = flaggedChats.filter((c) => c.severity_level === 'high' && !c.is_reviewed).length;

  const loadData = useCallback(async () => {
    try {
      const [pList, flagged] = await Promise.all([api.getPatients(), api.getFlaggedChats()]);
      setPatients(pList);
      setFlaggedChats(flagged);
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time: patient replies to a doctor note → update in-place
  useWebSocket((event) => {
    if (event.type === 'patient_reply') {
      setSelectedPatient((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chats: prev.chats?.map((chat) => ({
            ...chat,
            doctor_notes: chat.doctor_notes?.map((n) =>
              n.id === event.note_id
                ? { ...n, patient_reply: event.patient_reply, patient_reply_at: event.patient_reply_at }
                : n
            ),
          })),
        };
      });
      loadData();
    }
  });

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function openPatient(id) {
    setLoadingPatient(true);
    try {
      const p = await api.getPatient(id);
      setSelectedPatient(p);
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    } finally {
      setLoadingPatient(false);
    }
  }

  async function onSaved() {
    if (selectedPatient) {
      const p = await api.getPatient(selectedPatient.id);
      setSelectedPatient(p);
    }
    await loadData();
  }

  if (selectedPatient) {
    return <PatientDetail patient={selectedPatient} onBack={() => setSelectedPatient(null)} onSaved={onSaved} doctorId={user.id} />;
  }

  const priorityPatients = patients.filter((p) =>
    flaggedChats.some((c) => c.patient_id === p.id && !c.is_reviewed)
  );

  return (
    <View style={[shared.screen, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.topBar, { backgroundColor: colors.headerBg }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topName}>Dr. {user.name}</Text>
          <Text style={styles.topRole}>Secure Doctor Portal</Text>
        </View>
        <TouchableOpacity style={styles.themeBtn} onPress={toggleTheme}>
          <Text style={{ fontSize: 16 }}>{dark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Alert message={alert.message} type={alert.type} />
          {loadingPatient && <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />}

          {/* ── Dashboard Tab ── */}
          {tab === 'dashboard' && (
            <>
              {/* Welcome banner */}
              <View style={[styles.welcomeBanner, { backgroundColor: colors.primary }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.welcomeTitle}>Good day, Dr. {user.name.split(' ')[0]} 👋</Text>
                  <Text style={styles.welcomeSub}>
                    {unreviewedCount > 0
                      ? `${unreviewedCount} case${unreviewedCount > 1 ? 's' : ''} need your attention`
                      : 'All cases are up to date'}
                  </Text>
                </View>
                <Text style={{ fontSize: 40 }}>🩺</Text>
              </View>

              {/* Stats */}
              <Text style={[styles.sectionHeading, { color: colors.text }]}>Overview</Text>
              <View style={styles.statsRow}>
                <StatCard label="Patients" value={patients.length} color={colors.primary} />
                <StatCard label="Flagged" value={flaggedChats.length} color="#c2410c" />
                <StatCard label="Critical" value={criticalCount} color={colors.danger} />
                <StatCard label="Unreviewed" value={unreviewedCount} color="#a16207" />
              </View>

              {/* Priority Queue */}
              {unreviewedCount > 0 && (
                <>
                  <View style={styles.priorityHeader}>
                    <Text style={styles.priorityTitle}>⚠ Needs Immediate Attention</Text>
                    <View style={styles.priorityBadge}>
                      <Text style={styles.priorityBadgeText}>{unreviewedCount}</Text>
                    </View>
                  </View>
                  {flaggedChats
                    .filter((c) => !c.is_reviewed)
                    .sort((a, b) => {
                      const o = { critical: 0, high: 1, medium: 2, low: 3 };
                      return (o[a.severity_level] ?? 3) - (o[b.severity_level] ?? 3);
                    })
                    .map((chat) => {
                      const sc = SEVERITY_CONFIG[chat.severity_level] || SEVERITY_CONFIG.low;
                      return (
                        <TouchableOpacity
                          key={chat.id}
                          style={[shared.card, { borderLeftWidth: 4, borderLeftColor: sc.text, backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => openPatient(chat.patient_id)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.chatCardHeader}>
                            <SeverityBadge level={chat.severity_level} />
                            <Text style={[shared.muted, { fontSize: 11 }]}>{formatDate(chat.created_at)}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <View style={[styles.patientAvatar, { backgroundColor: sc.text }]}>
                              <Text style={styles.patientAvatarText}>{(chat.patient_name || '?')[0].toUpperCase()}</Text>
                            </View>
                            <View>
                              <Text style={styles.patientName}>{chat.patient_name}</Text>
                              {chat.patient_code && <Text style={styles.patientCodeTag}>{chat.patient_code}</Text>}
                            </View>
                          </View>
                          <Text style={styles.chatPreview} numberOfLines={2}>{chat.message}</Text>
                          {chat.risk_reason && (
                            <View style={[styles.riskPill, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                              <Text style={[styles.riskText, { color: sc.text }]}>⚑ {chat.risk_reason}</Text>
                            </View>
                          )}
                          <Text style={styles.tapHint}>Tap to open patient →</Text>
                        </TouchableOpacity>
                      );
                    })}
                </>
              )}

              {unreviewedCount === 0 && (
                <View style={styles.allClearBox}>
                  <Text style={{ fontSize: 48, marginBottom: 8 }}>✅</Text>
                  <Text style={styles.allClearText}>All flagged cases reviewed</Text>
                  <Text style={[shared.muted, { textAlign: 'center', marginTop: 4 }]}>Great work! No pending cases.</Text>
                </View>
              )}
            </>
          )}

          {/* ── Patients Tab ── */}
          {tab === 'patients' && (
            <>
              <View style={styles.tabHeader}>
                <Text style={[styles.sectionHeading, { color: colors.text, marginBottom: 0 }]}>All Patients</Text>
                <View style={[styles.countPill, { backgroundColor: colors.primary }]}>
                  <Text style={styles.countPillText}>{patients.length}</Text>
                </View>
              </View>
              {patients.length === 0 && (
                <View style={styles.emptyTab}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>👤</Text>
                  <Text style={[styles.emptyTabTitle, { color: colors.text }]}>No patients yet</Text>
                  <Text style={[shared.muted, { textAlign: 'center' }]}>Patients will appear here once they register.</Text>
                </View>
              )}
              {patients.map((p) => {
                const hasUnreviewed = flaggedChats.some((c) => c.patient_id === p.id && !c.is_reviewed);
                const hasCritical = flaggedChats.some((c) => c.patient_id === p.id && c.severity_level === 'critical' && !c.is_reviewed);
                const initials = (p.user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const accentColor = hasCritical ? colors.danger : hasUnreviewed ? '#c2410c' : colors.primary;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.patientCard, { backgroundColor: colors.card, borderColor: hasUnreviewed ? accentColor : colors.border }]}
                    onPress={() => openPatient(p.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.patientInitialCircle, { backgroundColor: accentColor }]}>
                      <Text style={styles.patientInitialText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={[shared.cardTitle, { marginBottom: 0 }]}>{p.user?.name}</Text>
                        {hasUnreviewed && (
                          <View style={[styles.urgentPill, { backgroundColor: accentColor }]}>
                            <Text style={styles.urgentPillText}>{hasCritical ? '🔴 Critical' : '⚠ Urgent'}</Text>
                          </View>
                        )}
                      </View>
                      {p.patient_code && (
                        <Text style={styles.patientCodeTag}>{p.patient_code}</Text>
                      )}
                      <Text style={shared.muted}>{p.user?.email}</Text>
                      <View style={shared.metaRow}>
                        {p.gender ? <Text style={[shared.metaTag, { backgroundColor: colors.bg }]}>⚧ {p.gender}</Text> : null}
                        {p.age ? <Text style={[shared.metaTag, { backgroundColor: colors.bg }]}>🎂 {p.age}y</Text> : null}
                        {p.blood_group ? <Text style={[shared.metaTag, { backgroundColor: colors.bg }]}>🩸 {p.blood_group}</Text> : null}
                      </View>
                    </View>
                    <Text style={{ fontSize: 20, color: colors.muted }}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* ── Priority / Flagged Tab ── */}
          {tab === 'flagged' && (
            <>
              <View style={styles.tabHeader}>
                <Text style={[styles.sectionHeading, { color: colors.text, marginBottom: 0 }]}>Flagged Chats</Text>
                <View style={[styles.countPill, { backgroundColor: colors.danger }]}>
                  <Text style={styles.countPillText}>{flaggedChats.length}</Text>
                </View>
              </View>
              {flaggedChats.length === 0 && (
                <View style={styles.emptyTab}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
                  <Text style={[styles.emptyTabTitle, { color: colors.text }]}>No flagged chats</Text>
                  <Text style={[shared.muted, { textAlign: 'center' }]}>All conversations are within normal range.</Text>
                </View>
              )}
              {[...flaggedChats]
                .sort((a, b) => {
                  if (a.is_reviewed !== b.is_reviewed) return a.is_reviewed ? 1 : -1;
                  const o = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (o[a.severity_level] ?? 3) - (o[b.severity_level] ?? 3);
                })
                .map((chat) => {
                  const sc = SEVERITY_CONFIG[chat.severity_level] || SEVERITY_CONFIG.low;
                  return (
                    <TouchableOpacity
                      key={chat.id}
                      style={[shared.card, { borderLeftWidth: 4, borderLeftColor: sc.text, backgroundColor: colors.card, borderColor: colors.border, opacity: chat.is_reviewed ? 0.65 : 1 }]}
                      onPress={() => openPatient(chat.patient_id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.chatCardHeader}>
                        <SeverityBadge level={chat.severity_level} />
                        {chat.is_reviewed
                          ? <View style={styles.reviewedChip}><Text style={styles.reviewedMini}>✓ Reviewed</Text></View>
                          : <View style={styles.pendingChip}><Text style={styles.unreviewedMini}>⏳ Pending</Text></View>}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <View style={[styles.patientAvatar, { backgroundColor: sc.text }]}>
                          <Text style={styles.patientAvatarText}>{(chat.patient_name || '?')[0].toUpperCase()}</Text>
                        </View>
                        <Text style={styles.patientName}>{chat.patient_name}</Text>
                      </View>
                      <Text style={styles.chatPreview} numberOfLines={2}>{chat.message}</Text>
                      {chat.risk_reason && (
                        <View style={[styles.riskPill, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                          <Text style={[styles.riskText, { color: sc.text }]}>⚑ {chat.risk_reason}</Text>
                        </View>
                      )}
                      <Text style={[shared.muted, { marginTop: 6, fontSize: 11 }]}>{formatDate(chat.created_at)}</Text>
                    </TouchableOpacity>
                  );
                })}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <TabBar tabs={buildTabs(unreviewedCount)} active={tab} onSelect={setTab} />
    </View>
  );
}

function makeStyles(colors) {
  const dark = colors.bg === '#0f172a';
  return StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, gap: 8 },
  themeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  topName: { fontSize: 17, fontWeight: '700', color: '#fff' },
  topRole: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 10, alignItems: 'center', borderTopWidth: 3, borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 2, textAlign: 'center' },
  priorityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  priorityTitle: { fontSize: 15, fontWeight: '700', color: colors.danger },
  badge: { alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  chatCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  patientName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  chatPreview: { fontSize: 13, color: colors.label, lineHeight: 18, marginBottom: 4 },
  riskBox: { borderRadius: 6, padding: 8, marginTop: 6 },
  riskText: { fontSize: 12, fontWeight: '600' },
  tapHint: { fontSize: 12, color: colors.primary, marginTop: 8, fontWeight: '500' },
  allClearBox: { alignItems: 'center', paddingVertical: 32, backgroundColor: dark ? '#14532d' : '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: dark ? '#166534' : '#bbf7d0', marginBottom: 12 },
  allClearIcon: { fontSize: 32, color: colors.success, marginBottom: 8 },
  allClearText: { fontSize: 15, fontWeight: '600', color: colors.success },
  patientRow: { flexDirection: 'row', alignItems: 'center' },
  urgentDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  urgentDotText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  reviewedMini: { fontSize: 12, color: colors.success, fontWeight: '600' },
  unreviewedMini: { fontSize: 12, color: '#c2410c', fontWeight: '600' },
  // Detail screen
  detailHeader: { backgroundColor: '#0f766e', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  detailTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  detailSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  urgentBadge: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  urgentBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  infoItem: { minWidth: '45%' },
  infoLabel: { fontSize: 11, color: colors.muted, textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  alertBanner: { backgroundColor: dark ? '#450a0a' : '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: dark ? '#7f1d1d' : '#fecaca' },
  alertBannerText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10, marginTop: 6 },
  messageBox: { backgroundColor: dark ? '#1e293b' : '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8 },
  messageLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginBottom: 4 },
  messageText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  aiBox: { backgroundColor: dark ? '#1e3a5f' : '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 8 },
  aiLabel: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', marginBottom: 4 },
  aiText: { fontSize: 13, color: colors.label, lineHeight: 18 },
  existingNotes: { backgroundColor: dark ? '#14532d' : '#f0fdf4', borderRadius: 8, padding: 10, marginTop: 6 },
  existingNotesLabel: { fontSize: 11, fontWeight: '700', color: dark ? '#86efac' : colors.success, textTransform: 'uppercase', marginBottom: 8 },
  existingNote: { marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: dark ? '#166534' : '#bbf7d0' },
  noteFieldLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  noteFieldValue: { fontWeight: '400', color: colors.text },
  msgToPatient: { backgroundColor: dark ? '#1e3a5f' : '#dbeafe', borderRadius: 6, padding: 8, marginTop: 6 },
  msgToPatientLabel: { fontSize: 11, fontWeight: '700', color: dark ? '#93c5fd' : colors.primary, marginBottom: 2 },
  msgToPatientText: { fontSize: 13, color: colors.text },
  reviewedTag: { backgroundColor: dark ? '#14532d' : '#dcfce7', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  reviewedTagText: { fontSize: 12, color: dark ? '#86efac' : colors.success, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  reviewBtn: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: colors.success, paddingVertical: 10, alignItems: 'center' },
  reviewBtnText: { color: colors.success, fontWeight: '700', fontSize: 13 },
  replyBtn: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, paddingVertical: 10, alignItems: 'center' },
  replyBtnActive: { backgroundColor: colors.primary },
  replyBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  replyForm: { marginTop: 12, backgroundColor: dark ? '#1e293b' : '#f8fafc', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border },
  replyFormTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  msgLabel: { color: colors.primary },
  patientReplyBox: { marginTop: 8, backgroundColor: dark ? '#0c2340' : '#f0f9ff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: dark ? '#075985' : '#bae6fd' },
  patientReplyLabel: { fontSize: 10, fontWeight: '700', color: dark ? '#7dd3fc' : '#0369a1', textTransform: 'uppercase', marginBottom: 4 },
  patientReplyText: { fontSize: 13, color: colors.text, lineHeight: 18 },

  // Enhanced dashboard
  welcomeBanner: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  welcomeTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  welcomeSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  sectionHeading: { fontSize: 16, fontWeight: '800', marginBottom: 14, letterSpacing: 0.3 },
  priorityBadge: { backgroundColor: colors.danger, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  priorityBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  riskPill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6, alignSelf: 'flex-start' },
  patientAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  patientAvatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Patient card
  tabHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  countPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  countPillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  patientInitialCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  patientInitialText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  urgentPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  urgentPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyTab: { alignItems: 'center', paddingVertical: 60 },
  emptyTabTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  reviewedChip: { backgroundColor: dark ? '#14532d' : '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pendingChip: { backgroundColor: dark ? '#431407' : '#ffedd5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  patientCodeTag: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 1, marginTop: 1 },
  detailCodeBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  detailCodeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  });
}
