import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../auth';
import { Screen, Card, Title, Banner, Loader, Empty, Chip, Row, Bar, Dots, Hero, StatTile } from '../ui';
import QuickEvent from '../QuickEvent';
import { resolveAnalyzer } from '../exercise/registry';
import { C, T } from '../theme';

export default function CaregiverHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sel, setSel] = useState(null);
  const [tasks, setTasks] = useState({ ex: [], meds: [] });
  const [dots, setDots] = useState([]);
  const [checkins, setCheckins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dashboard/caregiver');
      const ps = data.data.patients || [];
      setPatients(ps);
      setAlerts(data.data.alerts || []);
      const id = sel || ps[0]?.id;
      if (id) {
        setSel(id);
        const [ex, md] = await Promise.all([
          api.get(`/patients/${id}/exercises`),
          api.get(`/patients/${id}/medicines`),
        ]);
        setTasks({ ex: ex.data.data || [], meds: md.data.data || [] });
        api.get(`/patients/${id}/insights?days=7`).then((r) => {
          setDots(r.data.data?.stats?.dots || []);
          setCheckins(r.data.data?.stats?.checkins ?? 0);
        }).catch(() => {});
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pick = (id) => { setSel(id); };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Hero
        kicker="Caregiver · today"
        title="Today's care"
        sub={user?.fullName ? `Signed in as ${user.fullName}` : 'Daily tasks and quick events'}
        right={<Ionicons name="sunny" size={30} color="rgba(255,255,255,0.9)" />}
      />
      {!!error && <Banner kind="danger">{error}</Banner>}
      {loading ? <Loader /> : patients.length === 0 ? (
        <Empty>No patient assigned yet. Ask your doctor to link your account to a patient.</Empty>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            {patients.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => pick(p.id)}
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: sel === p.id ? C.primary : C.white, borderWidth: 1, borderColor: sel === p.id ? C.primary : C.line }}
              >
                <Text style={{ fontWeight: '700', color: sel === p.id ? C.white : C.ink }}>{p.fullName}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {alerts.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('Alerts')} activeOpacity={0.8}>
              <Card style={{ backgroundColor: C.warnSoft, borderColor: C.warn }}>
                <Row>
                  <Ionicons name="warning" size={20} color={C.warn} />
                  <Text style={{ color: C.warn, fontWeight: '700' }}>{alerts.length} unread alert{alerts.length > 1 ? 's' : ''} — tap to view</Text>
                </Row>
              </Card>
            </TouchableOpacity>
          )}
          {dots.length > 0 && (
            <Card>
              <Row between><Text style={T.h3}>This week: {checkins}/7 days recorded</Text></Row>
              <Dots values={dots} />
            </Card>
          )}
          <QuickEvent patientId={sel} onSaved={() => load(true)} />
          <Text style={[T.h2, { marginTop: 8, marginBottom: 10 }]}>Today's exercises ({tasks.ex.length})</Text>
          {tasks.ex.length === 0 && <Text style={T.muted}>None assigned.</Text>}
          {tasks.ex.map((a) => {
            const supported = !!resolveAnalyzer(a.exercise?.name, a.exercise?.category).analyzer;
            const selPatient = (patients || []).find((p) => p.id === sel);
            const coachParams = { assignmentId: a.id, patientId: sel, exerciseId: a.exercise?.id, exerciseName: a.exercise?.name, category: a.exercise?.category, patientGender: selPatient?.gender, patientName: selPatient?.fullName, targetReps: a.reps || 10, instructions: a.instructions };
            return (
              <Card key={a.id}>
                <Row between><Text style={T.h3}>{a.exercise?.name}</Text><Chip status="info" /></Row>
                <Text style={T.muted}>{a.sets} sets × {a.reps} reps{a.durationMin ? ` · ${a.durationMin} min` : ''}{a.instructions ? `\n${a.instructions}` : ''}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Coach', coachParams)}
                  style={{ marginTop: 8, backgroundColor: C.primaryDeep, borderRadius: 10, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                >
                  <Ionicons name="person" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Watch exercise coach</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  {supported && (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('AISession', { assignmentId: a.id, patientId: sel, exerciseName: a.exercise?.name, category: a.exercise?.category, targetReps: a.reps || 10, instructions: a.instructions })}
                      style={{ flex: 1, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                      <Ionicons name="camera" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Start AI Exercise</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Log')}
                    style={{ flex: 1, borderWidth: 1, borderColor: C.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: C.primary, fontWeight: '700' }}>Manual log</Text>
                  </TouchableOpacity>
                </View>
                {!supported && <Text style={[T.tiny, { marginTop: 6 }]}>AI monitoring is not available for this exercise yet.</Text>}
              </Card>
            );
          })}
          <Text style={[T.h2, { marginTop: 8, marginBottom: 10 }]}>Today's medicines ({tasks.meds.length})</Text>
          {tasks.meds.length === 0 && <Text style={T.muted}>None assigned.</Text>}
          {tasks.meds.map((a) => (
            <Card key={a.id}>
              <Row between><Text style={T.h3}>{a.medicine?.name}{a.medicine?.strength ? ` ${a.medicine.strength}` : ''}</Text><Chip status="info" /></Row>
              <Text style={T.muted}>{a.dosage}{(a.scheduleTimes || []).length ? ` · ${(a.scheduleTimes || []).join(', ')}` : ''}</Text>
            </Card>
          ))}
          <Card style={{ backgroundColor: C.primarySoft, borderColor: C.primary }}>
            <Text style={{ color: C.primaryDark, fontWeight: '700' }}>Done observing? Log everything in the Log tab →</Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
