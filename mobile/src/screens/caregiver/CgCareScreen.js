import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../../lib/api';
import { Screen, Card, Btn, Field, PickerField, Seg, Banner, Loader, EmptyState, Row, SectionHead } from '../../ui';
import { C, T } from '../../theme';
import QuickEvent from '../../QuickEvent';

const EX_STATUS = [
  { label: 'Completed', value: 'completed' },
  { label: 'Partially completed', value: 'partial' },
  { label: 'Missed', value: 'missed' },
];
const DIFF_LABEL = { 1: 'Very easy', 2: 'Easy', 3: 'Moderate', 4: 'Difficult', 5: 'Could not complete' };
const REASONS = ['', 'Fatigue', 'Balance difficulty', 'Pain', 'Dizziness', 'Freezing', 'Other'];
const MOODS = ['Very low', 'Low', 'Okay', 'Good', 'Great'];
const LEVELS = ['None', 'Mild', 'Moderate', 'Severe'];
const BALANCE = ['Good', 'Fair', 'Poor'];

function Stepper({ value, min, max, onChange }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, color: C.primary, fontWeight: '800' }}>−</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 24, fontWeight: '800', color: C.ink, minWidth: 40, textAlign: 'center' }}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, color: C.white, fontWeight: '800' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CgCareScreen({ route, navigation }) {
  const [patients, setPatients] = useState([]);
  const [sel, setSel] = useState('');
  const [exList, setExList] = useState([]);
  const [medList, setMedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(null);
  const [openEx, setOpenEx] = useState(route.params?.focusExercise || null);
  const [session, setSession] = useState(null); // assignmentId in session mode

  const [st, setSt] = useState('completed');
  const [reps, setReps] = useState('');
  const [dur, setDur] = useState('');
  const [diff, setDiff] = useState(3);
  const [reason, setReason] = useState('');
  const [exR, setExR] = useState('');

  const [medA, setMedA] = useState('');
  const [medS, setMedS] = useState('taken');
  const [medR, setMedR] = useState('');

  const [mood, setMood] = useState('Okay');
  const [tremor, setTremor] = useState('None');
  const [stiff, setStiff] = useState('None');
  const [bal, setBal] = useState('Good');
  const [sleep, setSleep] = useState('');
  const [appetite, setAppetite] = useState('Good');
  const [checkN, setCheckN] = useState('');

  const [symT, setSymT] = useState('tremor');
  const [sev, setSev] = useState(5);
  const [symN, setSymN] = useState('');
  const [obsN, setObsN] = useState('');

  const loadTasks = useCallback(async (patientId) => {
    if (!patientId) return;
    try {
      const [ex, md] = await Promise.all([
        api.get(`/patients/${patientId}/exercises`),
        api.get(`/patients/${patientId}/medicines`),
      ]);
      const exs = ex.data.data || [], mds = md.data.data || [];
      setExList(exs); setMedList(mds);
      if (mds[0]) setMedA((v) => v || mds[0].id);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  const boot = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/dashboard/caregiver');
      const ps = data.data.patients || [];
      setPatients(ps);
      const id = ps[0]?.id || '';
      setSel(id);
      await loadTasks(id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => {
    boot();
    if (route.params?.focusExercise) setOpenEx(route.params.focusExercise);
    if (route.params?.focusMedicine) setMedA(route.params.focusMedicine);
  }, [boot, route.params]));

  const pickPatient = (id) => { setSel(id); setOpenEx(null); setSession(null); loadTasks(id); };

  const run = async (key, fn, doneMsg) => {
    setBusy(key); setError(''); setOkMsg('');
    try {
      await fn();
      setOkMsg(doneMsg);
      loadTasks(sel);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const quickMed = (assignmentId, status) =>
    run(`qm-${assignmentId}-${status}`, () => api.post('/medicine-logs', { assignmentId, patientId: sel, status }), status === 'taken' ? 'Marked taken.' : `Marked ${status}.`);

  const saveSession = () => {
    if (!session) return;
    return run('session', () => api.post('/exercise-logs', {
      assignmentId: session, patientId: sel, status: st,
      repsDone: reps ? +reps : undefined, durationMin: dur ? +dur : undefined,
      difficulty: diff, feedbackReason: reason || undefined, remarks: exR || undefined,
    }), 'Exercise session recorded.');
  };

  const saveCheckin = () => run('checkin', () => api.post('/observations', {
    patientId: sel, mood, appetite, sleepHours: sleep ? +sleep : undefined,
    notes: `Check-in: mood ${mood}; tremor ${tremor}; stiffness ${stiff}; balance ${bal}.${checkN.trim() ? ` ${checkN.trim()}` : ''}`,
  }), 'Daily check-in saved.');

  if (loading) return <Screen><Loader /></Screen>;

  return (
    <Screen>
      <Text style={T.display}>Care</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>Follow the plan, record what happened.</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      {patients.length === 0 ? (
        <Banner kind="warn">No patient assigned yet. Ask your physiotherapist to link your account.</Banner>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {patients.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => pickPatient(p.id)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: sel === p.id ? C.primary : C.white, borderWidth: 1, borderColor: sel === p.id ? C.primary : C.line }}>
                <Text style={{ fontWeight: '700', color: sel === p.id ? C.white : C.ink }}>{p.fullName}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <SectionHead title="Exercises" />
          {exList.length === 0 && <Text style={T.muted}>No exercises prescribed.</Text>}
          {exList.map((a) => (
            <Card key={a.id}>
              <TouchableOpacity onPress={() => { setOpenEx(openEx === a.id ? null : a.id); setSession(null); }} activeOpacity={0.8}>
                <Row between>
                  <View style={{ flex: 1 }}>
                    <Text style={T.cardTitle}>{a.exercise?.name}</Text>
                    <Text style={T.muted}>{a.exercise?.category || 'Exercise'} · {a.sets} × {a.reps} reps · {a.frequency || 'daily'}</Text>
                  </View>
                  <Ionicons name={openEx === a.id ? 'chevron-up' : 'chevron-down'} size={20} color={C.muted} />
                </Row>
              </TouchableOpacity>
              {openEx === a.id && (
                <View style={{ marginTop: 8 }}>
                  {!!a.exercise?.description && <Text style={[T.body, { marginBottom: 4 }]}>{a.exercise.description}</Text>}
                  {!!a.instructions && <Text style={[T.muted, { marginBottom: 8 }]}>Instructions: {a.instructions}</Text>}
                  <Row>
                    <View style={{ flex: 1 }}><Btn title="Guide" kind="secondary" onPress={() => navigation.navigate('Guide', { assignmentId: a.id, patientId: sel, exerciseId: a.exercise?.id, exerciseName: a.exercise?.name, category: a.exercise?.category, targetReps: a.reps || 10, instructions: a.instructions })} /></View>
                    <View style={{ flex: 1 }}><Btn title={session === a.id ? 'Cancel session' : 'Start exercise'} onPress={() => setSession(session === a.id ? null : a.id)} /></View>
                  </Row>
                  {session === a.id && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>HOW DID IT GO?</Text>
                      <Seg options={EX_STATUS} value={st} onChange={setSt} />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}><Field label="Reps" value={reps} onChangeText={setReps} keyboardType="numeric" placeholder="10" /></View>
                        <View style={{ flex: 1 }}><Field label="Minutes" value={dur} onChangeText={setDur} keyboardType="numeric" placeholder="15" /></View>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>DIFFICULTY: {['', 'Very easy', 'Easy', 'Moderate', 'Difficult', 'Could not complete'][diff]}</Text>
                      <Stepper value={diff} min={1} max={5} onChange={setDiff} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>WHAT CAUSED DIFFICULTY?</Text>
                      <Seg options={[{ label: 'None', value: '' }, { label: 'Fatigue', value: 'Fatigue' }, { label: 'Balance', value: 'Balance difficulty' }, { label: 'Pain', value: 'Pain' }, { label: 'Dizziness', value: 'Dizziness' }, { label: 'Freezing', value: 'Freezing' }]} value={reason} onChange={setReason} />
                      <Field label="Note" value={exR} onChangeText={setExR} placeholder="e.g. Needed support while standing." />
                      <Btn title="Save exercise session" loading={busy === 'session'} onPress={() => { saveSession(); setSession(null); }} />
                    </View>
                  )}
                </View>
              )}
            </Card>
          ))}

          <SectionHead title="Medicines" />
          {medList.length === 0 && <Text style={T.muted}>No medicines prescribed.</Text>}
          {medList.map((a) => (
            <Card key={a.id}>
              <Text style={T.cardTitle}>{a.medicine?.name}{a.medicine?.strength ? ` ${a.medicine.strength}` : ''}</Text>
              <Text style={[T.muted, { marginBottom: 8 }]}>{a.dosage}{(a.scheduleTimes || []).length ? ` · ${(a.scheduleTimes || []).join(', ')}` : ''}</Text>
              <Row>
                {['taken', 'missed', 'delayed'].map((s) => (
                  <View key={s} style={{ flex: 1 }}>
                    <Btn title={s[0].toUpperCase() + s.slice(1)} kind={s === 'taken' ? 'primary' : 'secondary'} loading={busy === `qm-${a.id}-${s}`} onPress={() => quickMed(a.id, s)} />
                  </View>
                ))}
              </Row>
              <Field label="Remark (optional)" value={a.id === medA ? medR : ''} onChangeText={(v) => { setMedA(a.id); setMedR(v); }} placeholder="e.g. with breakfast" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>STATUS FOR REMARK</Text>
              <Seg options={[{ label: 'Taken', value: 'taken' }, { label: 'Missed', value: 'missed' }, { label: 'Delayed', value: 'delayed' }]} value={medS} onChange={setMedS} />
              <Btn title="Save with remark" kind="ghost" loading={busy === 'medfull'} onPress={() => run('medfull', () => api.post('/medicine-logs', { assignmentId: a.id, patientId: sel, status: medS, remarks: medR || undefined }), 'Medicine recorded.')} />
            </Card>
          ))}

          <SectionHead title="Daily check-in" />
          <Card>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>HOW IS THE PATIENT FEELING?</Text>
            <Seg options={['Very low', 'Low', 'Okay', 'Good', 'Great'].map((m) => ({ label: m, value: m }))} value={mood} onChange={setMood} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>TREMOR TODAY</Text>
            <Seg options={['None', 'Mild', 'Moderate', 'Severe'].map((m) => ({ label: m, value: m }))} value={tremor} onChange={setTremor} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>STIFFNESS TODAY</Text>
            <Seg options={['None', 'Mild', 'Moderate', 'Severe'].map((m) => ({ label: m, value: m }))} value={stiff} onChange={setStiff} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>BALANCE TODAY</Text>
            <Seg options={['Good', 'Fair', 'Poor'].map((m) => ({ label: m, value: m }))} value={bal} onChange={setBal} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Sleep (hours)" value={sleep} onChangeText={setSleep} keyboardType="numeric" placeholder="7" /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>APPETITE</Text>
                <Seg options={['Good', 'Fair', 'Poor'].map((m) => ({ label: m.slice(0, 4), value: m }))} value={appetite} onChange={setAppetite} />
              </View>
            </View>
            <Field label="Additional notes" value={checkN} onChangeText={setCheckN} placeholder="e.g. More tired than usual today." multiline />
            <Btn title="Save check-in" loading={busy === 'checkin'} onPress={saveCheckin} />
          </Card>

          <QuickEvent patientId={sel} onSaved={() => loadTasks(sel)} />

          <SectionHead title="Detailed logging" />
          <Card>
            <PickerField label="Symptom" value={symT} onChange={setSymT} items={[{ label: 'Tremor', value: 'tremor' }, { label: 'Stiffness', value: 'stiffness' }, { label: 'Pain', value: 'pain' }, { label: 'Fatigue', value: 'fatigue' }, { label: 'Balance', value: 'balance' }, { label: 'Walking difficulty', value: 'walking' }, { label: 'Other', value: 'other' }]} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>SEVERITY 1–10</Text>
            <Stepper value={sev} min={1} max={10} onChange={setSev} />
            <Field label="Notes" value={symN} onChangeText={setSymN} placeholder="When did it appear?" />
            <Btn title="Save symptom" loading={busy === 'sym'} onPress={() => run('sym', () => api.post('/symptom-logs', { patientId: sel, type: symT, severity: sev, notes: symN || undefined }), 'Symptom saved.')} />
          </Card>
          <Card>
            <Field label="Observation note" value={obsN} onChangeText={setObsN} placeholder="Anything the physiotherapist should know" multiline />
            <Btn title="Save observation" kind="secondary" loading={busy === 'obs'} onPress={() => {
              if (!obsN.trim()) return setError('Write the observation first.');
              setObsN('');
              return run('obs', () => api.post('/observations', { patientId: sel, notes: obsN.trim() }), 'Observation saved.');
            }} />
          </Card>
        </>
      )}
    </Screen>
  );
}
