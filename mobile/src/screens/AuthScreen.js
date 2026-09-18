import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../auth';
import { errMsg } from '../../lib/api';
import { Screen, Card, Btn, Field, Banner, Title } from '../ui';
import { C, T } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen({ route }) {
  const intended = route.params?.role || 'CAREGIVER';
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const validate = () => {
    if (mode === 'register' && fullName.trim().length < 2) return 'Please enter your full name.';
    if (!EMAIL_RE.test(email.trim())) return 'Please enter a valid email address.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    return '';
  };

  const submit = async () => {
    const v = validate();
    if (v) return setError(v);
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'login') {
        const u = await signIn(email.trim(), password);
        if (u.role !== intended) {
          setNotice(`Note: this account is registered as ${u.role}, so you were signed in with that role.`);
        }
      } else {
        await signUp({ email: email.trim(), password, fullName: fullName.trim(), role: intended });
        setMode('login');
        setPassword('');
        setNotice('Account created. Please sign in.');
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title sub={intended === 'DOCTOR' ? 'Doctor / Physiotherapist access' : 'Caregiver access'}>
        {mode === 'login' ? 'Welcome back' : 'Create account'}
      </Title>
      <View style={{ flexDirection: 'row', backgroundColor: '#E7EFEB', borderRadius: 12, padding: 4, marginBottom: 14 }}>
        {['login', 'register'].map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => { setMode(m); setError(''); setNotice(''); }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center', backgroundColor: mode === m ? C.white : 'transparent' }}
          >
            <Text style={{ fontWeight: '700', color: mode === m ? C.primaryDark : C.muted }}>
              {m === 'login' ? 'Sign in' : 'Register'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!notice && <Banner kind="ok">{notice}</Banner>}
      <Card>
        {mode === 'register' && (
          <Field label="Full name" placeholder="e.g. Dr. Asha Patil" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
        )}
        <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Password" placeholder={mode === 'register' ? 'Min 8 characters' : 'Your password'} value={password} onChangeText={setPassword} secure />
        <Btn title={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
      </Card>
      <Text style={[T.tiny, { textAlign: 'center' }]}>Healthcare data is encrypted in transit and stored securely.</Text>
    </Screen>
  );
}
