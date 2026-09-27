import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../../lib/api';
import { useAuth } from '../../auth';
import { Screen, Card, Banner, Loader, EmptyState, Chip, Row, AppHeader } from '../../ui';
import { C, T } from '../../theme';
import QuickEvent from '../../QuickEvent';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function ageOf(dob) {
  if (!dob) return '';
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
  return y > 0 && y < 130 ? `${y} yrs` : '';
}
const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();
function slotOf(timeStr) {
  if (!timeStr) return 'Morning';
  const h = parseInt(String(timeStr).split(':')[0], 10);
  if (Number.isNaN(h)) return 'Morning';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
function slotState(timeStr, done) {
  if (done) return { label: 'Completed', tone: 'ok' };
  if (!timeStr) return { label: 'Due', tone: 'info' };
  const [h, m] = String(timeStr).split(':').map((v) => parseInt(v, 10));
  if ([h, m].some((v) => Number.isNaN(v))) return { label: 'Due', tone: 'info' };
  const slot = new Date();
  slot.setHours(h, m || 0, 0, 0);
  const diffMin = (slot - Date.now()) / 6e4;
  if (diffMin < -30) return { label: 'Missed', tone: 'danger' };
  if (diffMin <= 60) return { label: 'Due', tone: 'warn' };
  return { label: 'Upcoming', tone: 'info' };
}

export default function CgHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [sel, setSel] = useState(null);
  const [tasks, setTasks] = useState({ ex: [], meds: [] });
  const [logs, setLogs] = useState({ ex: [], med: [], obs: [] });
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
      const id = sel || ps[0]?.id;
      if (!id) return;
      setSel(id);
      const [ex, md, eh, mh, ob] = await Promise.all([
        api.get(`/patients/${id}/exercises`),
        api.get(`/patients/${id}/medicines`),
        api.get(`/patients/${id}/exercise-history`).catch(() => ({ data: { data: { logs: [] } } })),
        api.get(`/patients/${id}/medicine-history`).catch(() => ({ data: { data: { logs: [] } } })),
        api.get(`/patients/${id}/observations`).catch(() => ({ data: { data: [] } })),
      ]);
      setTasks({ ex: ex.data.data || [], meds: md.data.data || [] });
      setLogs({
        ex: (eh.data.data?.logs || []).filter((l) => isToday(l.loggedAt)),
        med: (mh.data.data?.logs || []).filter((l) => isToday(l.takenAt)),
        obs: (ob.data.data || []).filter((o) => isToday(o.loggedAt)),
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const patient = (patients || []).find((p) => p.id === sel);
  const exDone = new Set(logs.ex.filter((l) => l.status !== 'missed').map((l) => l.assignmentId));
  const medTaken = new Set(logs.med.filter((l) => l.status === 'taken').map((l) => l.assignmentId));
  const medLogged = new Set(logs.med.map((l) => l.assignmentId));
  const checkedIn = logs.obs.length > 0;

  const groups = { Morning: [], Afternoon: [], Evening: [] };
  tasks.ex.forEach((a) => {
    const done = exDone.has(a.id);
    groups.Morning.push({
      key: `ex-${a.id}`, icon: 'fitness', title: a.exercise?.name || 'Exercise',
      sub: `${a.sets} × ${a.reps} reps`, done,
      state: done ? { label: 'Completed', tone: 'ok' } : { label: 'Due', tone: 'info' },
      go: () => navigation.navigate('Care', { focusExercise: a.id }),
    });
  });
  tasks.meds.forEach((a) => {
    const times = (a.scheduleTimes || []).length ? a.scheduleTimes : [null];
    times.forEach((t, i) => {
      const logged = medLogged.has(a.id);
      const taken = medTaken.has(a.id);
      const st = logged ? (taken ? { label: 'Taken', tone: 'ok' } : { label: 'Recorded', tone: 'warn' }) : slotOf(t) && slotState(t, false);
      groups[slotOf(t)].push({
        key: `med-${a.id}-${i}`, icon: 'medkit',
        title: `${a.medicine?.name || 'Medicine'}${a.medicine?.strength ? ` ${a.medicine.strength}` : ''}`,
        sub: `${a.dosage}${t ? ` · ${t}` : ''}`,
        done: logged, state: st,
        go: () => navigation.navigate('Care', { focusMedicine: a.id }),
      });
    });
  });
  groups.Morning.push({
    key: 'checkin', icon: 'happy', title: 'Daily check-in', sub: checkedIn ? 'Completed today' : 'How is the patient feeling?',
    done: checkedIn, state: checkedIn ? { label: 'Completed', tone: 'ok' } : { label: 'Due', tone: 'info' },
    go: () => navigation.navigate('Care', { focusCheckin: true }),
  });

  const first = (user?.fullName || '').split(' ')[0];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <AppHeader
        eyebrow="Caregiver home"
        title={`${greeting()}${first ? `,\n${first}` : ''}`}
        sub={patient ? `Here's ${patient.fullName.split(' ')[0]}'s care plan for today.` : 'Your care plan for today.'}
        right={<Ionicons name="sunny" size={28} color="rgba(255,255,255,0.9)" />}
      />
      {!!error && <Banner kind="danger">{error}</Banner>}
      {loading ? <Loader /> : !patient ? (
        <EmptyState icon="people" title="No patient linked" sub="Ask your physiotherapist to link your account to a patient." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {patients.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => setSel(p.id)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: sel === p.id ? C.primary : C.white, borderWidth: 1, borderColor: sel === p.id ? C.primary : C.line }}>
                <Text style={{ fontWeight: '700', color: sel === p.id ? C.white : C.ink }}>{p.fullName}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Card>
            <Row>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: '800', color: C.primary, fontSize: 20 }}>{patient.fullName.trim()[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={T.cardTitle}>{patient.fullName}</Text>
                <Text style={T.muted}>{[ageOf(patient.dob), patient.gender, patient.diagnosisStage || 'Parkinson’s Disease'].filter(Boolean).join('  •  ')}</Text>
              </View>
            </Row>
          </Card>
          <Card>
            <Row between><Text style={T.muted}>EXERCISES</Text><Text style={T.cardTitle}>{exDone.size} / {tasks.ex.length} completed</Text></Row>
            <Row between><Text style={[T.muted, { marginTop: 6 }]}>MEDICINES</Text><Text style={[T.cardTitle, { marginTop: 6 }]}>{medTaken.size} / {tasks.meds.length} taken</Text></Row>
            <Row between><Text style={[T.muted, { marginTop: 6 }]}>CHECK-IN</Text><Text style={[T.cardTitle, { marginTop: 6 }]}>{checkedIn ? '1 / 1 completed' : '0 / 1 completed'}</Text></Row>
          </Card>
          <QuickEvent patientId={sel} onSaved={() => load(true)} />
          {['Morning', 'Afternoon', 'Evening'].map((slot) => groups[slot].length > 0 && (
            <View key={slot}>
              <Text style={[T.h3, { marginTop: 10, marginBottom: 8 }]}>{slot}</Text>
              {groups[slot].map((t) => (
                <TouchableOpacity key={t.key} onPress={t.go} activeOpacity={0.85}>
                  <Card>
                    <Row>
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.done ? C.okSoft : C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={t.done ? 'checkmark-circle' : t.icon} size={22} color={t.done ? C.ok : C.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={T.cardTitle}>{t.title}</Text>
                        <Text style={T.muted}>{t.sub}</Text>
                      </View>
                      <View style={{ borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: t.state.tone === 'ok' ? C.okSoft : t.state.tone === 'warn' ? C.warnSoft : t.state.tone === 'danger' ? C.dangerSoft : C.infoSoft }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: t.state.tone === 'ok' ? C.ok : t.state.tone === 'warn' ? C.warn : t.state.tone === 'danger' ? C.danger : C.info }}>{t.state.label}</Text>
                      </View>
                    </Row>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
