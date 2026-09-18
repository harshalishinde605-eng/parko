import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Field, PickerField, Seg, Title, Banner, Loader, SectionTitle } from '../ui';
import { C, T } from '../theme';

const SYM = [
  { label: 'Tremor', value: 'tremor' },
  { label: 'Stiffness', value: 'stiffness' },
  { label: 'Pain', value: 'pain' },
  { label: 'Fatigue', value: 'fatigue' },
  { label: 'Balance', value: 'balance' },
  { label: 'Walking difficulty', value: 'walking' },
  { label: 'Other', value: 'other' },
];

const EX_STATUS = [
  { label: 'Completed', value: 'completed' },
  { label: 'Partial', value: 'partial' },
  { label: 'Missed', value: 'missed' },
];
const MED_STATUS = [
  { label: 'Taken', value: 'taken' },
  { label: 'Missed', value: 'missed' },
  { label: 'Delayed', value: 'delayed' },
];

function Stepper({ value, min, max, onChange, hint }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, color: C.primary, fontWeight: '800' }}>−</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 24, fontWeight: '800', color: hint >= 7 ? C.danger : hint >= 4 ? C.warn : C.ink, minWidth: 40, textAlign: 'center' }}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, color: C.white, fontWeight: '800' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CaregiverLogScreen() {
  const [patients, setPatients] = useState([]);
  const [sel, setSel] = useState('');
  const [exList, setExList] = useState([]);
  const [medList, setMedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(null);

  const [exA, setExA] = useState('');
  const [exS, setExS] = useState('completed');
  const [reps, setReps] = useState('');
  const [dur, setDur] = useState('');
  const [diff, setDiff] = useState(3);
  const [exR, setExR] = useState('');

  const [medA, setMedA] = useState('');
  const [medS, setMedS] = useState('taken');
  const [medR, setMedR] = useState('');

  const [symT, setSymT] = useState('tremor');
  const [sev, setSev] = useState(5);
  const [symN, setSymN] = useState('');

  const [mood, setMood] = useState('');
  const [appetite, setAppetite] = useState('');
  const [sleep, setSleep] = useState('');
  const [falls, setFalls] = useState(false);
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
      if (exs[0] && !exA) setExA(exs[0].id);
      if (mds[0] && !medA) setMedA(mds[0].id);
    } catch (e) {
      setError(errMsg(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useFocusEffect(useCallback(() => { boot(); }, [boot]));

  const pickPatient = (id) => { setSel(id); setExA(''); setMedA(''); loadTasks(id); };

  const run = async (key, fn, doneMsg) => {
    setBusy(key); setError(''); setOkMsg('');
    try {
      await fn();
      setOkMsg(doneMsg);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Screen><Loader /></Screen>;

  return (
    <Screen>
      <Title sub="Everything saves to the cloud instantly">Log care</Title>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      {patients.length === 0 ? (
        <Banner kind="warn">No patient assigned yet. Ask your doctor to link your account.</Banner>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          {patients.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => pickPatient(p.id)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: sel === p.id ? C.primary : C.white, borderWidth: 1, borderColor: sel === p.id ? C.primary : C.line }}>
              <Text style={{ fontWeight: '700', color: sel === p.id ? C.white : C.ink }}>{p.fullName}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <SectionTitle>Exercise</SectionTitle>
      <Card>
        <PickerField label="Assigned exercise" value={exA} onChange={setExA} items={exList.map((a) => ({ label: `${a.exercise?.name} (${a.sets}×${a.reps})`, value: a.id }))} />
        <Seg options={EX_STATUS} value={exS} onChange={setExS} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Reps done" value={reps} onChangeText={setReps} keyboardType="numeric" placeholder="e.g. 10" /></View>
          <View style={{ flex: 1 }}><Field label="Minutes" value={dur} onChangeText={setDur} keyboardType="numeric" placeholder="e.g. 15" /></View>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>DIFFICULTY (1 EASY – 5 HARD)</Text>
        <Stepper value={diff} min={1} max={5} onChange={setDiff} hint={diff} />
        <Field label="Remarks" value={exR} onChangeText={setExR} placeholder="How did it go?" />
        <Btn title="Save exercise log" loading={busy === 'ex'} onPress={() => {
          if (!exA) return setError('No exercise assignment selected.');
          return run('ex', () => api.post('/exercise-logs', { assignmentId: exA, patientId: sel, status: exS, repsDone: reps ? +reps : undefined, durationMin: dur ? +dur : undefined, difficulty: diff, remarks: exR || undefined }), 'Exercise log saved.');
        }} />
      </Card>

      <SectionTitle>Medicine</SectionTitle>
      <Card>
        <PickerField label="Assigned medicine" value={medA} onChange={setMedA} items={medList.map((a) => ({ label: `${a.medicine?.name} ${a.dosage}`, value: a.id }))} />
        <Seg options={MED_STATUS} value={medS} onChange={setMedS} />
        <Field label="Remarks" value={medR} onChangeText={setMedR} placeholder="e.g. with breakfast" />
        <Btn title="Save medicine log" loading={busy === 'med'} onPress={() => {
          if (!medA) return setError('No medicine assignment selected.');
          return run('med', () => api.post('/medicine-logs', { assignmentId: medA, patientId: sel, status: medS, remarks: medR || undefined }), 'Medicine log saved.');
        }} />
      </Card>

      <SectionTitle>Symptom</SectionTitle>
      <Card>
        <PickerField label="Symptom type" value={symT} onChange={setSymT} items={SYM} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>SEVERITY (1 MILD – 10 SEVERE)</Text>
        <Stepper value={sev} min={1} max={10} onChange={setSev} hint={sev} />
        {sev >= 8 && <Banner kind="danger">Severity 8+ will raise a critical alert to the doctor.</Banner>}
        <Field label="Notes" value={symN} onChangeText={setSymN} placeholder="When did it appear?" />
        <Btn title="Save symptom" loading={busy === 'sym'} onPress={() => run('sym', () => api.post('/symptom-logs', { patientId: sel, type: symT, severity: sev, notes: symN || undefined }), 'Symptom saved.')} />
      </Card>

      <SectionTitle>Daily observation</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="Mood" value={mood} onChangeText={setMood} placeholder="e.g. calm" /></View>
          <View style={{ flex: 1 }}><Field label="Appetite" value={appetite} onChangeText={setAppetite} placeholder="e.g. good" /></View>
        </View>
        <Field label="Sleep (hours)" value={sleep} onChangeText={setSleep} keyboardType="numeric" placeholder="e.g. 7" />
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>ANY FALL TODAY?</Text>
        <Seg options={[{ label: 'No fall', value: false }, { label: 'Fall happened', value: true }]} value={falls} onChange={setFalls} />
        <Field label="Notes" value={obsN} onChangeText={setObsN} placeholder="Anything the doctor should know" multiline />
        <Btn title="Save observation" loading={busy === 'obs'} onPress={() => run('obs', () => api.post('/observations', { patientId: sel, mood: mood || undefined, appetite: appetite || undefined, sleepHours: sleep ? +sleep : undefined, falls, notes: obsN || undefined }), 'Observation saved.')} />
      </Card>
    </Screen>
  );
}
