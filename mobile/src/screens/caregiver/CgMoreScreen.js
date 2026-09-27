import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../../lib/api';
import { remindersEnabled, setRemindersEnabled, rescheduleFromPlan } from '../../notify';
import { useAuth } from '../../auth';
import { Screen, Card, Btn, Banner, Loader, Row, SectionHead } from '../../ui';
import { C, T } from '../../theme';

export default function CgMoreScreen() {
  const { user, signOut } = useAuth();
  const [patient, setPatient] = useState(null);
  const [team, setTeam] = useState({ caregivers: [], doctors: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [help, setHelp] = useState(false);
  const initial = (user?.fullName || user?.email || '?').trim()[0]?.toUpperCase() || '?';

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/dashboard/caregiver');
      const p = (data.data.patients || [])[0] || null;
      setPatient(p);
      if (p) {
        const tm = await api.get(`/patients/${p.id}/care-team`).catch(() => ({ data: { data: { caregivers: [], doctors: [] } } }));
        setTeam(tm.data.data);
      }
      const pref = await remindersEnabled();
      if (pref !== null) setReminders(pref);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleReminders = async (v) => {
    setReminders(v);
    await setRemindersEnabled(v);
    if (v && patient) {
      try {
        const [ex, md] = await Promise.all([
          api.get(`/patients/${patient.id}/exercises`),
          api.get(`/patients/${patient.id}/medicines`),
        ]);
        await rescheduleFromPlan(ex.data.data || [], md.data.data || []);
      } catch { /* scheduling is best-effort */ }
    }
  };

  return (
    <Screen>
      <Text style={T.display}>More</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>Profile, care team and support.</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {loading ? <Loader /> : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.white, fontSize: 24, fontWeight: '800' }}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={T.cardTitle}>{user?.fullName}</Text>
                <Text style={T.muted}>Caregiver</Text>
                <Text style={T.tiny}>{user?.email}</Text>
              </View>
            </View>
          </Card>

          <SectionHead title="Linked patient" />
          {!patient ? <Text style={T.muted}>No patient linked yet.</Text> : (
            <Card>
              <Text style={T.cardTitle}>{patient.fullName}</Text>
              <Text style={T.muted}>{[patient.diagnosisStage || 'Parkinson’s Disease'].join('')}</Text>
            </Card>
          )}

          <SectionHead title="Care team" />
          {(team.doctors || []).length === 0 && <Text style={T.muted}>No team info available.</Text>}
          {(team.doctors || []).map((d) => (
            <Card key={d.id}>
              <Text style={T.cardTitle}>{d.fullName}</Text>
              <Text style={T.muted}>Physiotherapist · {d.email}</Text>
            </Card>
          ))}

          <SectionHead title="Settings" />
          <Card>
            <Row between>
              <Text style={T.body}>Care reminders on this device</Text>
              <Switch value={reminders} onValueChange={toggleReminders} trackColor={{ true: C.primary }} />
            </Row>
          </Card>

          <TouchableOpacity onPress={() => setHelp((h) => !h)} activeOpacity={0.8}>
            <Card>
              <Text style={T.cardTitle}>Help & Support</Text>
              {help && <Text style={[T.muted, { marginTop: 6 }]}>Follow the prescribed plan, record what actually happened, and report falls or severe symptoms immediately. In an emergency contact local emergency services — this app is not an emergency tool.</Text>}
            </Card>
          </TouchableOpacity>

          <Btn title="Sign out" kind="danger" loading={busy} onPress={async () => { setBusy(true); await signOut(); setBusy(false); }} />
        </>
      )}
    </Screen>
  );
}
