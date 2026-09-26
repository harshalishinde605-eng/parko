import React, { useState } from 'react';
import { View, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Banner, SectionTitle, Row } from '../ui';
import { T } from '../theme';

function fmtDur(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function AISessionResultScreen({ route, navigation }) {
  const { result, meta } = route.params;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [savedId, setSavedId] = useState(null);

  const payload = () => ({
    assignmentId: meta.assignmentId,
    patientId: meta.patientId,
    status: result.detectedReps > 0 ? 'completed' : 'missed',
    repsDone: result.detectedReps,
    durationMin: Math.max(1, Math.round(result.durationSec / 60)),
    remarks: `AI-assisted session: ${result.detectedReps} detected rep(s) of ${meta.targetReps} target.`,
    aiAssisted: true,
    detectedReps: result.detectedReps,
    durationSec: result.durationSec,
    avgConfidence: result.avgConfidence,
    romSummary: result.romSummary,
    formNotes: (result.formNotes || []).join(' | ').slice(0, 1000) || undefined,
  });

  const save = async (retryBody) => {
    setBusy(true); setError(''); setOkMsg('');
    try {
      const body = retryBody || payload();
      const { data } = await api.post('/exercise-logs', body);
      setSavedId(data.data.id);
      try {
        const raw = await SecureStore.getItemAsync('pendingAiSessions');
        const list = raw ? JSON.parse(raw) : [];
        const rest = list.filter((p) => JSON.stringify(p) !== JSON.stringify(body));
        await SecureStore.setItemAsync('pendingAiSessions', JSON.stringify(rest));
      } catch { /* ignore */ }
      setOkMsg('Session recorded. The doctor can now see it in history, timeline and reports.');
    } catch (e) {
      try {
        const raw = await SecureStore.getItemAsync('pendingAiSessions');
        const list = raw ? JSON.parse(raw) : [];
        list.push(retryBody || payload());
        await SecureStore.setItemAsync('pendingAiSessions', JSON.stringify(list));
        setError(`${errMsg(e)} Session kept on this phone — tap Retry when online.`);
      } catch {
        setError(errMsg(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={T.h1}>AI-assisted session</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>{meta.exerciseName} · {new Date(meta.startedAt || Date.now()).toLocaleString()}</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      {!!meta.note && <Banner kind="warn">{meta.note}</Banner>}
      <Row>
        <Card style={{ flex: 1 }}><Text style={T.h1}>{result.detectedReps}</Text><Text style={[T.tiny, { fontWeight: '700' }]}>DETECTED / {meta.targetReps}</Text></Card>
        <Card style={{ flex: 1 }}><Text style={T.h1}>{fmtDur(result.durationSec)}</Text><Text style={[T.tiny, { fontWeight: '700' }]}>DURATION</Text></Card>
      </Row>
      <Row>
        <Card style={{ flex: 1 }}><Text style={T.h1}>{result.consistencyPct}%</Text><Text style={[T.tiny, { fontWeight: '700' }]}>CONSISTENCY</Text></Card>
        <Card style={{ flex: 1 }}><Text style={T.h1}>{result.avgConfidence}%</Text><Text style={[T.tiny, { fontWeight: '700' }]}>CONFIDENCE</Text></Card>
      </Row>
      <Card>
        <Text style={T.h3}>Movement observations</Text>
        <Text style={[T.body, { marginTop: 4 }]}>{result.romSummary}</Text>
        {(result.formNotes || []).map((f, i) => <Text key={i} style={[T.body, { marginTop: 4 }]}>• {f}</Text>)}
        {!!result.invalidAttempts && <Text style={[T.muted, { marginTop: 6 }]}>{result.invalidAttempts} incomplete attempt(s) were not counted.</Text>}
      </Card>
      <Card>
        <Text style={T.tiny}>AI-assisted movement feedback only. Repetition counts are detected observations, not a medical assessment, and do not replace professional clinical guidance.</Text>
      </Card>
      {!savedId
        ? <Btn title="Save session" onPress={() => save()} loading={busy} />
        : <Btn title="Done — back to Today" onPress={() => navigation.popToTop()} />}
      {!savedId && <Btn title="Retry pending saves" kind="secondary" onPress={async () => {
        try {
          const raw = await SecureStore.getItemAsync('pendingAiSessions');
          const list = raw ? JSON.parse(raw) : [];
          if (!list.length) { setOkMsg('Nothing pending.'); return; }
          await save(list[0]);
        } catch (e) { setError(errMsg(e)); }
      }} />}
    </Screen>
  );
}
