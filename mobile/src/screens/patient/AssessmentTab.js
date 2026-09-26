import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../../lib/api';
import { Card, Btn, Field, Seg, Banner, Loader, Empty, Row } from '../../ui';
import { C, T } from '../../theme';

const PROBLEMS = ['Walking', 'Balance', 'Turning', 'Transfers', 'Strength', 'Flexibility', 'Endurance'];
const MODES = [
  { label: 'Initial', value: 'initial' },
  { label: 'Reassessment', value: 'reassessment' },
  { label: 'History', value: 'history' },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

export default function AssessmentTab({ patientId }) {
  const [mode, setMode] = useState('initial');
  const [list, setList] = useState([]);
  const [compare, setCompare] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [form, setForm] = useState({ tug: '', walkSpeed: '', sitToStand: '', balance: '', observations: '', notes: '', reviewDate: '' });
  const [problems, setProblems] = useState([]);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [l, c] = await Promise.all([
        api.get(`/patients/${patientId}/assessments`),
        api.get(`/patients/${patientId}/assessments/compare`).catch(() => ({ data: { data: null } })),
      ]);
      setList(l.data.data || []);
      setCompare(c.data.data || null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleProblem = (p) => setProblems((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const num = (v) => (v.trim() === '' ? undefined : Number(v));

  const save = async () => {
    setBusy('save'); setError(''); setOkMsg('');
    try {
      await api.post(`/patients/${patientId}/assessments`, {
        assessmentType: mode === 'reassessment' ? 'reassessment' : 'initial',
        tug: num(form.tug), walkSpeed: num(form.walkSpeed), sitToStand: form.sitToStand.trim() === '' ? undefined : parseInt(form.sitToStand, 10),
        balanceScore: form.balance.trim() === '' ? undefined : parseInt(form.balance, 10),
        problems, observations: form.observations.trim() || undefined, notes: form.notes.trim() || undefined,
        reviewDate: form.reviewDate.trim() || undefined,
      });
      setForm({ tug: '', walkSpeed: '', sitToStand: '', balance: '', observations: '', notes: '', reviewDate: '' });
      setProblems([]);
      setOkMsg(mode === 'reassessment' ? 'Reassessment saved and compared below.' : 'Initial assessment saved.');
      load(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const genSummary = async () => {
    setBusy('sum'); setError('');
    try {
      const { data } = await api.get(`/patients/${patientId}/summary`);
      setSummary(data.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const latest = list[0];
  const showForm = mode !== 'history';

  return (
    <View>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      <Seg options={MODES} value={mode} onChange={setMode} />
      {loading ? <Loader /> : (
        <>
          {latest && (
            <Card>
              <Row between><Text style={T.h3}>Last assessment</Text><Text style={T.tiny}>{fmtDate(latest.assessmentDate)} · {latest.assessmentType}</Text></Row>
              <Text style={[T.body, { marginTop: 6 }]}>
                {latest.tug != null ? `TUG ${latest.tug}s · ` : ''}{latest.walkSpeed != null ? `Gait ${latest.walkSpeed} m/s · ` : ''}{latest.sitToStand != null ? `STS ${latest.sitToStand} · ` : ''}{latest.balanceScore != null ? `Balance ${latest.balanceScore}/${latest.balanceMax || 28}` : ''}
                {latest.tug == null && latest.walkSpeed == null && latest.sitToStand == null && latest.balanceScore == null ? 'Measures recorded in notes.' : ''}
              </Text>
              {(latest.problems || []).length > 0 && <Text style={[T.muted, { marginTop: 4 }]}>Problems: {latest.problems.join(', ')}</Text>}
            </Card>
          )}
          {mode === 'history' ? (
            <>
              {list.length === 0 && <Empty>No assessments recorded yet.</Empty>}
              {list.map((a) => (
                <Card key={a.id}>
                  <Row between><Text style={T.h3}>{fmtDate(a.assessmentDate)}</Text><Text style={T.tiny}>{a.assessmentType}</Text></Row>
                  <Text style={T.body}>
                    {[a.tug != null ? `TUG ${a.tug}s` : null, a.walkSpeed != null ? `Gait ${a.walkSpeed} m/s` : null, a.sitToStand != null ? `STS ${a.sitToStand}` : null, a.balanceScore != null ? `Balance ${a.balanceScore}/${a.balanceMax || 28}` : null].filter(Boolean).join(' · ') || 'No measures'}
                  </Text>
                  {(a.problems || []).length > 0 && <Text style={T.muted}>Problems: {a.problems.join(', ')}</Text>}
                  {!!a.observations && <Text style={T.muted}>Obs: {a.observations}</Text>}
                  {!!a.notes && <Text style={T.muted}>Notes: {a.notes}</Text>}
                </Card>
              ))}
              {compare && compare.comparison && compare.comparison.length > 0 && (
                <Card>
                  <Text style={T.h3}>Previous vs current</Text>
                  {compare.comparison.map((c, i) => (
                    <Text key={i} style={[T.body, { marginTop: 4 }]}>• {c.text}</Text>
                  ))}
                </Card>
              )}
            </>
          ) : (
            <Card>
              <Text style={T.h3}>{mode === 'reassessment' ? 'New reassessment' : 'Initial assessment'}</Text>
              <Text style={[T.muted, { marginBottom: 8 }]}>Enter measured values only — never invent results.</Text>
              <Row>
                <View style={{ flex: 1 }}><Field label="TUG (sec)" value={form.tug} onChangeText={(v) => setForm({ ...form, tug: v })} keyboardType="numeric" placeholder="14.2" /></View>
                <View style={{ flex: 1 }}><Field label="Gait m/s" value={form.walkSpeed} onChangeText={(v) => setForm({ ...form, walkSpeed: v })} keyboardType="numeric" placeholder="0.82" /></View>
              </Row>
              <Row>
                <View style={{ flex: 1 }}><Field label="STS reps" value={form.sitToStand} onChangeText={(v) => setForm({ ...form, sitToStand: v })} keyboardType="numeric" placeholder="8" /></View>
                <View style={{ flex: 1 }}><Field label="Balance /28" value={form.balance} onChangeText={(v) => setForm({ ...form, balance: v })} keyboardType="numeric" placeholder="21" /></View>
              </Row>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>MAIN FUNCTIONAL PROBLEMS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {PROBLEMS.map((p) => (
                  <TouchableOpacity key={p} onPress={() => toggleProblem(p)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: problems.includes(p) ? C.primary : C.white, borderWidth: 1, borderColor: problems.includes(p) ? C.primary : C.line }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: problems.includes(p) ? C.white : C.ink }}>{problems.includes(p) ? '✓ ' : ''}{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Clinical observations" value={form.observations} onChangeText={(v) => setForm({ ...form, observations: v })} placeholder="e.g. Reduced arm swing" multiline />
              <Field label="Therapist notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Plan notes…" multiline />
              <Field label="Review date (YYYY-MM-DD)" value={form.reviewDate} onChangeText={(v) => setForm({ ...form, reviewDate: v })} placeholder="2026-10-26" />
              <Btn title="Save assessment" onPress={save} loading={busy === 'save'} />
            </Card>
          )}
          <Card>
            <Text style={T.h3}>Clinical documentation assistant</Text>
            <Text style={[T.muted, { marginVertical: 4 }]}>Summarizes recorded adherence, assessments and observations. You review before saving.</Text>
            {!summary ? (
              <Btn title="Generate AI summary" kind="secondary" onPress={genSummary} loading={busy === 'sum'} />
            ) : (
              <>
                {(summary.paragraphs || []).map((p, i) => <Text key={i} style={[T.body, { marginBottom: 6 }]}>{p}</Text>)}
                <Text style={T.tiny}>{summary.disclaimer || 'AI-generated from recorded data — review before use.'}</Text>
              </>
            )}
          </Card>
        </>
      )}
    </View>
  );
}
