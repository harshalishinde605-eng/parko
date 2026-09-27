import React, { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Field, Banner, Loader, EmptyState, Seg, SectionHead, Row } from '../ui';
import { C, T } from '../theme';

export default function AIDocsScreen({ route }) {
  const { patientId, patientName } = route.params || {};
  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [suggest, setSuggest] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const genSummary = useCallback(async () => {
    setBusy('sum'); setError('');
    try {
      const { data } = await api.get(`/patients/${patientId}/summary?days=28`);
      setSummary(data.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }, [patientId]);

  const genSuggest = useCallback(async () => {
    setBusy('sug'); setError('');
    try {
      const [{ data: ins }, { data: ch }] = await Promise.all([
        api.get(`/patients/${patientId}/insights?days=28`),
        api.get(`/patients/${patientId}/changes`),
      ]);
      const out = [];
      const adh = ins.data?.stats?.exercise?.completionPct ?? 100;
      if (adh < 70) out.push({ title: 'Adherence support', detail: `Exercise completion ${adh}% — review barriers with patient/caregiver.` });
      const walk = (ins.data?.stats?.walking ?? 0);
      if (walk >= 3) out.push({ title: 'Gait review', detail: `${walk} walking-difficulty records — consider gait-focused work.` });
      if ((ins.data?.stats?.falls ?? 0) > 0) out.push({ title: 'Safety review', detail: 'Fall(s) recorded — review home safety and supervision.' });
      const sev = (ins.data?.stats?.severe ?? 0);
      if (sev > 0) out.push({ title: 'Symptom review', detail: `${sev} severe entries — review in next session.` });
      const asmts = await api.get(`/patients/${patientId}/assessments`).catch(() => ({ data: { data: [] } }));
      if (!(asmts.data.data || []).length) out.push({ title: 'Schedule assessment', detail: 'No recorded assessment yet.' });
      if (!out.length) out.push({ title: 'Continue current plan', detail: 'Recorded data shows steady participation.' });
      setSuggest({ items: out, changes: ch.data?.changes || [] });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => {
    if (tab === 'summary' && !summary) genSummary();
    if (tab === 'plan' && !suggest) genSuggest();
  }, [tab, genSummary, genSuggest, summary, suggest]));

  const addToNote = () => {
    if (!summary?.paragraphs?.length) return;
    setNote((n) => (n ? `${n}\n\n` : '') + summary.paragraphs.join('\n'));
    setTab('note');
  };

  const saveNote = async () => {
    if (note.trim().length < 3) return setError('Note is too short.');
    setBusy('note'); setError(''); setOkMsg('');
    try {
      await api.post('/notes', { patientId, note: note.trim() });
      setNote('');
      setOkMsg('Clinical note saved. The AI text was reviewed by you before saving.');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Text style={T.h1}>AI Clinical Documentation</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>{patientName || 'Patient'} · generated only from recorded data.</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      <Seg options={[{ label: 'Generate Summary', value: 'summary' }, { label: 'Suggested Plan', value: 'plan' }, { label: 'Clinical Note', value: 'note' }]} value={tab} onChange={setTab} />

      {tab === 'summary' && (
        !summary ? <Loader />
        : (
          <Card>
            <Text style={[T.tiny, { fontWeight: '700' }]}>AI CLINICAL SUMMARY · LAST 4 WEEKS</Text>
            {(summary.paragraphs || []).map((p, i) => <Text key={i} style={[T.body, { marginTop: 8 }]}>• {p}</Text>)}
            <Text style={[T.tiny, { marginTop: 10 }]}>{summary.disclaimer || 'AI-generated from recorded data — review before use.'}</Text>
            <Btn title="Add to Clinical Note" onPress={addToNote} />
            <Btn title="Regenerate" kind="secondary" loading={busy === 'sum'} onPress={genSummary} />
          </Card>
        )
      )}

      {tab === 'plan' && (
        !suggest ? <Loader />
        : (
          <>
            <SectionHead title="Suggested focus areas" />
            {(suggest.items || []).map((s, i) => (
              <Card key={i}>
                <Text style={T.cardTitle}>{s.title}</Text>
                <Text style={[T.muted, { marginTop: 2 }]}>{s.detail}</Text>
              </Card>
            ))}
            <Text style={[T.tiny, { marginTop: 4 }]}>Rule-based prompts from recorded data — you decide the plan.</Text>
          </>
        )
      )}

      {tab === 'note' && (
        <Card>
          <Field label="Clinical note" placeholder="Write or paste the reviewed summary…" value={note} onChangeText={setNote} multiline />
          <Row>
            <View style={{ flex: 1 }}><Btn title="Insert summary" kind="secondary" onPress={() => { if (summary?.paragraphs?.length) setNote((n) => (n ? `${n}\n\n` : '') + summary.paragraphs.join('\n')); else genSummary().then(() => {}); }} /></View>
            <View style={{ flex: 1 }}><Btn title="Edit" kind="ghost" onPress={() => setOkMsg('Review the text above, then save.')} /></View>
          </Row>
          <Btn title="Approve & Save note" loading={busy === 'note'} onPress={saveNote} />
        </Card>
      )}
    </Screen>
  );
}
