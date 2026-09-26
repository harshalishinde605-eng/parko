import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { resolveAnalyzer } from '../exercise/registry';
import { initEstimator, estimatePose, toNormalized, disposeEstimator, decodeJpegFn } from '../exercise/PoseEstimator';
import { SnapshotFrameProvider } from '../exercise/FrameProvider';
import { SessionRecorder } from '../exercise/session';
import SkeletonOverlay from '../exercise/SkeletonOverlay';
import { C, T } from '../theme';

function b64ToBytes(b64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const out = [];
  let i = 0;
  while (i < clean.length) {
    const e1 = chars.indexOf(clean[i++]); const e2 = chars.indexOf(clean[i++]);
    const e3 = chars.indexOf(clean[i++]); const e4 = chars.indexOf(clean[i++]);
    const b1 = (e1 << 2) | (e2 >> 4);
    const b2 = ((e2 & 15) << 4) | (e3 >> 2);
    const b3 = ((e3 & 3) << 6) | e4;
    out.push(b1); if (e3 !== 64) out.push(b2); if (e4 !== 64) out.push(b3);
  }
  return new Uint8Array(out);
}

const REQUIRED_LABEL = { SEATED: 'Get seated to begin', RISING: 'Rising…', STANDING: 'Standing — hold', LOWERING: 'Lowering…' };

