import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const typeStyles = {
  error: { bg: '#fef2f2', text: colors.danger, border: '#fecaca' },
  info: { bg: '#eff6ff', text: colors.info, border: '#bfdbfe' },
  success: { bg: '#f0fdf4', text: colors.success, border: '#bbf7d0' },
};

export default function Alert({ message, type = 'error' }) {
  if (!message) return null;
  const s = typeStyles[type] || typeStyles.error;
  return (
    <View style={[styles.box, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.text, { color: s.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  text: { fontSize: 14, fontWeight: '500' },
});
