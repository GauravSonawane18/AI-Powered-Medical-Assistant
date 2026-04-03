import React, { Component, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { clearSession, loadSession } from './src/storage';
import { api, setUnauthorizedHandler } from './src/api';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import AuthScreen from './src/screens/AuthScreen';
import PatientScreen from './src/screens/PatientScreen';
import DoctorScreen from './src/screens/DoctorScreen';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.center}>
          <Text style={styles.errTitle}>Something went wrong</Text>
          <Text style={styles.errMsg}>{this.state.error.message}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const { dark, colors } = useTheme();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    loadSession().then(({ token: t, user: u }) => {
      if (t && u) { setToken(t); setUser(u); }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.healthCheck()
      .then(() => { if (!cancelled) setServerStatus('ok'); })
      .catch(() => { if (!cancelled) setServerStatus('unreachable'); });
    return () => { cancelled = true; };
  }, []);

  async function handleLogout() {
    await clearSession();
    setToken(null);
    setUser(null);
  }

  useEffect(() => { setUnauthorizedHandler(handleLogout); }, []);

  if (loading || serverStatus === 'checking') {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.checkingText, { color: colors.muted }]}>
          {loading ? 'Loading…' : 'Connecting to server…'}
        </Text>
      </View>
    );
  }

  if (serverStatus === 'unreachable') {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errTitle, { color: colors.text }]}>Server unreachable</Text>
        <Text style={[styles.errMsg, { color: colors.muted }]}>
          Make sure FastAPI is running and the IP in src/api.js is correct.
        </Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => setServerStatus('checking')}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isDoctor = user && ['doctor', 'admin'].includes(user.role);

  return (
    <>
      <StatusBar style={dark ? 'light' : 'light'} />
      {!token || !user ? (
        <AuthScreen onLogin={(t, u) => { setToken(t); setUser(u); }} />
      ) : isDoctor ? (
        <DoctorScreen user={user} onLogout={handleLogout} />
      ) : (
        <PatientScreen user={user} onLogout={handleLogout} />
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppInner />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  checkingText: { marginTop: 12, fontSize: 14 },
  errTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  retryBtn: { borderRadius: 8, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
