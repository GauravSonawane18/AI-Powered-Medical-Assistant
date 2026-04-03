import React, { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Alert from '../components/Alert';
import { api } from '../api';
import { saveSession } from '../storage';
import { useTheme } from '../ThemeContext';

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const WEIGHT_UNITS = ['kg', 'lbs'];

const COUNTRIES = [
  { name: 'Afghanistan', code: '93' }, { name: 'Albania', code: '355' },
  { name: 'Algeria', code: '213' }, { name: 'Argentina', code: '54' },
  { name: 'Australia', code: '61' }, { name: 'Austria', code: '43' },
  { name: 'Bangladesh', code: '880' }, { name: 'Belgium', code: '32' },
  { name: 'Brazil', code: '55' }, { name: 'Canada', code: '1' },
  { name: 'Chile', code: '56' }, { name: 'China', code: '86' },
  { name: 'Colombia', code: '57' }, { name: 'Denmark', code: '45' },
  { name: 'Egypt', code: '20' }, { name: 'Ethiopia', code: '251' },
  { name: 'Finland', code: '358' }, { name: 'France', code: '33' },
  { name: 'Germany', code: '49' }, { name: 'Ghana', code: '233' },
  { name: 'Greece', code: '30' }, { name: 'India', code: '91' },
  { name: 'Indonesia', code: '62' }, { name: 'Iran', code: '98' },
  { name: 'Iraq', code: '964' }, { name: 'Ireland', code: '353' },
  { name: 'Israel', code: '972' }, { name: 'Italy', code: '39' },
  { name: 'Japan', code: '81' }, { name: 'Jordan', code: '962' },
  { name: 'Kenya', code: '254' }, { name: 'Malaysia', code: '60' },
  { name: 'Mexico', code: '52' }, { name: 'Morocco', code: '212' },
  { name: 'Netherlands', code: '31' }, { name: 'New Zealand', code: '64' },
  { name: 'Nigeria', code: '234' }, { name: 'Norway', code: '47' },
  { name: 'Pakistan', code: '92' }, { name: 'Philippines', code: '63' },
  { name: 'Poland', code: '48' }, { name: 'Portugal', code: '351' },
  { name: 'Romania', code: '40' }, { name: 'Russia', code: '7' },
  { name: 'Saudi Arabia', code: '966' }, { name: 'Singapore', code: '65' },
  { name: 'South Africa', code: '27' }, { name: 'South Korea', code: '82' },
  { name: 'Spain', code: '34' }, { name: 'Sri Lanka', code: '94' },
  { name: 'Sweden', code: '46' }, { name: 'Switzerland', code: '41' },
  { name: 'Thailand', code: '66' }, { name: 'Turkey', code: '90' },
  { name: 'UAE', code: '971' }, { name: 'Uganda', code: '256' },
  { name: 'UK', code: '44' }, { name: 'Ukraine', code: '380' },
  { name: 'USA', code: '1' }, { name: 'Vietnam', code: '84' },
];

const loginDefaults = { email: '', password: '' };
const registerDefaults = {
  name: '', email: '', password: '', role: 'patient',
  age: '', gender: '', blood_group: '',
  countryCode: '91', phoneNumber: '',
  allergies: '', weight: '', weight_unit: 'kg',
};

function Dropdown({ label, options, value, onSelect }) {
  const { colors, shared } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Text style={shared.label}>{label}</Text>
      <TouchableOpacity style={[styles.dropdownBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]} onPress={() => setOpen(true)}>
        <Text style={value ? [styles.dropdownValue, { color: colors.text }] : styles.dropdownPlaceholder}>
          {value || `Select ${label}`}
        </Text>
        <Text style={[styles.dropdownArrow, { color: colors.muted }]}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{label}</Text>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.modalOption, value === opt && { backgroundColor: colors.primary }]}
                onPress={() => { onSelect(opt); setOpen(false); }}
              >
                <Text style={[styles.modalOptionText, { color: value === opt ? '#fff' : colors.text }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function CountryCodePicker({ value, onSelect }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    search.trim()
      ? COUNTRIES.filter((c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search)
        )
      : COUNTRIES,
    [search]
  );

  const selected = COUNTRIES.find((c) => c.code === value);

  return (
    <>
      <TouchableOpacity style={[styles.countryPickerBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]} onPress={() => setOpen(true)}>
        <Text style={[styles.countryPickerText, { color: colors.text }]}>+{value}</Text>
        <Text style={[styles.dropdownArrow, { color: colors.muted }]}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <View style={[styles.countryModal, { backgroundColor: colors.card }]}>
          <View style={[styles.countryModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.countryModalTitle, { color: colors.text }]}>Select Country Code</Text>
            <TouchableOpacity onPress={() => { setOpen(false); setSearch(''); }}>
              <Text style={[styles.countryModalClose, { color: colors.muted }]}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.countrySearch, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search country or code…"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(item, i) => `${item.code}-${i}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.countryItem, { borderBottomColor: colors.border }, item.code === value && { backgroundColor: colors.primary }]}
                onPress={() => { onSelect(item.code); setOpen(false); setSearch(''); }}
              >
                <Text style={[styles.countryItemName, { color: item.code === value ? '#fff' : colors.text }]}>{item.name}</Text>
                <Text style={[styles.countryItemCode, { color: item.code === value ? '#fff' : colors.muted }]}>+{item.code}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

export default function AuthScreen({ onLogin }) {
  const { colors, shared, dark, toggle: toggleTheme } = useTheme();
  const [tab, setTab] = useState('login');
  const [loginForm, setLoginForm] = useState(loginDefaults);
  const [registerForm, setRegisterForm] = useState(registerDefaults);
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [alert, setAlert] = useState({ message: '', type: 'error' });
  const [busy, setBusy] = useState(false);
  // Password reset flow
  const [resetStep, setResetStep] = useState(null); // null | 'request' | 'confirm'
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  function setLogin(key, val) { setLoginForm((f) => ({ ...f, [key]: val })); }
  function setReg(key, val) { setRegisterForm((f) => ({ ...f, [key]: val })); }

  function handleNameChange(val) {
    setReg('name', val);
    if (val && /[0-9]/.test(val)) {
      setNameError('Name cannot contain numbers.');
    } else {
      setNameError('');
    }
  }

  function handlePhoneChange(val) {
    const digits = val.replace(/\D/g, '');
    if (digits.length > 10) return;
    setReg('phoneNumber', digits);
    if (digits.length > 0 && digits.length < 10) {
      setPhoneError('Phone number must be exactly 10 digits.');
    } else {
      setPhoneError('');
    }
  }

  async function handleLogin() {
    setBusy(true);
    setAlert({ message: '' });
    try {
      const data = await api.login(loginForm);
      await saveSession(data.access_token, data.user);
      onLogin(data.access_token, data.user);
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function handleResetRequest() {
    if (!resetEmail.trim()) return;
    setResetBusy(true);
    setAlert({ message: '' });
    try {
      await api.requestPasswordReset({ email: resetEmail });
      setResetStep('confirm');
      setAlert({ message: `A 6-digit code has been sent to ${resetEmail}. Check your inbox.`, type: 'success' });
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    } finally {
      setResetBusy(false);
    }
  }

  async function handleResetConfirm() {
    if (!resetToken.trim() || !newPassword.trim()) return;
    setResetBusy(true);
    setAlert({ message: '' });
    try {
      const data = await api.confirmPasswordReset({ token: resetToken, new_password: newPassword });
      setAlert({ message: data.message, type: 'success' });
      setResetStep(null);
      setResetEmail(''); setResetToken(''); setNewPassword('');
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    } finally {
      setResetBusy(false);
    }
  }

  async function handleRegister() {
    if (/[0-9]/.test(registerForm.name)) {
      setAlert({ message: 'Name cannot contain numbers.', type: 'error' });
      return;
    }
    if (registerForm.role === 'patient' && registerForm.phoneNumber && registerForm.phoneNumber.length !== 10) {
      setAlert({ message: 'Phone number must be exactly 10 digits.', type: 'error' });
      return;
    }

    setBusy(true);
    setAlert({ message: '' });

    const payload = {
      name: registerForm.name,
      email: registerForm.email,
      password: registerForm.password,
      role: registerForm.role,
    };

    if (registerForm.role === 'patient') {
      payload.age = registerForm.age ? Number(registerForm.age) : undefined;
      payload.gender = registerForm.gender || undefined;
      payload.blood_group = registerForm.blood_group || null;
      payload.phone_number = registerForm.phoneNumber
        ? `+${registerForm.countryCode}${registerForm.phoneNumber}`
        : null;
      payload.allergies = registerForm.allergies || null;
      payload.weight = registerForm.weight ? parseFloat(registerForm.weight) : null;
      payload.weight_unit = registerForm.weight ? registerForm.weight_unit : null;
    }

    try {
      const data = await api.register(payload);
      await saveSession(data.access_token, data.user);
      onLogin(data.access_token, data.user);
    } catch (e) {
      setAlert({ message: e.message, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[shared.screen, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={styles.themePill} onPress={toggleTheme}>
            <Text style={styles.themePillText}>{dark ? '☀️ Light' : '🌙 Dark'}</Text>
          </TouchableOpacity>
          <Text style={[styles.logo, { color: colors.primary }]}>MedAssist</Text>
          <Text style={[styles.tagline, { color: colors.muted }]}>AI-powered symptom guidance, reviewed by doctors.</Text>
        </View>

        <View style={[styles.tabRow, { backgroundColor: colors.border }]}>
          {['login', 'register'].map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && { backgroundColor: colors.card }]} onPress={() => setTab(t)}>
              <Text style={[styles.tabBtnText, { color: tab === t ? colors.primary : colors.muted }]}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[shared.card, { backgroundColor: colors.card }]}>
          <Alert message={alert.message} type={alert.type} />

          {tab === 'login' && resetStep === null ? (
            <>
              <Text style={shared.label}>Email</Text>
              <TextInput style={shared.input} value={loginForm.email} onChangeText={(v) => setLogin('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" placeholderTextColor={colors.muted} />
              <Text style={shared.label}>Password</Text>
              <TextInput style={shared.input} value={loginForm.password} onChangeText={(v) => setLogin('password', v)} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.muted} />
              <TouchableOpacity style={[shared.primaryBtn, busy && { opacity: 0.6 }]} onPress={handleLogin} disabled={busy}>
                <Text style={shared.primaryBtnText}>{busy ? 'Signing in…' : 'Sign In'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => { setResetStep('request'); setAlert({ message: '' }); }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Forgot password?</Text>
              </TouchableOpacity>
            </>
          ) : tab === 'login' && resetStep === 'request' ? (
            <>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🔐</Text>
                <Text style={[styles.sectionLabel, { color: colors.text, textAlign: 'center' }]}>Forgot Password?</Text>
                <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                  Enter your registered email and we'll send a 6-digit reset code to your inbox.
                </Text>
              </View>
              <Text style={[shared.label, { color: colors.label }]}>Email address</Text>
              <TextInput
                style={[shared.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
              />
              <TouchableOpacity style={[shared.primaryBtn, resetBusy && { opacity: 0.6 }]} onPress={handleResetRequest} disabled={resetBusy}>
                <Text style={shared.primaryBtnText}>{resetBusy ? 'Sending code…' : '📧 Send Reset Code'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => { setResetStep(null); setAlert({ message: '' }); }}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>← Back to Sign In</Text>
              </TouchableOpacity>
            </>
          ) : tab === 'login' && resetStep === 'confirm' ? (
            <>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📬</Text>
                <Text style={[styles.sectionLabel, { color: colors.text, textAlign: 'center' }]}>Check Your Email</Text>
                <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                  We sent a 6-digit code to{'\n'}<Text style={{ color: colors.primary, fontWeight: '700' }}>{resetEmail}</Text>
                </Text>
              </View>
              <Text style={[shared.label, { color: colors.label }]}>6-digit OTP code</Text>
              <TextInput
                style={[shared.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border, fontSize: 22, letterSpacing: 8, textAlign: 'center', fontWeight: '700' }]}
                value={resetToken}
                onChangeText={setResetToken}
                placeholder="000000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Text style={[shared.label, { color: colors.label }]}>New Password</Text>
              <TextInput
                style={[shared.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Min. 8 characters"
                placeholderTextColor={colors.muted}
              />
              <TouchableOpacity style={[shared.primaryBtn, resetBusy && { opacity: 0.6 }]} onPress={handleResetConfirm} disabled={resetBusy}>
                <Text style={shared.primaryBtnText}>{resetBusy ? 'Resetting…' : '🔒 Reset Password'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => { setResetStep('request'); setAlert({ message: '' }); }}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Didn't get the code? Resend</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 8, alignItems: 'center' }} onPress={() => { setResetStep(null); setAlert({ message: '' }); }}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>← Back to Sign In</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={shared.label}>Full Name (letters only)</Text>
              <TextInput
                style={[shared.input, nameError ? styles.inputError : null]}
                value={registerForm.name}
                onChangeText={handleNameChange}
                placeholder="Jane Doe"
                autoCapitalize="words"
              />
              {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}

              <Text style={shared.label}>Role</Text>
              <View style={styles.roleRow}>
                {['patient', 'doctor'].map((r) => (
                  <TouchableOpacity key={r} style={[styles.roleBtn, { borderColor: registerForm.role === r ? colors.primary : colors.border, backgroundColor: registerForm.role === r ? colors.primary : colors.card }]} onPress={() => setReg('role', r)}>
                    <Text style={[styles.roleBtnText, { color: registerForm.role === r ? '#fff' : colors.muted }]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={shared.label}>Email</Text>
              <TextInput style={shared.input} value={registerForm.email} onChangeText={(v) => setReg('email', v)} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />

              <Text style={shared.label}>Password</Text>
              <TextInput style={shared.input} value={registerForm.password} onChangeText={(v) => setReg('password', v)} secureTextEntry placeholder="Min. 8 characters" />

              {registerForm.role === 'patient' && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.primary }]}>Patient Details</Text>

                  <Text style={shared.label}>Age</Text>
                  <TextInput style={shared.input} value={registerForm.age} onChangeText={(v) => setReg('age', v)} keyboardType="numeric" placeholder="25" />

                  <Dropdown label="Gender" options={GENDERS} value={registerForm.gender} onSelect={(v) => setReg('gender', v)} />
                  <Dropdown label="Blood Group" options={BLOOD_GROUPS} value={registerForm.blood_group} onSelect={(v) => setReg('blood_group', v)} />

                  <Text style={shared.label}>Phone Number</Text>
                  <View style={styles.phoneRow}>
                    <CountryCodePicker value={registerForm.countryCode} onSelect={(v) => setReg('countryCode', v)} />
                    <TextInput
                      style={[styles.phoneInput, { borderColor: phoneError ? '#dc2626' : colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
                      value={registerForm.phoneNumber}
                      onChangeText={handlePhoneChange}
                      keyboardType="numeric"
                      placeholder="10-digit number"
                      placeholderTextColor={colors.muted}
                      maxLength={10}
                    />
                  </View>
                  {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

                  <Text style={shared.label}>Allergies</Text>
                  <TextInput style={shared.input} value={registerForm.allergies} onChangeText={(v) => setReg('allergies', v)} placeholder="Penicillin, peanuts…" />

                  <Text style={shared.label}>Weight</Text>
                  <View style={styles.weightRow}>
                    <TextInput
                      style={[shared.input, { flex: 1, marginRight: 10, marginBottom: 0 }]}
                      value={registerForm.weight}
                      onChangeText={(v) => setReg('weight', v)}
                      keyboardType="decimal-pad"
                      placeholder="70"
                    />
                    <View style={styles.unitRow}>
                      {WEIGHT_UNITS.map((u) => (
                        <TouchableOpacity key={u} style={[styles.unitBtn, { borderColor: registerForm.weight_unit === u ? colors.primary : colors.border, backgroundColor: registerForm.weight_unit === u ? colors.primary : colors.card }]} onPress={() => setReg('weight_unit', u)}>
                          <Text style={[{ fontWeight: '600', color: registerForm.weight_unit === u ? '#fff' : colors.muted }]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              <TouchableOpacity style={[shared.primaryBtn, { marginTop: 16 }, busy && { opacity: 0.6 }]} onPress={handleRegister} disabled={busy}>
                <Text style={shared.primaryBtnText}>{busy ? 'Creating account…' : 'Create Account'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={[styles.disclaimer, { color: colors.muted }]}>
          Responses are informational only and do not replace licensed medical advice.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 28 },
  themePill: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 20, marginBottom: 12 },
  themePillText: { fontSize: 13, fontWeight: '600' },
  logo: { fontSize: 32, fontWeight: '800' },
  tagline: { fontSize: 14, marginTop: 6, textAlign: 'center' },
  tabRow: { flexDirection: 'row', borderRadius: 10, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabBtnText: { fontSize: 14, fontWeight: '600' },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  roleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  roleBtnText: { fontWeight: '600' },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 10, marginTop: 8 },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12 },
  dropdownValue: { fontSize: 15 },
  dropdownPlaceholder: { fontSize: 15, color: '#aaa' },
  dropdownArrow: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 32 },
  modalBox: { borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  modalOption: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  modalOptionText: { fontSize: 15 },
  phoneRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  countryPickerBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, minWidth: 80 },
  countryPickerText: { fontSize: 15, marginRight: 4 },
  phoneInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  countryModal: { flex: 1, marginTop: 60, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  countryModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  countryModalTitle: { fontSize: 16, fontWeight: '700' },
  countryModalClose: { fontSize: 18 },
  countrySearch: { margin: 12, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  countryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  countryItemName: { fontSize: 15 },
  countryItemCode: { fontSize: 15, fontWeight: '600' },
  inputError: { borderColor: '#dc2626' },
  fieldError: { fontSize: 12, color: '#dc2626', marginTop: -8, marginBottom: 10 },
  weightRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  unitRow: { flexDirection: 'row', gap: 8 },
  unitBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  unitBtnTextActive: { color: '#fff' },
  disclaimer: { fontSize: 12, textAlign: 'center', marginTop: 16, marginBottom: 32 },
});
