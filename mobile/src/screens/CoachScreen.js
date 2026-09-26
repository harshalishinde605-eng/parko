import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Banner, Loader, Empty, Seg, SectionTitle, Row } from '../ui';
import { C, T } from '../theme';
import CoachAvatar from '../coach/CoachAvatar';
import { THEMES } from '../coach/modelUtil';

export default function CoachScreen({ route, navigation }) {
  const { assignmentId, patientId, exerciseId, exerciseName, category, patientGender, patientName, targetReps = 10, instructions } = route.params || {};
  const [demo, setDemo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState('slow');
  const [replayKey, setReplayKey] = useState(0);
  const [themeKey, setThemeKey] = useState('teal');
  const [gender, setGender] = useState((patientGender || '').toLowerCase().includes('female') ? 'female' : 'male');
  const [boneInfo, setBoneInfo] = useState(null);
  const [modelStatus, setModelStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get(`/exercises/${exerciseId}/demo`);
      setDemo(data.data);
      try {
        const raw = await SecureStore.getItemAsync(`avatar-theme-${patientId}`);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.themeKey && THEMES[saved.themeKey]) setThemeKey(saved.themeKey);
          if (saved.gender) setGender(saved.gender);
        }
      } catch { /* ignore */ }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [exerciseId, patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveTheme = async (key, g) => {
    setThemeKey(key); setGender(g);
    try { await SecureStore.setItemAsync(`avatar-theme-${patientId}`, JSON.stringify({ themeKey: key, gender: g })); } catch { /* ignore */ }
  };

  const res = demo?.resolution;
  const playable = res?.monitoringKey === 'sit-to-stand';
  const theme = THEMES[themeKey] || THEMES.teal;

  return (
    <Screen>
      <Text style={T.h1}>Your Exercise Coach</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>{patientName ? `${patientName} · ` : ''}{exerciseName}</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {loading ? <Loader /> : !res ? <Empty>Could not load demonstration info.</Empty> : (
        <>
          {playable ? (
            <>
              <CoachAvatar gender={gender} theme={theme} playing={playing} tempo={tempo} replayKey={replayKey} onStatus={setModelStatus} onBones={setBoneInfo} />
              {!!modelStatus && <Text style={[T.tiny, { marginVertical: 6 }]}>{modelStatus}</Text>}
              {boneInfo && !boneInfo.ok && (
                <Banner kind="warn">Avatar joints incomplete ({(boneInfo.missing || []).join(', ')}) — demonstration may look wrong. Manual logging still works.</Banner>
              )}
              <Card>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Btn title={playing ? 'Pause' : 'Play'} onPress={() => setPlaying((p) => !p)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Btn title="Replay" kind="secondary" onPress={() => { setReplayKey((k) => k + 1); setPlaying(true); }} />
                  </View>
                </Row>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 8, marginBottom: 6 }}>TEMPO</Text>
                <Seg options={[{ label: 'Slow', value: 'slow' }, { label: 'Moderate', value: 'moderate' }]} value={tempo} onChange={setTempo} />
                <Text style={T.tiny}>Drag to rotate · pinch to zoom. Demonstration only — follow your prescribed sets and reps.</Text>
              </Card>

              <SectionTitle>Your avatar</SectionTitle>
              <Card>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(THEMES).map(([key, t]) => (
                    <TouchableOpacity key={key} onPress={() => saveTheme(key, gender)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: themeKey === key ? C.primary : C.white, borderWidth: 1, borderColor: themeKey === key ? C.primary : C.line, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.primary }} />
                      <Text style={{ fontWeight: '700', color: themeKey === key ? C.white : C.ink, fontSize: 13 }}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginTop: 10, marginBottom: 6 }}>MODEL</Text>
                <Seg options={[{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }]} value={gender} onChange={(g) => saveTheme(themeKey, g)} />
              </Card>

              <Btn title="Start AI Exercise" onPress={() => navigation.navigate('AISession', { assignmentId, patientId, exerciseName, category, targetReps, instructions })} />
              <Btn title="Manual log instead" kind="ghost" onPress={() => navigation.navigate('Log')} />
            </>
          ) : (
            <Card>
              <Text style={T.h2}>3D demonstration</Text>
              <Text style={[T.body, { marginTop: 6 }]}>{res.status === 'COMPOSED' ? 'This exercise is understood, but its 3D demonstration is not built yet.' : '3D demonstration is not currently available for this exercise.'}</Text>
              <Text style={[T.muted, { marginTop: 6 }]}>{(res.notes || []).join(' ')}</Text>
              {!!instructions && <Text style={[T.body, { marginTop: 8 }]}>Instructions: {instructions}</Text>}
              <Btn title="Manual log instead" kind="secondary" onPress={() => navigation.navigate('Log')} />
            </Card>
          )}
          <Card>
            <Text style={T.tiny}>Demonstrations are movement visualizations, not medical guidance. Your doctor remains responsible for this exercise prescription.</Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
