import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import Alert from '../components/Alert';
import TabBar from '../components/TabBar';
import { api, API_BASE_URL } from '../api';
import { useWebSocket } from '../useWebSocket';
import { useTheme } from '../ThemeContext';
import { usePushNotifications } from '../usePushNotifications';

const TABS = [
  { key: 'chat', label: 'Chat' },
  { key: 'history', label: 'History' },
  { key: 'profile', label: 'Profile' },
];

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

function SeverityBadge({ level, flagged }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const s = SEVERITY_CONFIG[level] || SEVERITY_CONFIG.low;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>
        {s.label}{flagged ? ' • Flagged' : ''}
      </Text>
    </View>
  );
}

function DoctorNoteCard({ note, onReload }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function sendReply() {
    if (!replyText.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api.replyToNote(note.id, { reply: replyText.trim() });
      setReplyText('');
      setShowReply(false);
      await onReload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.doctorNoteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.doctorNoteHeader}>
        <Text style={styles.doctorNoteIcon}>🩺</Text>
        <Text style={styles.doctorNoteTitle}>Doctor's Response</Text>
        <Text style={styles.doctorNoteDate}>{formatDate(note.created_at)}</Text>
      </View>

      {note.diagnosis ? (
        <View style={styles.noteField}>
          <Text style={styles.noteFieldLabel}>Diagnosis</Text>
          <Text style={styles.noteFieldValue}>{note.diagnosis}</Text>
        </View>
      ) : null}

      <View style={styles.noteField}>
        <Text style={styles.noteFieldLabel}>Clinical Notes</Text>
        <Text style={styles.noteFieldValue}>{note.notes}</Text>
      </View>

      {note.recommendation ? (
        <View style={styles.noteField}>
          <Text style={styles.noteFieldLabel}>Recommendation</Text>
          <Text style={styles.noteFieldValue}>{note.recommendation}</Text>
        </View>
      ) : null}

      {note.message_to_patient ? (
        <View style={styles.msgToPatientBox}>
          <Text style={styles.msgToPatientLabel}>💬 Message from your doctor</Text>
          <Text style={styles.msgToPatientText}>{note.message_to_patient}</Text>
        </View>
      ) : null}

      {/* Patient's existing reply */}
      {note.patient_reply ? (
        <View style={styles.patientReplyBox}>
          <Text style={styles.patientReplyLabel}>You replied · {formatDate(note.patient_reply_at)}</Text>
          <Text style={styles.patientReplyText}>{note.patient_reply}</Text>
          <TouchableOpacity onPress={() => setShowReply(true)} style={styles.editReplyBtn}>
            <Text style={styles.editReplyBtnText}>Edit reply</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Reply button — only if doctor sent a message */}
      {note.message_to_patient && !note.patient_reply && !showReply ? (
        <TouchableOpacity style={styles.replyTriggerBtn} onPress={() => setShowReply(true)}>
          <Text style={styles.replyTriggerText}>↩ Reply to doctor</Text>
        </TouchableOpacity>
      ) : null}

      {/* Reply input */}
      {showReply ? (
        <View style={styles.replyInputBox}>
          {err ? <Text style={styles.replyErr}>{err}</Text> : null}
          <TextInput
            style={styles.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Type your reply to the doctor…"
            placeholderTextColor={colors.muted}
            multiline
            autoFocus
          />
          <View style={styles.replyActions}>
            <TouchableOpacity style={styles.cancelReplyBtn} onPress={() => { setShowReply(false); setReplyText(''); setErr(''); }}>
              <Text style={styles.cancelReplyText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendReplyBtn, (!replyText.trim() || busy) && { opacity: 0.5 }]}
              onPress={sendReply}
              disabled={!replyText.trim() || busy}
            >
              {busy
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.sendReplyText}>Send Reply</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ChatCard({ item, onReload }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sc = SEVERITY_CONFIG[item.severity_level] || SEVERITY_CONFIG.low;
  const hasDoctorNotes = item.doctor_notes?.length > 0;

  return (
    <View style={[styles.chatCard, { borderLeftColor: sc.text, backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header row */}
      <View style={styles.chatCardHeader}>
        <SeverityBadge level={item.severity_level} flagged={item.is_flagged} />
        <Text style={styles.chatTimestamp}>{formatDate(item.created_at)}</Text>
      </View>

      {/* Reviewed tag */}
      {item.is_reviewed && (
        <View style={styles.reviewedTag}>
          <Text style={styles.reviewedTagText}>✓ Reviewed by doctor {item.reviewed_at ? `· ${formatDate(item.reviewed_at)}` : ''}</Text>
        </View>
      )}

      {/* Patient message */}
      <View style={[styles.patientMsgBox, { backgroundColor: colors.bg }]}>
        <Text style={[styles.patientMsgLabel, { color: colors.muted }]}>You asked</Text>
        <Text style={styles.patientMsgText}>{item.message}</Text>
        {item.symptoms ? (
          <Text style={styles.symptomsText}>Symptoms: {item.symptoms}</Text>
        ) : null}
        {item.attachment_url ? (
          <Image
            source={{ uri: `${API_BASE_URL}${item.attachment_url}` }}
            style={styles.attachmentImg}
            resizeMode="cover"
          />
        ) : null}
      </View>

      {/* AI response */}
      <View style={styles.aiMsgBox}>
        <Text style={[styles.aiMsgLabel, { color: colors.primary }]}>AI Assistant</Text>
        {item.response === null
          ? <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>Thinking…</Text>
            </View>
          : <Text style={styles.aiMsgText}>{item.response}</Text>}
      </View>

      {/* Risk reason — only show if flagged */}
      {item.is_flagged && item.risk_reason ? (
        <View style={[styles.riskBox, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <Text style={[styles.riskText, { color: sc.text }]}>⚑ {item.risk_reason}</Text>
        </View>
      ) : null}

      {/* Doctor notes */}
      {hasDoctorNotes && (
        <View style={styles.doctorNotesSection}>
          {item.doctor_notes.map((note) => (
            <DoctorNoteCard key={note.id} note={note} onReload={onReload} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function PatientScreen({ user, onLogout }) {
  const { colors, shared, dark, toggle: toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  usePushNotifications(false);
  const [tab, setTab] = useState('chat');
  const [profile, setProfile] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [alert, setAlert] = useState({ message: '', type: 'error' });
  const [refreshing, setRefreshing] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('Mild');
  const [duration, setDuration] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searchBusy, setSearchBusy] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setAlert({ message: 'Photo library access is required to attach images.', type: 'error' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setAttachmentUri(result.assets[0].uri);
    }
  }

  // Real-time: doctor sends a note/message → update that chat immediately
  useWebSocket((event) => {
    if (event.type === 'doctor_note') {
      setChatHistory((prev) =>
        prev.map((chat) => {
          if (chat.id !== event.chat_id) return chat;
          const notes = chat.doctor_notes || [];
          const exists = notes.some((n) => n.id === event.note.id);
          return {
            ...chat,
            doctor_notes: exists
              ? notes.map((n) => (n.id === event.note.id ? event.note : n))
              : [...notes, event.note],
          };
        })
      );
    }
  });

  const loadData = useCallback(async () => {
    try {
      const [p, h, m] = await Promise.all([
        api.getMe(),
        api.getChatHistory(),
        api.getMedicalHistory(),
      ]);
      setProfile(p);
      setChatHistory(h);
      setMedicalHistory(m);
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleChat() {
    if (!message.trim()) return;
    const userMsg = message.trim();
    const userSymptoms = symptoms.trim();
    const localAttachmentUri = attachmentUri;

    // Build enriched message with symptom checker context
    const enrichedMsg = [
      userMsg,
      severity !== 'Mild' ? `Severity: ${severity}` : '',
      duration ? `Duration: ${duration}` : '',
    ].filter(Boolean).join(' | ');

    // Optimistic: show message immediately as a pending card
    const tempId = `pending-${Date.now()}`;
    setChatHistory((prev) => [
      {
        id: tempId,
        message: enrichedMsg,
        symptoms: userSymptoms || null,
        response: null, // null = still loading
        severity_level: 'low',
        is_flagged: false,
        is_reviewed: false,
        reviewed_at: null,
        risk_reason: null,
        attachment_url: localAttachmentUri ? 'pending' : null,
        doctor_notes: [],
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setMessage('');
    setSymptoms('');
    setAttachmentUri(null);
    setChatBusy(true);
    setAlert({ message: '' });

    try {
      let attachmentUrl = null;
      if (localAttachmentUri) {
        setUploading(true);
        const filename = localAttachmentUri.split('/').pop() || 'photo.jpg';
        const ext = filename.split('.').pop().toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const uploaded = await api.uploadFile(localAttachmentUri, filename, mimeType);
        attachmentUrl = uploaded.url;
        setUploading(false);
      }
      await api.sendChat({ message: enrichedMsg, symptoms: userSymptoms || null, attachment_url: attachmentUrl });
      setSeverity('Mild');
      setDuration('');
      await loadData();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e) {
      // Remove the temp card and restore the input on error
      setChatHistory((prev) => prev.filter((c) => c.id !== tempId));
      setMessage(userMsg);
      setSymptoms(userSymptoms);
      setAttachmentUri(localAttachmentUri);
      setAlert({ message: e.message, type: 'error' });
    } finally {
      setChatBusy(false);
      setUploading(false);
    }
  }

  // Count unread doctor messages
  const unreadDoctorMessages = chatHistory.reduce((count, item) => {
    return count + (item.doctor_notes?.filter(n => n.message_to_patient).length || 0);
  }, 0);

  return (
    <View style={[shared.screen, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.topBar, { backgroundColor: colors.headerBg }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topGreeting}>Welcome back 👋</Text>
          <Text style={styles.topName}>{user.name}</Text>
        </View>
        {unreadDoctorMessages > 0 && (
          <TouchableOpacity style={styles.notifBadge} onPress={() => setTab('chat')}>
            <Text style={styles.notifText}>💬 {unreadDoctorMessages} new</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.themeBtn} onPress={toggleTheme}>
          <Text style={styles.themeBtnText}>{dark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Alert message={alert.message} type={alert.type} />

          {/* ── Chat Tab ── */}
          {tab === 'chat' && (
            <>
              {/* Symptom Checker / Input card */}
              <View style={[styles.inputCard, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <View style={[styles.inputCardIcon, { backgroundColor: colors.primary }]}>
                    <Text style={{ fontSize: 16 }}>🩺</Text>
                  </View>
                  <View>
                    <Text style={[styles.inputCardTitle, { color: colors.text, marginBottom: 0 }]}>Symptom Checker</Text>
                    <Text style={[styles.inputCardSub, { color: colors.muted }]}>AI-powered medical assessment</Text>
                  </View>
                </View>

                <Text style={[shared.label, { color: colors.label }]}>What is your main symptom?</Text>
                <TextInput
                  style={[shared.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="e.g. chest pain, headache, fever…"
                  placeholderTextColor={colors.muted}
                />

                <Text style={[shared.label, { color: colors.label }]}>Additional symptoms <Text style={styles.optionalTag}>(optional)</Text></Text>
                <TextInput
                  style={[shared.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  value={symptoms}
                  onChangeText={setSymptoms}
                  placeholder="fever, cough, nausea…"
                  placeholderTextColor={colors.muted}
                />

                {/* Severity slider approximation — quick-select */}
                <Text style={[shared.label, { color: colors.label }]}>Severity</Text>
                <View style={styles.severityRow}>
                  {['Mild', 'Moderate', 'Severe'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.severityBtn,
                        { borderColor: severity === s
                            ? (s === 'Severe' ? '#dc2626' : s === 'Moderate' ? '#c2410c' : colors.primary)
                            : colors.border,
                          backgroundColor: severity === s
                            ? (s === 'Severe' ? '#fef2f2' : s === 'Moderate' ? '#fff7ed' : '#eff6ff')
                            : colors.card,
                        }]}
                      onPress={() => setSeverity(s)}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600',
                        color: severity === s
                          ? (s === 'Severe' ? '#dc2626' : s === 'Moderate' ? '#c2410c' : colors.primary)
                          : colors.muted }}>
                        {s === 'Mild' ? '😐' : s === 'Moderate' ? '😟' : '😰'} {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Duration */}
                <Text style={[shared.label, { color: colors.label }]}>Duration <Text style={styles.optionalTag}>(optional)</Text></Text>
                <View style={styles.durationRow}>
                  {['Today', '2–3 days', '1 week', '1+ month'].map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.durationBtn, { borderColor: duration === d ? colors.primary : colors.border, backgroundColor: duration === d ? colors.primary : colors.card }]}
                      onPress={() => setDuration(duration === d ? '' : d)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: duration === d ? '#fff' : colors.muted }}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Image attachment picker */}
                <TouchableOpacity
                  style={[styles.attachBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                  onPress={pickImage}
                >
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                    📎 {attachmentUri ? 'Change image' : 'Attach image'}
                  </Text>
                </TouchableOpacity>

                {attachmentUri ? (
                  <View style={styles.attachPreview}>
                    <Image source={{ uri: attachmentUri }} style={styles.attachPreviewImg} resizeMode="cover" />
                    <TouchableOpacity style={styles.attachRemoveBtn} onPress={() => setAttachmentUri(null)}>
                      <Text style={styles.attachRemoveText}>✕ Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: message.trim() ? colors.primary : colors.muted }, (!message.trim() || chatBusy || uploading) && styles.sendBtnDisabled]}
                  onPress={handleChat}
                  disabled={!message.trim() || chatBusy || uploading}
                >
                  {chatBusy || uploading
                    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.sendBtnText}>{uploading ? 'Uploading…' : 'Analysing…'}</Text>
                      </View>
                    : <Text style={styles.sendBtnText}>🔍 Get AI Assessment</Text>}
                </TouchableOpacity>
              </View>

              {/* Chat history */}
              {/* Search bar */}
              <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  value={searchQuery}
                  onChangeText={async (v) => {
                    setSearchQuery(v);
                    if (!v.trim()) { setSearchResults(null); return; }
                    setSearchBusy(true);
                    try {
                      const results = await api.searchChats(v.trim());
                      setSearchResults(results);
                    } catch { setSearchResults([]); }
                    finally { setSearchBusy(false); }
                  }}
                  placeholder="Search conversations…"
                  placeholderTextColor={colors.muted}
                  returnKeyType="search"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults(null); }}>
                    <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {searchBusy && <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />}

              {searchResults !== null ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
                  </Text>
                  {searchResults.length === 0 && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>🔍</Text>
                      <Text style={styles.emptyTitle}>No matches</Text>
                      <Text style={styles.emptyDesc}>Try a different keyword.</Text>
                    </View>
                  )}
                  {searchResults.map((item) => (
                    <ChatCard key={item.id} item={item} onReload={loadData} />
                  ))}
                </>
              ) : (
                <>
                  {chatHistory.length > 0 && (
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>Conversation History ({chatHistory.length})</Text>
                  )}
                  {chatHistory.length === 0 && !chatBusy && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>💬</Text>
                      <Text style={styles.emptyTitle}>No conversations yet</Text>
                      <Text style={styles.emptyDesc}>Describe your symptoms above and the AI will respond.</Text>
                    </View>
                  )}
                  {chatHistory.map((item) => (
                    <ChatCard key={item.id} item={item} onReload={loadData} />
                  ))}
                </>
              )}
            </>
          )}

          {/* ── History Tab ── */}
          {tab === 'history' && (
            <>
              <Text style={styles.sectionLabel}>Medical History</Text>
              {medicalHistory.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyTitle}>No records yet</Text>
                  <Text style={styles.emptyDesc}>Medical history added by your doctor will appear here.</Text>
                </View>
              )}
              {medicalHistory.map((item) => (
                <View key={item.id} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                  <View style={styles.historyCardLeft} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyCondition, { color: colors.text }]}>{item.condition}</Text>
                    {item.notes ? <Text style={[styles.historyNotes, { color: colors.label }]}>{item.notes}</Text> : null}
                    <Text style={[styles.historyDate, { color: colors.muted }]}>{formatDate(item.created_at)}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── Profile Tab ── */}
          {tab === 'profile' && (
            <>
              <Text style={styles.sectionLabel}>Your Profile</Text>
              {!profile ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <>
                  {/* Avatar card */}
                  <View style={[styles.avatarCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                    <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                      <Text style={styles.avatarInitial}>
                        {(profile.user?.name || user.name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.avatarName, { color: colors.text }]}>{profile.user?.name || user.name}</Text>
                    {profile.patient_code && (
                      <View style={[styles.patientCodeBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.patientCodeText}>{profile.patient_code}</Text>
                      </View>
                    )}
                    <Text style={[styles.avatarEmail, { color: colors.muted }]}>{profile.user?.email || user.email}</Text>
                  </View>

                  {/* Info grid */}
                  <View style={styles.infoGrid}>
                    {[
                      { label: 'Age', value: profile.age ? `${profile.age} yrs` : null, icon: '🎂' },
                      { label: 'Gender', value: profile.gender, icon: '👤' },
                      { label: 'Blood Group', value: profile.blood_group, icon: '🩸' },
                      { label: 'Weight', value: profile.weight ? `${profile.weight} ${profile.weight_unit || ''}` : null, icon: '⚖️' },
                      { label: 'Phone', value: profile.phone_number, icon: '📞' },
                      { label: 'Allergies', value: profile.allergies, icon: '⚠️' },
                    ].map(({ label, value, icon }) =>
                      value ? (
                        <View key={label} style={[styles.infoTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <Text style={styles.infoTileIcon}>{icon}</Text>
                          <Text style={styles.infoTileValue}>{value}</Text>
                          <Text style={styles.infoTileLabel}>{label}</Text>
                        </View>
                      ) : null
                    )}
                  </View>

                  {/* Stats */}
                  <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{chatHistory.length}</Text>
                      <Text style={styles.statLbl}>Chats</Text>
                    </View>
                    <View style={[styles.statBox, styles.statBoxMiddle]}>
                      <Text style={[styles.statNum, { color: '#c2410c' }]}>
                        {chatHistory.filter(c => c.is_flagged).length}
                      </Text>
                      <Text style={styles.statLbl}>Flagged</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={[styles.statNum, { color: colors.success }]}>
                        {medicalHistory.length}
                      </Text>
                      <Text style={styles.statLbl}>Records</Text>
                    </View>
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
    </View>
  );
}

function makeStyles(colors) {
  const dark = colors.bg === '#0f172a';
  return StyleSheet.create({
  // Header
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    gap: 10,
  },
  topGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  topName: { fontSize: 17, fontWeight: '700', color: '#fff' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  themeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  themeBtnText: { fontSize: 16 },
  notifBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  notifText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  scroll: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 4 },

  // Input card — bg set dynamically via inline style
  inputCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
  inputCardIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  inputCardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 14 },
  inputCardSub: { fontSize: 12, marginTop: 1 },
  optionalTag: { fontSize: 12, color: colors.muted, fontWeight: '400' },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Symptom checker
  severityRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  severityBtn: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  durationBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },

  // Severity badge
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Chat card — bg set dynamically
  chatCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  chatCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chatTimestamp: { fontSize: 11, color: colors.muted },

  reviewedTag: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  reviewedTagText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },

  patientMsgBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  patientMsgLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  patientMsgText: { fontSize: 14, color: colors.text, fontWeight: '500', lineHeight: 20 },
  symptomsText: { fontSize: 12, color: colors.muted, marginTop: 4 },

  aiMsgBox: {
    backgroundColor: dark ? '#1e3a5f' : '#eff6ff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  aiMsgLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  aiMsgText: { fontSize: 13, color: colors.label, lineHeight: 19 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  typingText: { fontSize: 13, color: colors.primary, fontStyle: 'italic' },

  riskBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 8,
  },
  riskText: { fontSize: 12, fontWeight: '600' },

  // Doctor notes section
  doctorNotesSection: { marginTop: 4 },
  doctorNoteCard: {
    backgroundColor: dark ? '#14532d' : '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: dark ? '#166534' : '#bbf7d0',
  },
  doctorNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  doctorNoteIcon: { fontSize: 16 },
  doctorNoteTitle: { fontSize: 13, fontWeight: '700', color: dark ? '#86efac' : '#15803d', flex: 1 },
  doctorNoteDate: { fontSize: 11, color: colors.muted },
  noteField: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: dark ? '#166534' : '#bbf7d0',
  },
  noteFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: dark ? '#86efac' : '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  noteFieldValue: { fontSize: 13, color: colors.text, lineHeight: 18 },

  msgToPatientBox: {
    backgroundColor: dark ? '#1e3a5f' : '#dbeafe',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: dark ? '#1d4ed8' : '#93c5fd',
  },
  msgToPatientLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: dark ? '#93c5fd' : colors.primary,
    marginBottom: 4,
  },
  msgToPatientText: { fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: '500' },

  // Patient reply
  replyTriggerBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: dark ? '#1e3a5f' : '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: dark ? '#1d4ed8' : '#bfdbfe',
  },
  replyTriggerText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  patientReplyBox: {
    marginTop: 10,
    backgroundColor: dark ? '#0c2340' : '#f0f9ff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: dark ? '#075985' : '#bae6fd',
  },
  patientReplyLabel: { fontSize: 10, fontWeight: '700', color: dark ? '#7dd3fc' : '#0369a1', textTransform: 'uppercase', marginBottom: 4 },
  patientReplyText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  editReplyBtn: { marginTop: 6, alignSelf: 'flex-start' },
  editReplyBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  replyInputBox: {
    marginTop: 10,
    backgroundColor: dark ? '#1e293b' : '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: dark ? '#1d4ed8' : '#93c5fd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: dark ? '#0f172a' : '#fff',
    marginBottom: 8,
  },
  replyActions: { flexDirection: 'row', gap: 8 },
  cancelReplyBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelReplyText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  sendReplyBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sendReplyText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  replyErr: { fontSize: 12, color: colors.danger, marginBottom: 6 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 18 },

  // History tab
  historyCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyCardLeft: { width: 4, backgroundColor: colors.primary },
  historyCondition: { fontSize: 14, fontWeight: '700', color: colors.text, padding: 12, paddingBottom: 4 },
  historyNotes: { fontSize: 13, color: colors.label, paddingHorizontal: 12, lineHeight: 18 },
  historyDate: { fontSize: 11, color: colors.muted, padding: 12, paddingTop: 6 },

  // Profile tab
  avatarCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitial: { fontSize: 30, fontWeight: '800', color: '#fff' },
  avatarName: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  patientCodeBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 6 },
  patientCodeText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  avatarEmail: { fontSize: 13, color: colors.muted },

  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  infoTile: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTileIcon: { fontSize: 20, marginBottom: 6 },
  infoTileValue: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  infoTileLabel: { fontSize: 11, color: colors.muted, textTransform: 'uppercase' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statBoxMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  statNum: { fontSize: 22, fontWeight: '800', color: colors.primary },
  statLbl: { fontSize: 11, color: colors.muted, marginTop: 2, textTransform: 'uppercase' },

  // Attachment
  attachBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  attachPreview: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  attachPreviewImg: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
  attachRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  attachRemoveText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  attachmentImg: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 8,
  },
  });
}