export default function AISessionScreen({ route, navigation }) {
  const { assignmentId, patientId, exerciseName, category, targetReps = 10, instructions } = route.params || {};
  const [{ analyzer, label }] = useState(() => resolveAnalyzer(exerciseName, category));
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState('init'); // init | guide | session | error
  const [initMsg, setInitMsg] = useState('Preparing…');
  const [initErr, setInitErr] = useState('');
  const [facing, setFacing] = useState('back');
  const [frame, setFrame] = useState(null); // {keypoints, w, h}
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const [conf, setConf] = useState(0);
  const [fps, setFps] = useState(0);
  const [guideStatus, setGuideStatus] = useState('Looking for you…');
  const [guideOk, setGuideOk] = useState(false);
  const [paused, setPaused] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const camRef = useRef(null);
  const providerRef = useRef(null);
  const recRef = useRef(null);
  const analyzerRef = useRef(analyzer);
  const stateRef = useRef({ phase: 'init', paused: false });

  useEffect(() => { stateRef.current.paused = paused; }, [paused]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initEstimator((m) => !cancelled && setInitMsg(m));
        if (!cancelled) setPhase('guide');
      } catch (e) {
        if (!cancelled) { setInitErr(e.message); setPhase('error'); }
      }
    })();
    return () => {
      cancelled = true;
      providerRef.current && providerRef.current.stop();
      disposeEstimator();
    };
  }, []);

  const estimateFromBase64 = async (b64) => {
    const decodeJpeg = decodeJpegFn();
    const bytes = b64ToBytes(b64);
    const tensor = decodeJpeg(bytes, 3);
    try {
      return await estimatePose(tensor);
    } finally {
      tensor.dispose && tensor.dispose();
    }
  };

  const requiredVisible = (kps, names) => {
    if (!kps) return { ok: false, missing: names };
    const missing = names.filter((n) => {
      const idx = { leftShoulder: 5, rightShoulder: 6, leftHip: 11, rightHip: 12, leftKnee: 13, rightKnee: 14, leftAnkle: 15, rightAnkle: 16 }[n];
      const kp = kps[idx];
      return !kp || (kp.score ?? 0) < 0.4;
    });
    return { ok: missing.length === 0, missing };
  };

  const startGuideLoop = () => {
    const names = analyzerRef.current ? analyzerRef.current.requiredLandmarks() : [];
    const provider = new SnapshotFrameProvider({ intervalMs: 900, quality: 0.3 });
    providerRef.current = provider;
    provider.start(camRef, async (b64) => {
      if (stateRef.current.phase !== 'guide') return;
      try {
        const est = await estimateFromBase64(b64);
        const kps = est ? toNormalized(est) : null;
        setFrame(kps ? { keypoints: kps, w: est.width, h: est.height } : null);
        if (!kps) { setGuideStatus('No person detected — step into frame'); setGuideOk(false); return; }
        const lower = ['leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'];
        const lowOk = requiredVisible(kps, lower).ok;
        const anyOk = requiredVisible(kps, names).ok;
        if (anyOk) { setGuideStatus('Full body detected — ready'); setGuideOk(true); }
        else if (!lowOk) { setGuideStatus('Lower body not visible — move back'); setGuideOk(false); }
        else { setGuideStatus('Move slightly to center yourself'); setGuideOk(false); }
      } catch { setGuideStatus('Looking for you…'); setGuideOk(false); }
    });
  };

  useEffect(() => {
    if (phase === 'guide' && permission?.granted) startGuideLoop();
    return () => { if (stateRef.current.phase === 'guide') { providerRef.current && providerRef.current.stop(); providerRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, permission?.granted]);

  const beginSession = () => {
    providerRef.current && providerRef.current.stop();
    recRef.current = new SessionRecorder({ targetReps, assignmentId });
    analyzerRef.current.reset();
    setReps(0);
    setStartedAt(Date.now());
    setPhase('session');
    stateRef.current.phase = 'session';
    const provider = new SnapshotFrameProvider({ intervalMs: 280, quality: 0.35 });
    providerRef.current = provider;
    const t0 = Date.now();
    provider.start(camRef, async (b64) => {
      if (stateRef.current.phase !== 'session' || stateRef.current.paused) return;
      try {
        const est = await estimateFromBase64(b64);
        const kps = est ? toNormalized(est) : null;
        setFrame(kps ? { keypoints: kps, w: est.width, h: est.height } : null);
        const arr = new Array(17).fill(null).map(() => ({ x: 0, y: 0, score: 0 }));
        (kps || []).forEach((k, i) => { arr[i] = { x: k.x, y: k.y, score: k.score ?? 0 }; });
        const r = analyzerRef.current.update(arr, Date.now());
        recRef.current.onResult(r);
        setReps(r.reps);
        setFeedback(r.feedback.slice(-2));
        setConf(r.confidence);
        if (Date.now() - t0 > 10 * 60 * 1000) finishSession('Session reached the 10-minute limit and was stopped.');
      } catch { /* frame skipped */ }
    }, (s) => setFps(s.fps));
  };

  const finishSession = (note) => {
    providerRef.current && providerRef.current.stop();
    stateRef.current.phase = 'done';
    const result = recRef.current.finish();
    navigation.replace('AIResult', {
      result, meta: { assignmentId, patientId, exerciseName, label, targetReps, instructions, startedAt, note },
    });
  };

  if (!analyzer) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={T.h2}>AI monitoring unavailable</Text>
        <Text style={[T.muted, { textAlign: 'center', marginTop: 8 }]}>“{exerciseName}” has no movement analyzer yet. Please use manual logging.</Text>
      </SafeAreaView>
    );
  }

  if (!permission) return <SafeAreaView style={s.center}><ActivityIndicator color={C.primary} /></SafeAreaView>;
  if (!permission.granted) {
    return (
      <SafeAreaView style={s.center}>
        <Ionicons name="camera" size={48} color={C.muted} />
        <Text style={[T.h2, { marginTop: 12 }]}>Camera needed</Text>
        <Text style={[T.muted, { textAlign: 'center', marginVertical: 8 }]}>The AI exercise monitor watches your movement on this phone only. No video is uploaded.</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}><Text style={s.btnT}>Allow camera</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (phase === 'init') {
    return <SafeAreaView style={s.center}><ActivityIndicator size="large" color={C.primary} /><Text style={[T.muted, { marginTop: 10 }]}>{initMsg}</Text></SafeAreaView>;
  }
  if (phase === 'error') {
    return (
      <SafeAreaView style={s.center}>
        <Text style={[T.h2, { textAlign: 'center' }]}>AI unavailable</Text>
        <Text style={[T.muted, { textAlign: 'center', marginVertical: 8 }]}>{initErr}</Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.goBack()}><Text style={s.btnT}>Use manual logging</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ paddingTop: 48, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>AI EXERCISE · {label}</Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{exerciseName}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Target {targetReps} · Detected {reps} · {Math.round(conf)}% confidence{fps ? ` · ${fps} fps` : ''}</Text>
      </View>
      <View style={{ flex: 1 }} onLayout={(e) => setViewSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <CameraView ref={camRef} style={{ flex: 1 }} facing={facing} />
        {phase === 'guide' && (
          <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: viewSize.w * 0.55, height: viewSize.h * 0.62, borderWidth: 3, borderColor: guideOk ? '#22c55e' : '#fff', borderRadius: 140, opacity: 0.9 }} />
          </View>
        )}
        {frame && viewSize.w > 0 && (
          <View style={{ ...StyleSheet.absoluteFillObject }}>
            <SkeletonOverlay keypoints={frame.keypoints} width={viewSize.w} height={viewSize.h} mirrored={facing === 'front'} />
          </View>
        )}
        <View style={{ position: 'absolute', bottom: 150, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800' }}>{reps}</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 }}>DETECTED REPS</Text>
        </View>
        {feedback.length > 0 && (
          <View style={{ position: 'absolute', bottom: 96, left: 16, right: 16, backgroundColor: 'rgba(11,110,79,0.92)', borderRadius: 12, padding: 10 }}>
            {feedback.map((f, i) => <Text key={i} style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{f}</Text>)}
          </View>
        )}
      </View>
      <View style={{ backgroundColor: '#111', padding: 14, paddingBottom: 26 }}>
        {phase === 'guide' ? (
          <>
            <Text style={{ color: guideOk ? '#22c55e' : '#fff', textAlign: 'center', fontWeight: '700', marginBottom: 10 }}>{guideStatus}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, opacity: guideOk ? 1 : 0.4 }]} disabled={!guideOk} onPress={beginSession}>
                <Text style={s.btnT}>Start exercise</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnGhost, { flex: 1 }]} onPress={() => { setFacing((f) => (f === 'back' ? 'front' : 'back')); }}>
                <Text style={s.btnGhostT}>Flip camera</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', marginBottom: 10 }}>
              {paused ? 'Paused' : REQUIRED_LABEL[analyzerRef.current?.state] || analyzerRef.current?.state}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[s.btnGhost, { flex: 1 }]} onPress={() => setPaused((p) => !p)}>
                <Text style={s.btnGhostT}>{paused ? 'Resume' : 'Pause'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnDanger, { flex: 1 }]} onPress={() => finishSession()}>
                <Text style={s.btnT}>Finish</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F2F7F5' },
  btn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center' },
  btnT: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGhost: { borderWidth: 1, borderColor: '#4b5563', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnGhostT: { color: '#fff', fontWeight: '700' },
  btnDanger: { backgroundColor: C.danger, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
});
