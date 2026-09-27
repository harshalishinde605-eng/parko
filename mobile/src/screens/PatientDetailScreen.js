import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Field, Banner, Loader, SectionHead, Chip, Row, Bar, Dots, AttentionItem, StatTile, TabSelector, TimelineItem, EmptyState } from '../ui';
import { C, T } from '../theme';
import AssessmentTab from './patient/AssessmentTab';
import RehabPlanTab from './patient/RehabPlanTab';
import ProgressTab from './patient/ProgressTab';

const TABS = [
  { label: 'Overview', value: 'ov' },
  { label: 'Assessment', value: 'as' },
  { label: 'Rehab Plan', value: 'plan' },
  { label: 'Progress', value: 'prog' },
  { label: 'Timeline', value: 'tl' },
];

const KIND_ICON = { exercise: 'fitness', medication: 'medkit', symptom: 'pulse', observation: 'eye', note: 'document-text', alert: 'notifications', assessment: 'clipboard' };
const KIND_LABEL = { exercise: 'Exercise', medication: 'Medication', symptom: 'Symptom', observation: 'Observation', note: 'Doctor note', alert: 'Alert', assessment: 'Assessment' };

function ageOf(dob) {
  if (!dob) return '';
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
  return y > 0 && y < 130 ? `${y} yrs` : '';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

export default function PatientDetailScreen({ route, navigation }) {
  const { patientId } = route.params;
  const [tab, setTab] = useState(route.params?.tab || 'ov');
  useEffect(() => { if (route.params?.tab) setTab(route.params.tab); }, [route.params?.tab]);
  const [patient, setPatient] = useState(null);
  const [team, setTeam] = useState({ caregivers: [], doctors: [] });
  const [ins, setIns] = useState(null);
  const [timeline, setTimeline] = useState({ groups: {} });
  const [plan, setPlan] = useState({ ex: [], meds: [] });
  const [assessments, setAssessments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [obsMonth, setObsMonth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(null);
  const [tlFilter, setTlFilter] = useState('all');

  const [cgEmail, setCgEmail] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [p, i, tl, tm, pex, pmed, asm, gl, ob] = await Promise.all([
        api.get(`/patients/${patientId}`),
        api.get(`/patients/${patientId}/insights?days=7`),
        api.get(`/patients/${patientId}/timeline?days=7`),
        api.get(`/patients/${patientId}/care-team`),
        api.get(`/patients/${patientId}/exercises`).catch(() => ({ data: { data: [] } })),
        api.get(`/patients/${patientId}/medicines`).catch(() => ({ data: { data: [] } })),
        api.get(`/patients/${patientId}/assessments`).catch(() => ({ data: { data: [] } })),
        api.get(`/patients/${patientId}/goals`).catch(() => ({ data: { data: [] } })),
        api.get(`/patients/${patientId}/observations`).catch(() => ({ data: { data: [] } })),
      ]);
      setPatient(p.data.data);
      setIns(i.data.data);
      setTimeline(tl.data.data);
      setTeam(tm.data.data);
      setPlan({ ex: pex.data.data || [], meds: pmed.data.data || [] });
      setAssessments(asm.data.data || []);
      setGoals(gl.data.data || []);
      setObsMonth((ob.data.data || []).filter((o) => Date.now() - new Date(o.loggedAt).getTime() < 30 * 864e5));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
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
  const st = ins?.stats;
  const cg = team.caregivers[0];
  const latestAsmt = assessments[0];
  const activeGoals = goals.filter((g) => g.status === 'active');
  const fallsMonth = obsMonth.filter((o) => o.falls).length;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Card>
        <Row between>
          <View style={{ flex: 1 }}>
            <Text style={T.cardTitle}>{patient?.fullName || 'Patient'}</Text>
            <Text style={[T.muted, { marginTop: 2 }]}>{[ageOf(patient?.dob), patient?.diagnosisStage || 'Parkinson’s Disease'].filter(Boolean).join('  •  ')}</Text>
            <Text style={[T.tiny, { marginTop: 4 }]}>{cg ? `Caregiver: ${cg.fullName}` : 'No caregiver linked'}</Text>
          </View>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person" size={26} color={C.primary} />
          </View>
        </Row>
      </Card>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      <TabSelector options={TABS} value={tab} onChange={setTab} />

      {tab === 'ov' && (
        <>
          <SectionHead title="Primary concerns" />
          {(latestAsmt?.problems || []).length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {latestAsmt.problems.map((p, i) => (
                <View key={i} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: C.warnSoft, borderWidth: 1, borderColor: C.warn }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.warn }}>{p}</Text>
                </View>
              ))}
            </View>
          ) : <Text style={T.muted}>No recorded assessment yet — capture one in the Assessment tab.</Text>}

          <SectionHead title="Current rehabilitation status" />
          <Row>
            <StatTile value={`${st?.exercise?.completionPct ?? 0}%`} label="ADHERENCE" />
            <StatTile value={latestAsmt ? fmtDate(latestAsmt.assessmentDate) : '—'} label="LAST ASSESSMENT" />
          </Row>
          <Row>
            <StatTile value={latestAsmt?.reviewDate ? fmtDate(latestAsmt.reviewDate) : '—'} label="NEXT REVIEW" />
            <StatTile value={fallsMonth} label="FALLS 30D" color={fallsMonth ? C.danger : C.ink} />
          </Row>

          <SectionHead title={`Current goals (${activeGoals.length})`} />
          {activeGoals.length === 0 && <Text style={T.muted}>No active goals — set them in the Rehab Plan tab.</Text>}
          {activeGoals.slice(0, 3).map((g) => (
            <Card key={g.id}><Text style={T.body}>• {g.title}{g.target ? ` (${g.target})` : ''}</Text></Card>
          ))}

          <SectionHead title="Current plan" />
          <Card>
            {(plan.ex.length === 0 && plan.meds.length === 0) && <Text style={T.muted}>No active plan yet.</Text>}
            {plan.ex.slice(0, 3).map((a) => <Text key={a.id} style={[T.body, { marginBottom: 4 }]}>{a.exercise?.name} — {a.sets}×{a.reps}</Text>)}
            {plan.ex.length > 3 && <Text style={T.tiny}>+{plan.ex.length - 3} more…</Text>}
            <Btn title="View full rehab plan" kind="secondary" onPress={() => setTab('plan')} />
          </Card>

          <SectionHead title="Recent activity" />
          {(() => {
            const flat = Object.entries(timeline.groups || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1)).flatMap(([d, items]) => items.slice(0, 3).map((it) => ({ ...it, day: d }))).slice(0, 3);
            if (!flat.length) return <Text style={T.muted}>No care activity recorded yet.</Text>;
            return flat.map((it, i) => (
              <Card key={i}>
                <Text style={[T.tiny, { fontWeight: '700' }]}>{it.day} · {new Date(it.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                <Text style={[T.body, { fontWeight: '700' }]}>{it.title}</Text>
                {!!it.source && <Text style={T.tiny}>{it.source}</Text>}
              </Card>
            ));
          })()}

          <SectionHead title="Care & notes" />
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

      {tab === 'as' && <AssessmentTab patientId={patientId} />}

      {tab === 'plan' && <RehabPlanTab patientId={patientId} navigation={navigation} presetExercise={route.params?.presetExercise} />}

      {tab === 'prog' && <ProgressTab patientId={patientId} navigation={navigation} />}

      {tab === 'tl' && (
        <>
          <SectionHead title="Care timeline" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 20 }} style={{ marginBottom: 10, marginHorizontal: -20, paddingHorizontal: 20 }}>
            {[{ label: 'All', value: 'all' }, { label: 'Assessment', value: 'assessment' }, { label: 'Exercise', value: 'exercise' }, { label: 'Feedback', value: 'feedback' }, { label: 'Observation', value: 'observation' }, { label: 'Notes', value: 'note' }, { label: 'Alerts', value: 'alert' }].map((f) => (
              <TouchableOpacity key={f.value} onPress={() => setTlFilter(f.value)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: tlFilter === f.value ? C.primary : C.white, borderWidth: 1, borderColor: tlFilter === f.value ? C.primary : C.line }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: tlFilter === f.value ? C.white : C.ink }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {(() => {
            const matchKind = (it) => {
              if (tlFilter === 'all') return true;
              if (tlFilter === 'feedback') return it.kind === 'exercise';
              return it.kind === tlFilter;
            };
            const entries = Object.entries(timeline.groups || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1))
              .map(([day, items]) => [day, items.filter(matchKind)])
              .filter(([, items]) => items.length);
            if (!entries.length) return <EmptyState icon="time" title="No activity yet" sub="No care activity recorded yet for this filter." />;
            return entries.map(([day, items]) => (
              <View key={day}>
                <Text style={[T.h3, { marginTop: 10, marginBottom: 6 }]}>{day}</Text>
                {items.map((it, i) => (
                  <TimelineItem
                    key={it.id || i}
                    last={i === items.length - 1}
                    time={`${new Date(it.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    title={it.title}
                    detail={it.detail}
                    source={it.source}
                    icon={KIND_ICON[it.kind] || 'ellipse'}
                    tone={it.level === 'red' ? 'danger' : it.level === 'amber' ? 'warn' : it.level === 'info' ? 'info' : 'ok'}
                  />
                ))}
              </View>
            ));
          })()}
        </>
      )}
    </Screen>
  );
}
