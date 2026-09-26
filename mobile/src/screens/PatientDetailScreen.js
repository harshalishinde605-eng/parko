import React, { useCallback, useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Field, Seg, PickerField, Title, Banner, Loader, SectionTitle, Chip, Row, Bar, Dots, MiniBars, AttentionItem, Hero, StatTile } from '../ui';
import { C, T } from '../theme';

const TABS = [
  { label: 'Overview', value: 'ov' },
  { label: 'Timeline', value: 'tl' },
  { label: 'Reports', value: 'rp' },
];

const KIND_ICON = { exercise: 'fitness', medication: 'medkit', symptom: 'pulse', observation: 'eye', note: 'document-text', alert: 'notifications' };
const KIND_LABEL = { exercise: 'Exercise', medication: 'Medication', symptom: 'Symptom', observation: 'Observation', note: 'Doctor note', alert: 'Alert' };

const SYM_TYPES = [
  { label: 'Tremor', value: 'tremor' },
  { label: 'Walking difficulty', value: 'walkingDifficulty' },
  { label: 'Stiffness', value: 'stiffness' },
  { label: 'Fatigue', value: 'fatigue' },
  { label: 'Pain', value: 'pain' },
  { label: 'Balance difficulty', value: 'balance' },
  { label: 'Other', value: 'other' },
];

function SeverityChart({ records }) {
  if (!records || !records.length) return <Text style={T.muted}>No symptom records for this period.</Text>;
  const H = 120;
  return (
    <View>
      <View style={{ height: H + 18, flexDirection: 'row' }}>
        <View style={{ width: 22, justifyContent: 'space-between', paddingBottom: 18 }}>
          {[10, 7, 4, 1].map((v) => <Text key={v} style={T.tiny}>{v}</Text>)}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', borderLeftWidth: 1, borderBottomWidth: 1, borderColor: C.line }}>
          {records.map((r, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 18 }}>
              <View style={{ position: 'absolute', bottom: 18 + (r.severity / 10) * H, width: 12, height: 12, borderRadius: 6, backgroundColor: r.severity >= 8 ? C.danger : r.severity >= 5 ? C.warn : C.primary }} />
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: 22 }}>
        {records.map((r, i) => (
          <Text key={i} style={[T.tiny, { flex: 1, textAlign: 'center' }]}>{(i % Math.ceil(records.length / 6) === 0) ? r.date.slice(5) : ''}</Text>
        ))}
      </View>
      <Text style={[T.tiny, { marginTop: 4 }]}>Recorded symptom severity by date (based on logged observations).</Text>
    </View>
  );
}

function ageOf(dob) {
  if (!dob) return '';
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
  return y > 0 && y < 130 ? `${y} yrs` : '';
}

