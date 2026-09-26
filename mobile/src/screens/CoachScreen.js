import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Banner, Loader, Empty, Seg, SectionTitle, Row } from '../ui';
import { C, T } from '../theme';

function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

const TEMPO_SECS = {
  slow: { prepare: 5, move: 5, hold: 3, back: 5 },
  moderate: { prepare: 3, move: 3, hold: 2, back: 3 },
};

function phasesFor(resolution) {
  const prims = resolution?.primitives || [];
  const moves = prims.filter((p) => p.kind === 'movement');
  if (resolution?.status === 'SUPPORTED' || moves.length === 0) {
    return [
      { key: 'prepare', label: 'Get into position', icon: 'accessibility' },
      { key: 'move', label: moves[0] ? `${cap(moves[0].action)} ${moves[0].joint}` : 'Perform the movement', icon: 'fitness' },
      { key: 'hold', label: 'Hold steady', icon: 'pause' },
      { key: 'back', label: 'Return slowly', icon: 'return-down-back' },
    ];
  }
  const m = moves[0];
  return [
    { key: 'prepare', label: `Prepare (${(prims.find((p) => p.kind === 'position') || {}).value || 'start position'})`, icon: 'accessibility' },
    { key: 'move', label: `${cap(m.action)} ${m.joint}`, icon: 'fitness' },
    { key: 'hold', label: 'Hold steady', icon: 'pause' },
    { key: 'back', label: 'Return slowly', icon: 'return-down-back' },
  ];
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

export default function CoachScreen({ route, navigation }) {
  const { assignmentId, patientId, exerciseId, exerciseName, category, patientName, targetReps = 10, instructions } = route.params || {};
  const [demo, setDemo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tempo, setTempo] = useState('slow');
  // guided timer state
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rep, setRep] = useState(1);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get(`/exercises/${exerciseId}/demo`);
      setDemo(data.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const res = demo?.resolution;
  const videoUrl = demo?.exercise?.videoUrl;
  const yt = youtubeId(videoUrl);
  const phases = phasesFor(res);
  const T = TEMPO_SECS[tempo];

  const stop = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; setRunning(false); setPaused(false); };
  const clockRef = useRef({ r: 1, pi: 0, remain: 0 });

  const tick = () => {
    const c = clockRef.current;
    const seq = ['prepare', 'move', 'hold', 'back'];
    const T = TEMPO_SECS[tempoRef.current];
    c.remain -= 1;
    if (c.remain > 0) { setLeft(c.remain); return; }
    c.pi += 1;
    if (c.pi >= seq.length) {
      c.pi = 1; // later reps skip prepare
      c.r += 1;
      if (c.r > targetRepsRef.current) { stop(); setDone(true); return; }
      setRep(c.r);
    }
    setPhaseIdx(c.pi);
    c.remain = T[seq[c.pi]];
    setLeft(c.remain);
  };
  const tempoRef = useRef(tempo);
  const targetRepsRef = useRef(targetReps);
  tempoRef.current = tempo;
  targetRepsRef.current = targetReps;

  const start = () => {
    stop(); setDone(false);
    clockRef.current = { r: 1, pi: 0, remain: TEMPO_SECS[tempo].prepare };
    setRep(1); setPhaseIdx(0); setLeft(TEMPO_SECS[tempo].prepare);
    setRunning(true); setPaused(false);
    timerRef.current = setInterval(tick, 1000);
  };

  const pause = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; setPaused(true); };
  const resume = () => { if (!paused) return; setPaused(false); timerRef.current = setInterval(tick, 1000); };

  const phase = phases[phaseIdx] || phases[0];

  return (
    <Screen>
      <Text style={T.h1}>Exercise guide</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>{patientName ? `${patientName} · ` : ''}{exerciseName}</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {loading ? <Loader /> : !res ? <Empty>Could not load guide info.</Empty> : (
        <>
          <SectionTitle>Demonstration video</SectionTitle>
          {yt ? (
            <View style={{ height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 12, backgroundColor: '#000' }}>
              <WebView source={{ uri: `https://www.youtube.com/embed/${yt}?rel=0` }} allowsFullscreenVideo style={{ flex: 1 }} />
            </View>
          ) : videoUrl ? (
            <Card>
              <Text style={T.body}>A demo link is attached to this exercise.</Text>
              <Btn title="Open video in browser" kind="secondary" onPress={() => Linking.openURL(videoUrl).catch(() => setError('Could not open the video link.'))} />
            </Card>
          ) : (
            <Banner kind="warn">No demonstration video attached yet. Ask your doctor to add one, or follow the steps below.</Banner>
          )}

          <SectionTitle>Steps</SectionTitle>
          {phases.map((p, i) => (
            <Card key={p.key} style={running && phaseIdx === i ? { borderColor: C.primary, borderWidth: 2 } : null}>
              <Row>
                <Ionicons name={p.icon} size={22} color={running && phaseIdx === i ? C.primary : C.muted} />
                <Text style={[T.body, { fontWeight: '700' }]}>{i + 1}. {p.label}</Text>
              </Row>
            </Card>
          ))}
          {!!instructions && (
            <Card><Text style={T.h3}>Doctor's instructions</Text><Text style={[T.body, { marginTop: 4 }]}>{instructions}</Text></Card>
          )}

          <SectionTitle>Guided session ({targetReps} reps, {tempo})</SectionTitle>
          <Card>
            {!running && !done && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>TEMPO</Text>
                <Seg options={[{ label: 'Slow', value: 'slow' }, { label: 'Moderate', value: 'moderate' }]} value={tempo} onChange={setTempo} />
                <Btn title="Start guided session" onPress={start} />
              </>
            )}
            {running && (
              <>
                <Text style={[T.h2, { textAlign: 'center' }]}>Rep {rep} / {targetReps}</Text>
                <Text style={[{ textAlign: 'center', fontSize: 20, fontWeight: '800', color: C.primary, marginVertical: 6 }]}>{phase.label}</Text>
                <Text style={[{ textAlign: 'center', fontSize: 44, fontWeight: '800', color: C.ink }]}>{left}s</Text>
                <Row>
                  <View style={{ flex: 1 }}><Btn title={paused ? 'Resume' : 'Pause'} kind="secondary" onPress={() => (paused ? resume() : pause())} /></View>
                  <View style={{ flex: 1 }}><Btn title="Stop" kind="ghost" onPress={stop} /></View>
                </Row>
                {paused && <Text style={[T.muted, { textAlign: 'center', marginTop: 6 }]}>Paused — resume restarts the current step.</Text>}
              </>
            )}
            {done && <Banner kind="ok">Guided session complete — {targetReps} reps done. Now log it or start an AI-monitored session.</Banner>}
          </Card>

          <Btn title="Start AI Exercise" onPress={() => navigation.navigate('AISession', { assignmentId, patientId, exerciseName, category, targetReps, instructions })} />
          <Btn title="Manual log instead" kind="ghost" onPress={() => navigation.navigate('Log')} />
          <Card>
            <Text style={T.tiny}>Guides demonstrate movement only and are not medical advice. Your doctor remains responsible for this exercise prescription.</Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
