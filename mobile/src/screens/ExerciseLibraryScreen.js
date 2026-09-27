import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Field, Banner, Loader, Empty, Row, Chip } from '../ui';
import { C, T } from '../theme';

const CATS = ['All', 'Gait', 'Balance', 'Strength', 'Transfers', 'Mobility', 'Flexibility', 'Endurance', 'Functional'];
const CAT_ICON = { Gait: 'footsteps', Balance: 'body', Strength: 'barbell', Transfers: 'accessibility', Mobility: 'walk', Flexibility: 'resize', Endurance: 'timer', Functional: 'fitness' };

function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

export default function ExerciseLibraryScreen({ navigation, route }) {
  const fromPatient = route.params?.patientId || null;
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', difficulty: '', description: '', precautions: '', videoUrl: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/exercises');
      setItems(data.data || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = query.trim().toLowerCase();
  const filtered = items.filter((x) => {
    if (cat !== 'All' && !(x.category || '').toLowerCase().includes(cat.toLowerCase())) return false;
    if (q && !`${x.name} ${x.description || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const create = async () => {
    if (form.name.trim().length < 2) return setError('Exercise name needs at least 2 characters.');
    setSaving(true); setError('');
    try {
      await api.post('/exercises', {
        name: form.name.trim(), category: form.category.trim() || undefined,
        difficulty: form.difficulty.trim() || undefined, description: form.description.trim() || undefined,
        precautions: form.precautions.trim() || undefined, videoUrl: form.videoUrl.trim() || undefined,
      });
      setForm({ name: '', category: '', difficulty: '', description: '', precautions: '', videoUrl: '' });
      setShowAdd(false);
      load(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Text style={[T.muted, { marginBottom: 12 }]}>Physiotherapy exercises with demonstration videos and safety notes.</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      <Field placeholder="Search exercises…" value={query} onChangeText={setQuery} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {CATS.map((c) => (
          <TouchableOpacity key={c} onPress={() => setCat(c)} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, backgroundColor: cat === c ? C.primary : C.white, borderWidth: 1, borderColor: cat === c ? C.primary : C.line }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: cat === c ? C.white : C.ink }}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <Loader /> : filtered.length === 0 ? (
        <Empty>No exercises found. Add the first one below.</Empty>
      ) : filtered.map((x) => (
        <TouchableOpacity key={x.id} onPress={() => setOpenId(openId === x.id ? null : x.id)} activeOpacity={0.85}>
          <Card>
            <Row>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={CAT_ICON[x.category] || 'fitness'} size={24} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={T.h3}>{x.name}</Text>
                <Text style={T.tiny}>{[x.category, x.difficulty].filter(Boolean).join(' · ') || 'General'}</Text>
              </View>
              <Ionicons name={openId === x.id ? 'chevron-up' : 'chevron-down'} size={20} color={C.muted} />
            </Row>
            {openId === x.id && (
              <View style={{ marginTop: 8 }}>
                {!!x.description && <Text style={[T.body, { marginBottom: 4 }]}>{x.description}</Text>}
                {!!x.precautions && <Banner kind="warn">Safety: {x.precautions}</Banner>}
                {!!x.videoUrl && (
                  <Btn title="Watch demonstration" kind="secondary" onPress={() => {
                    const yt = youtubeId(x.videoUrl);
                    Linking.openURL(yt ? `https://www.youtube.com/watch?v=${yt}` : x.videoUrl).catch(() => setError('Could not open the video link.'));
                  }} />
                )}
                {!!fromPatient && (
                  <Btn title="Add to patient plan" onPress={() => navigation.navigate('PatientDetail', { patientId: fromPatient, tab: 'plan', presetExercise: { id: x.id, name: x.name } })} />
                )}
              </View>
            )}
          </Card>
        </TouchableOpacity>
      ))}
      <Btn title={showAdd ? 'Cancel' : '+ New library exercise'} kind={showAdd ? 'secondary' : 'primary'} onPress={() => setShowAdd((s) => !s)} />
      {showAdd && (
        <Card>
          <Field label="Name" placeholder="e.g. Weight Shifting" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Row>
            <View style={{ flex: 1 }}><Field label="Category" placeholder="Balance" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} /></View>
            <View style={{ flex: 1 }}><Field label="Difficulty" placeholder="Beginner" value={form.difficulty} onChangeText={(v) => setForm({ ...form, difficulty: v })} /></View>
          </Row>
          <Field label="Description / purpose" placeholder="What it trains and how" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline />
          <Field label="Safety / precautions" placeholder="e.g. Near a stable support" value={form.precautions} onChangeText={setForm({ ...form, precautions: v })} multiline />
          <Field label="Demo video link (optional)" placeholder="YouTube link" value={form.videoUrl} onChangeText={(v) => setForm({ ...form, videoUrl: v })} autoCapitalize="none" />
          <Btn title="Save to library" onPress={create} loading={saving} />
        </Card>
      )}
    </Screen>
  );
}
