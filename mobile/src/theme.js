import { StyleSheet } from 'react-native';

export const lightColors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  danger: '#dc2626',
  success: '#16a34a',
  info: '#0284c7',
  bg: '#f1f5f9',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  muted: '#64748b',
  label: '#475569',
  flagged: '#fef2f2',
  inputBg: '#ffffff',
  headerBg: '#2563eb',
};

export const darkColors = {
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  danger: '#ef4444',
  success: '#22c55e',
  info: '#38bdf8',
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  label: '#cbd5e1',
  flagged: '#450a0a',
  inputBg: '#1e293b',
  headerBg: '#1e3a5f',
};

// Default export (light) — used by components that haven't migrated to context yet
export const colors = lightColors;

export function makeShared(c) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 },
    kicker: { fontSize: 11, fontWeight: '600', color: c.primary, textTransform: 'uppercase', marginBottom: 4 },
    label: { fontSize: 13, fontWeight: '600', color: c.label, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.inputBg,
      marginBottom: 12,
    },
    textarea: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.inputBg,
      marginBottom: 12,
      textAlignVertical: 'top',
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 4,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    secondaryBtn: {
      backgroundColor: c.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.primary,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 4,
    },
    secondaryBtnText: { color: c.primary, fontWeight: '700', fontSize: 15 },
    muted: { fontSize: 13, color: c.muted },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    metaTag: {
      backgroundColor: c.bg,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontSize: 12,
      color: c.muted,
    },
    sectionHeader: { fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 12 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 12 },
  });
}

// Static light shared — kept for backward compat with components not yet on context
export const shared = makeShared(lightColors);
