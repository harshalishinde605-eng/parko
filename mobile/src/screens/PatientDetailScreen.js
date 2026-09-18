import React, { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Field, PickerField, Title, Banner, Loader, SectionTitle, Chip, Row, Bar } from '../ui';
import { C, T } from '../theme';

export default function PatientDetailScreen({ route }) {
  const { patientId } = route.params;
  const [patient, setPatient] = useState(null);
  const [exHist, setExHist] = useState(null);
  const [medHist, setMedHist] = useState(null);
  const [sym, setSym] = useState(null);
  const [obs, setObs] = useState([]);
  const [reports, setReports] = useState([]);
  const [exLib, setExLib] = useState([]);
  const [medLib, setMedLib] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(null);

  // forms
  const [exId, setExId] = useState('');
  const [exSets, setExSets] = useState('3');
  const [exReps, setExReps] = useState('10');
  const [exInstr, setExInstr] = useState('');
  const [medId, setMedId] = useState('');
  const [dosage, setDosage] = useState('');
  const [cgEmail, setCgEmail] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [p, eh, mh, sy, ob, rp, el, ml] = await Promise.all([
        api.get(`/patients/${patientId}`),
        api.get(`/patients/${patientId}/exercise-history`),
        api.get(`/patients/${patientId}/medicine-history`),
        api.get(`/patients/${patientId}/symptom-trends`),
        api.get(`/patients/${patientId}/observations`),
        api.get(`/patients/${patientId}/reports`),
        api.get('/exercises'),
        api.get('/medicines'),
      ]);
      setPatient(p.data.data);
      setExHist(eh.data.data); setMedHist(mh.data.data);
      setSym(sy.data.data); setObs(ob.data.data || []);
      setReports(rp.data.data || []);
      setExLib(el.data.data || []); setMedLib(ml.data.data || []);
      if (el.data.data?.[0] && !exId) setExId(el.data.data[0].id);
      if (ml.data.data?.[0] && !medId) setMedId(ml.data.data[0].id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (key, fn, doneMsg) => {
    setBusy(key); setError(''); setOkMsg('');
    try {
      await fn();
      setOkMsg(doneMsg);
      load(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Screen><Loader /></Screen>;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Title sub={patient?.diagnosisStage || 'Patient overview'}>{patient?.fullName || 'Patient'}</Title>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}

      <Row>
        <Card style={{ flex: 1 }}>
          <Text style={T.tiny}>EXERCISE</Text>
          <Text style={T.h1}>{exHist?.stats?.completionPct ?? 0}%</Text>
          <Bar pct={exHist?.stats?.completionPct ?? 0} />
          <Text style={T.tiny}>{exHist?.stats?.completed ?? 0}/{exHist?.stats?.total ?? 0} done</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={T.tiny}>MEDICATION</Text>
          <Text style={T.h1}>{medHist?.stats?.adherencePct ?? 0}%</Text>
          <Bar pct={medHist?.stats?.adherencePct ?? 0} color={C.info} />
          <Text style={T.tiny}>{medHist?.stats?.taken ?? 0}/{medHist?.stats?.total ?? 0} taken</Text>
        </Card>
      </Row>

      <Card>
        <Text style={T.h3}>Symptom averages</Text>
        {sym?.trends?.avg && Object.keys(sym.trends.avg).length ? Object.entries(sym.trends.avg).map(([k, v]) => (
          <Row key={k} between><Text style={T.body}>{k}</Text><Text style={[T.h3, { color: v >= 7 ? C.danger : v >= 4 ? C.warn : C.ok }]}>{v}/10</Text></Row>
        )) : <Text style={T.muted}>No symptoms logged yet.</Text>}
      </Card>

      <SectionTitle>Assign exercise</SectionTitle>
      <Card>
        <PickerField label="Exercise" value={exId} onChange={setExId} items={exLib.map((x) => ({ label: `${x.name}${x.category ? ` · ${x.category}` : ''}`, value: x.id }))} />
        <Row>
          <View style={{ flex: 1 }}><Field label="Sets" value={exSets} onChangeText={setExSets} keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><Field label="Reps" value={exReps} onChangeText={setExReps} keyboardType="numeric" /></View>
        </Row>
        <Field label="Instructions" placeholder="e.g. Slow and steady, twice daily" value={exInstr} onChangeText={setExInstr} />
        <Btn title="Assign exercise" loading={busy === 'ex'} onPress={() => run('ex', () => api.post('/exercise-assignments', { patientId, exerciseId: exId, sets: +exSets || 1, reps: +exReps || 10, instructions: exInstr }), 'Exercise assigned.')} />
      </Card>

      <SectionTitle>Assign medicine</SectionTitle>
      <Card>
        <PickerField label="Medicine" value={medId} onChange={setMedId} items={medLib.map((m) => ({ label: `${m.name}${m.strength ? ` ${m.strength}` : ''}`, value: m.id }))} />
        <Field label="Dosage" placeholder="e.g. 100mg 1-0-1" value={dosage} onChangeText={setDosage} />
        <Btn title="Assign medicine" loading={busy === 'med'} onPress={() => {
          if (!dosage.trim()) return setError('Dosage is required (e.g. 100mg 1-0-1).');
          return run('med', () => api.post('/medicine-assignments', { patientId, medicineId: medId, dosage: dosage.trim(), scheduleTimes: ['08:00', '20:00'] }), 'Medicine assigned.');
        }} />
      </Card>

      <SectionTitle>Care & notes</SectionTitle>
      <Card>
        <Field label="Link caregiver (email)" placeholder="caregiver@example.com" value={cgEmail} onChangeText={setCgEmail} autoCapitalize="none" keyboardType="email-address" />
        <Btn title="Link caregiver" kind="secondary" loading={busy === 'cg'} onPress={() => {
          if (!cgEmail.includes('@')) return setError('Enter a valid caregiver email.');
          return run('cg', () => api.post(`/patients/${patientId}/caregiver`, { caregiverEmail: cgEmail.trim() }), 'Caregiver linked.');
        }} />
        <Field label="Clinical note" placeholder="Write care plan update…" value={note} onChangeText={setNote} multiline />
        <Btn title="Save note" kind="secondary" loading={busy === 'note'} onPress={() => {
          if (note.trim().length < 3) return setError('Note is too short.');
          setNote('');
          return run('note', () => api.post('/notes', { patientId, note: note.trim() }), 'Note saved.');
        }} />
      </Card>

      <SectionTitle>Recent exercise logs</SectionTitle>
      {(exHist?.logs || []).length === 0 && <Text style={T.muted}>None yet.</Text>}
      {(exHist?.logs || []).slice(0, 5).map((l) => (
        <Card key={l.id}>
          <Row between><Text style={T.h3}>{l.assignment?.exercise?.name || 'Exercise'}</Text><Chip status={l.status} /></Row>
          <Text style={T.muted}>Reps {l.repsDone ?? '–'} · {l.durationMin ?? '–'} min · difficulty {l.difficulty ?? '–'}{l.remarks ? ` · ${l.remarks}` : ''}</Text>
        </Card>
      ))}

      <SectionTitle>Recent observations</SectionTitle>
      {obs.length === 0 && <Text style={T.muted}>None yet.</Text>}
      {obs.slice(0, 5).map((o) => (
        <Card key={o.id}>
          <Text style={T.body}>{o.notes || `${o.mood || ''} ${o.appetite || ''}`.trim() || 'Observation'}</Text>
          <Text style={T.muted}>Mood {o.mood || '–'} · Appetite {o.appetite || '–'} · Sleep {o.sleepHours ?? '–'}h · Falls {o.falls ? 'YES' : 'no'}</Text>
        </Card>
      ))}

      <SectionTitle>Reports</SectionTitle>
      <Row>
        {['daily', 'weekly', 'monthly'].map((t) => (
          <View key={t} style={{ flex: 1 }}>
            <Btn title={t[0].toUpperCase() + t.slice(1)} kind="secondary" loading={busy === t} onPress={() => run(t, () => api.post(`/patients/${patientId}/reports`, { type: t }), `${t} report generated.`)} />
          </View>
        ))}
      </Row>
      {reports.map((r) => (
        <Card key={r.id}>
          <Row between><Text style={T.h3}>{r.type} report</Text><Chip status="info" /></Row>
          <Text style={T.muted}>
            {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
            {'\n'}Exercise {r.summary?.exercise?.completionPct ?? '–'}% · Meds {r.summary?.meds?.adherencePct ?? '–'}%
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