export default function PatientDetailScreen({ route }) {
  const { patientId } = route.params;
  const [tab, setTab] = useState(route.params?.tab || 'ov');
  React.useEffect(() => { if (route.params?.tab) setTab(route.params.tab); }, [route.params?.tab]);
  const [patient, setPatient] = useState(null);
  const [team, setTeam] = useState({ caregivers: [], doctors: [] });
  const [ins, setIns] = useState(null);
  const [timeline, setTimeline] = useState({ groups: {} });
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(null);

  // write-in forms (no dropdowns — doctor types names)
  const [exName, setExName] = useState('');
  const [exCat, setExCat] = useState('');
  const [exSets, setExSets] = useState('3');
  const [exReps, setExReps] = useState('10');
  const [exInstr, setExInstr] = useState('');
  const [medName, setMedName] = useState('');
  const [medStr, setMedStr] = useState('');
  const [dosage, setDosage] = useState('');
  const [cgEmail, setCgEmail] = useState('');
  const [note, setNote] = useState('');

  // analytics report state
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('weekly');
  const [cFrom, setCFrom] = useState('');
  const [cTo, setCTo] = useState('');
  const [symType, setSymType] = useState('tremor');
  const [aLoading, setALoading] = useState(false);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [p, i, tl, rp, tm] = await Promise.all([
        api.get(`/patients/${patientId}`),
        api.get(`/patients/${patientId}/insights?days=7`),
        api.get(`/patients/${patientId}/timeline?days=7`),
        api.get(`/patients/${patientId}/reports`),
        api.get(`/patients/${patientId}/care-team`),
      ]);
      setPatient(p.data.data);
      setIns(i.data.data);
      setTimeline(tl.data.data);
      setReports(rp.data.data || []);
      setTeam(tm.data.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadAnalytics = async (p = period, from = cFrom, to = cTo) => {
    setALoading(true); setError('');
    try {
      let url = `/patients/${patientId}/analytics?period=${p}`;
      if (p === 'custom') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) { setError('Custom range needs YYYY-MM-DD dates (e.g. 2026-09-01).'); setALoading(false); return; }
        url += `&startDate=${from}&endDate=${to}`;
      }
      const { data } = await api.get(url);
      setAnalytics(data.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setALoading(false);
    }
  };

  useEffect(() => { if (tab === 'rp' && !analytics) loadAnalytics('weekly'); }, [tab]);

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
  const st = ins?.stats;
  const cg = team.caregivers[0];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Hero
        kicker="Patient overview"
        title={patient?.fullName || 'Patient'}
        sub={[ageOf(patient?.dob), patient?.diagnosisStage, cg ? `Caregiver: ${cg.fullName}` : 'No caregiver linked'].filter(Boolean).join(' · ')}
        right={<Ionicons name="person" size={30} color="rgba(255,255,255,0.9)" />}
      />
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      <Seg options={TABS} value={tab} onChange={setTab} />

      {tab === 'ov' && (
        <>
          <Row>
            <Card style={{ flex: 1 }}><Text style={T.tiny}>MEDS 7D</Text><Text style={T.h1}>{st?.meds?.adherencePct ?? 0}%</Text><Bar pct={st?.meds?.adherencePct ?? 0} color={C.info} /></Card>
            <Card style={{ flex: 1 }}><Text style={T.tiny}>EXERCISE 7D</Text><Text style={T.h1}>{st?.exercise?.completionPct ?? 0}%</Text><Bar pct={st?.exercise?.completionPct ?? 0} /></Card>
            <Card style={{ flex: 1 }}><Text style={T.tiny}>CHECK-INS</Text><Text style={T.h1}>{st?.checkins ?? 0}/7</Text><Dots values={(st?.dots || []).slice(0, 7)} /></Card>
          </Row>
          {(ins?.attention || []).map((a, i) => <AttentionItem key={i} level={a.level} title={a.title} detail={a.detail} />)}

          <SectionTitle>Assign exercise — just write it</SectionTitle>
          <Card>
            <Field label="Exercise name" placeholder="e.g. Sit-to-Stand" value={exName} onChangeText={setExName} />
            <Field label="Category (optional)" placeholder="e.g. strength, balance" value={exCat} onChangeText={setExCat} />
            <Row>
              <View style={{ flex: 1 }}><Field label="Sets" value={exSets} onChangeText={setExSets} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="Reps" value={exReps} onChangeText={setExReps} keyboardType="numeric" /></View>
            </Row>
            <Field label="Instructions" placeholder="e.g. Twice daily, slow" value={exInstr} onChangeText={setExInstr} />
            <Btn title="Assign exercise" loading={busy === 'ex'} onPress={() => {
              if (exName.trim().length < 2) return setError('Write the exercise name first.');
              return run('ex', () => api.post('/exercise-assignments', { patientId, exerciseName: exName.trim(), exerciseCategory: exCat.trim() || undefined, sets: +exSets || 1, reps: +exReps || 10, instructions: exInstr || undefined }), `Assigned “${exName.trim()}”. New names are saved to the library automatically.`);
            }} />
          </Card>

          <SectionTitle>Assign medicine — just write it</SectionTitle>
          <Card>
            <Field label="Medicine name" placeholder="e.g. Levodopa" value={medName} onChangeText={setMedName} />
            <Field label="Strength" placeholder="e.g. 100mg" value={medStr} onChangeText={setMedStr} />
            <Field label="Dosage" placeholder="e.g. 100mg 1-0-1" value={dosage} onChangeText={setDosage} />
            <Btn title="Assign medicine" loading={busy === 'med'} onPress={() => {
              if (medName.trim().length < 2) return setError('Write the medicine name first.');
              if (!dosage.trim()) return setError('Dosage is required (e.g. 100mg 1-0-1).');
              return run('med', () => api.post('/medicine-assignments', { patientId, medicineName: medName.trim(), medicineStrength: medStr.trim() || undefined, dosage: dosage.trim(), scheduleTimes: ['08:00', '20:00'] }), `Assigned “${medName.trim()}”.`);
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
              const text = note.trim(); setNote('');
              return run('note', () => api.post('/notes', { patientId, note: text }), 'Note saved.');
            }} />
          </Card>
        </>
      )}

      {tab === 'tl' && (
        <>
          <SectionTitle>Care timeline — last 7 days</SectionTitle>
          {Object.keys(timeline.groups || {}).length === 0 && <Banner kind="warn">No records yet this week.</Banner>}
          {Object.entries(timeline.groups || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, items]) => (
            <View key={day}>
              <Text style={[T.h3, { marginTop: 10, marginBottom: 6 }]}>{day}</Text>
              {items.map((it, i) => (
                <Card key={i}>
                  <Row>
                    <Ionicons name={KIND_ICON[it.kind] || 'ellipse'} size={20} color={C.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[T.tiny, { fontWeight: '700' }]}>{new Date(it.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {(KIND_LABEL[it.kind] || it.kind).toUpperCase()}</Text>
                      <Text style={[T.body, { fontWeight: '700' }]}>{it.title}</Text>
                      {!!it.detail && <Text style={T.muted}>{it.detail}</Text>}
                    </View>
                  </Row>
                </Card>
              ))}
            </View>
          ))}
        </>
      )}

      {tab === 'rp' && (
        <>
          <Seg options={[{ label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }, { label: 'Custom', value: 'custom' }]} value={period} onChange={(v) => { setPeriod(v); if (v !== 'custom') loadAnalytics(v); }} />
          {period === 'custom' && (
            <Card>
              <Row>
                <View style={{ flex: 1 }}><Field label="From (YYYY-MM-DD)" placeholder="2026-09-01" value={cFrom} onChangeText={setCFrom} /></View>
                <View style={{ flex: 1 }}><Field label="To (YYYY-MM-DD)" placeholder="2026-09-26" value={cTo} onChangeText={setCTo} /></View>
              </Row>
              <Btn title="Generate report" onPress={() => loadAnalytics('custom')} loading={aLoading} />
            </Card>
          )}
          {aLoading && <Loader>Calculating report…</Loader>}
          {analytics && (
            <>
              <Text style={[T.muted, { marginBottom: 8 }]}>{analytics.period.start} → {analytics.period.end} · {analytics.period.days} days</Text>
              <SectionTitle>Care overview</SectionTitle>
              <Row>
                <Card style={{ flex: 1 }}><Text style={T.h1}>{analytics.overview.medication.percentage}%</Text><Text style={[T.tiny, { fontWeight: '700' }]}>MEDICATION</Text><Text style={T.tiny}>{analytics.overview.medication.taken}/{analytics.overview.medication.scheduled} recorded as taken</Text></Card>
                <Card style={{ flex: 1 }}><Text style={T.h1}>{analytics.overview.exercise.percentage}%</Text><Text style={[T.tiny, { fontWeight: '700' }]}>EXERCISE</Text><Text style={T.tiny}>{analytics.overview.exercise.completed} sessions</Text></Card>
              </Row>
              <Row>
                <Card style={{ flex: 1 }}><Text style={T.h1}>{analytics.overview.checkIns.percentage}%</Text><Text style={[T.tiny, { fontWeight: '700' }]}>CHECK-INS</Text><Text style={T.tiny}>{analytics.overview.checkIns.completed}/{analytics.overview.checkIns.expected} days</Text></Card>
                <Card style={{ flex: 1 }}><Text style={[T.h1, { color: analytics.overview.falls ? C.danger : C.ink }]}>{analytics.overview.falls}</Text><Text style={[T.tiny, { fontWeight: '700' }]}>FALLS</Text><Text style={T.tiny}>recorded</Text></Card>
              </Row>
              <Card>
                <Text style={T.muted}>Taken {analytics.overview.medication.taken} · Missed {analytics.overview.medication.missed} · Delayed {analytics.overview.medication.delayed}</Text>
                <Text style={[T.muted, { marginTop: 4 }]}>Completed {analytics.overview.exercise.completed} · Partial {analytics.overview.exercise.partial} · Missed {analytics.overview.exercise.missed}</Text>
              </Card>

              <SectionTitle>Recorded symptom trend</SectionTitle>
              <Card>
                <PickerField label="Symptom" value={symType} onChange={setSymType} items={SYM_TYPES} />
                <SeverityChart records={analytics.symptoms?.[symType] || []} />
              </Card>

              <SectionTitle>Exercise activity</SectionTitle>
              <Card>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {(analytics.exerciseActivity || []).map((d) => (
                    <View key={d.date} style={{ width: 44, alignItems: 'center', padding: 6, borderRadius: 10, backgroundColor: d.sessions > 0 ? C.primarySoft : '#F1F5F3', borderWidth: 1, borderColor: d.sessions > 0 ? C.primary : C.line }}>
                      <Text style={{ fontWeight: '800', color: d.sessions > 0 ? C.primaryDark : C.muted }}>{d.sessions}</Text>
                      <Text style={T.tiny}>{d.date.slice(5)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[T.tiny, { marginTop: 6 }]}>Recorded sessions per day.</Text>
              </Card>

              <SectionTitle>What changed?</SectionTitle>
              {[
                { label: 'Exercise sessions', c: analytics.comparison.exerciseSessions, fmt: (v) => `${v} sessions` },
                { label: 'Medication records', c: analytics.comparison.medicationRecords, fmt: (v) => `${v} taken` },
                { label: 'Check-ins', c: analytics.comparison.checkIns, fmt: (v) => `${v} days` },
                { label: 'Walking difficulty', c: analytics.comparison.walkingDifficultyRecords, fmt: (v) => `${v} records` },
                { label: 'Tremor', c: analytics.comparison.tremorRecords, fmt: (v) => `${v} records` },
                { label: 'Falls', c: analytics.comparison.falls, fmt: (v) => `${v}` },
              ].map((r, i) => (
                <AttentionItem
                  key={i}
                  level={r.c.difference === 0 ? 'green' : (r.label === 'Walking difficulty' || r.label === 'Falls' || r.label === 'Tremor') ? (r.c.difference > 0 ? 'amber' : 'green') : (r.c.difference < 0 ? 'amber' : 'green')}
                  title={r.label}
                  detail={r.c.difference === 0 ? `No change (${r.fmt(r.c.current)} both periods)` : `${r.fmt(r.c.current)} this period vs ${r.fmt(r.c.previous)} previously`}
                />
              ))}

              <SectionTitle>Fall events</SectionTitle>
              {(analytics.falls || []).length === 0 && <Text style={T.muted}>0 falls recorded in this period.</Text>}
              {(analytics.falls || []).map((f, i) => (
                <Card key={i}><Text style={[T.body, { fontWeight: '700' }]}>⚠ Fall recorded — {new Date(f.at).toLocaleString()}</Text>{!!f.note && <Text style={T.muted}>{f.note}</Text>}</Card>
              ))}

              <SectionTitle>Caregiver observations</SectionTitle>
              {(analytics.observations || []).length === 0 && <Text style={T.muted}>None in this period.</Text>}
              {(analytics.observations || []).slice(0, 10).map((o, i) => (
                <Card key={i}><Text style={T.body}>{o.text || 'Observation'}</Text><Text style={T.tiny}>Caregiver reported · {new Date(o.at).toLocaleString()}</Text></Card>
              ))}
            </>
          )}

          <SectionTitle>Care summary</SectionTitle>
          <Card>
            {(ins?.summary?.paragraphs || []).map((p, i) => (
              <Text key={i} style={[T.body, { marginBottom: 8 }]}>{p}</Text>
            ))}
            <Btn title="Add summary to clinical note" kind="secondary" loading={busy === 'sum2note'} onPress={() => {
              const text = `Care summary (7 days):\n${(ins?.summary?.paragraphs || []).join('\n')}`;
              return run('sum2note', () => api.post('/notes', { patientId, note: text }), 'Summary saved as clinical note.');
            }} />
          </Card>

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
              <Text style={T.h3}>{r.type} report</Text>
              <Text style={T.muted}>
                {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                {'\n'}Exercise {r.summary?.exercise?.completionPct ?? '–'}% · Meds {r.summary?.meds?.adherencePct ?? '–'}%
              </Text>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
