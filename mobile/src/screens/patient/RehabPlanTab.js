import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../../lib/api';
import { Card, Btn, Field, Banner, Loader, Empty, Row, SectionTitle } from '../../ui';
import { C, T } from '../../theme';

export default function RehabPlanTab({ patientId, navigation, presetExercise }) {
  const [goals, setGoals] = useState([]);
  const [plan, setPlan] = useState({ ex: [], meds: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [showGoal, setShowGoal] = useState(false);
  const [gForm, setGForm] = useState({ title: '', description: '', target: '', reviewDate: '' });
  const [exForm, setExForm] = useState({ name: '', sets: '3', reps: '10', instructions: '', video: '' });
  const [editing, setEditing] = useState(null);
  const [editingSets, setEditingSets] = useState('3');
  const [editingReps, setEditingReps] = useState('10');
  const [editingInstr, setEditingInstr] = useState('');

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [g, ex, md] = await Promise.all([
        api.get(`/patients/${patientId}/goals`),
        api.get(`/patients/${patientId}/exercises`),
        api.get(`/patients/${patientId}/medicines`),
      ]);
      setGoals(g.data.data || []);
      setPlan({ ex: ex.data.data || [], meds: md.data.data || [] });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => {
    if (presetExercise) setExForm((f) => ({ ...f, name: presetExercise.name || '' }));
    load();
  }, [load, presetExercise]));

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

  const active = goals.filter((g) => g.status === 'active');
  const doneGoals = goals.filter((g) => g.status !== 'active');

  return (
    <View>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      {loading ? <Loader /> : (
        <>
          <SectionTitle>Goals ({active.length} active)</SectionTitle>
          {active.length === 0 && <Text style={T.muted}>No active goals yet.</Text>}
          {active.map((g) => (
            <Card key={g.id}>
              <Row between><Text style={T.h3}>{g.title}</Text></Row>
              {!!g.description && <Text style={T.muted}>{g.description}</Text>}
              {!!g.target && <Text style={[T.tiny, { marginTop: 2 }]}>Target: {g.target}</Text>}
              <Row>
                <View style={{ flex: 1 }}><Btn title="Achieved" kind="secondary" loading={busy === `g-${g.id}`} onPress={() => run(`g-${g.id}`, () => api.put(`/goals/${g.id}`, { status: 'achieved' }), 'Goal marked achieved.')} /></View>
                <View style={{ flex: 1 }}><Btn title="Pause" kind="ghost" onPress={() => run(`g-${g.id}`, () => api.put(`/goals/${g.id}`, { status: 'paused' }), 'Goal paused.')} /></View>
              </Row>
            </Card>
          ))}
          {doneGoals.length > 0 && <Text style={[T.tiny, { marginBottom: 6 }]}>{doneGoals.length} completed/paused goal(s) in history.</Text>}
          <Btn title={showGoal ? 'Cancel' : '+ New goal'} kind={showGoal ? 'secondary' : 'primary'} onPress={() => setShowGoal((s) => !s)} />
          {showGoal && (
            <Card>
              <Field label="Goal title" placeholder="e.g. Improve gait" value={gForm.title} onChangeText={(v) => setGForm({ ...gForm, title: v })} />
              <Field label="Description" placeholder="e.g. Walk 10m with supervision" value={gForm.description} onChangeText={(v) => setGForm({ ...gForm, description: v })} />
              <Row>
                <View style={{ flex: 1 }}><Field label="Target" placeholder="e.g. 0.8 m/s" value={gForm.target} onChangeText={(v) => setGForm({ ...gForm, target: v })} /></View>
                <View style={{ flex: 1 }}><Field label="Review (YYYY-MM-DD)" placeholder="2026-10-26" value={gForm.reviewDate} onChangeText={(v) => setGForm({ ...gForm, reviewDate: v })} /></View>
              </Row>
              <Btn title="Save goal" loading={busy === 'goal'} onPress={() => {
                if (gForm.title.trim().length < 2) return setError('Goal title needs at least 2 characters.');
                setGForm({ title: '', description: '', target: '', reviewDate: '' }); setShowGoal(false);
                return run('goal', () => api.post(`/patients/${patientId}/goals`, { title: gForm.title.trim(), description: gForm.description.trim() || undefined, target: gForm.target.trim() || undefined, reviewDate: gForm.reviewDate.trim() || undefined }), 'Goal added.');
              }} />
            </Card>
          )}

          <SectionTitle>Current exercises ({plan.ex.length})</SectionTitle>
          {plan.ex.length === 0 && <Text style={T.muted}>No exercises in the plan yet.</Text>}
          {plan.ex.map((a) => (
            <Card key={a.id}>
              {editing === a.id ? (
                <>
                  <Row>
                    <View style={{ flex: 1 }}><Field label="Sets" value={String(editingSets)} onChangeText={setEditingSets} keyboardType="numeric" /></View>
                    <View style={{ flex: 1 }}><Field label="Reps" value={String(editingReps)} onChangeText={setEditingReps} keyboardType="numeric" /></View>
                  </Row>
                  <Field label="Instructions" value={editingInstr} onChangeText={setEditingInstr} />
                  <Row>
                    <View style={{ flex: 1 }}><Btn title="Save" loading={busy === `e-${a.id}`} onPress={() => run(`e-${a.id}`, () => api.put(`/exercise-assignments/${a.id}`, { sets: +editingSets || 1, reps: +editingReps || 10, instructions: editingInstr || undefined }), 'Exercise updated.').then(() => setEditing(null))} /></View>
                    <View style={{ flex: 1 }}><Btn title="Cancel" kind="ghost" onPress={() => setEditing(null)} /></View>
                  </Row>
                </>
              ) : (
                <>
                  <Row between><Text style={T.h3}>{a.exercise?.name}</Text></Row>
                  <Text style={T.muted}>{a.sets} × {a.reps} · {a.frequency || 'daily'}{a.instructions ? `\n${a.instructions}` : ''}</Text>
                  <Row>
                    <TouchableOpacity onPress={() => { setEditing(a.id); setEditingSets(String(a.sets)); setEditingReps(String(a.reps)); setEditingInstr(a.instructions || ''); }} style={{ flex: 1, paddingVertical: 8, alignItems: 'center' }}>
                      <Text style={{ color: C.primary, fontWeight: '700' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => run(`rm-${a.id}`, () => api.delete(`/exercise-assignments/${a.id}`), 'Removed from plan.')} style={{ flex: 1, paddingVertical: 8, alignItems: 'center' }}>
                      <Text style={{ color: C.danger, fontWeight: '700' }}>{busy === `rm-${a.id}` ? 'Removing…' : 'Remove'}</Text>
                    </TouchableOpacity>
                  </Row>
                </>
              )}
            </Card>
          ))}

          <SectionTitle>Add exercise</SectionTitle>
          <Card>
            <Btn title="Choose from exercise library" kind="secondary" onPress={() => navigation.navigate('ExerciseLibrary', { patientId })} />
            <Text style={[T.muted, { textAlign: 'center', marginVertical: 6 }]}>— or write it directly —</Text>
            <Field label="Exercise name" placeholder="e.g. Sit-to-Stand" value={exForm.name} onChangeText={(v) => setExForm({ ...exForm, name: v })} />
            <Row>
              <View style={{ flex: 1 }}><Field label="Sets" value={exForm.sets} onChangeText={(v) => setExForm({ ...exForm, sets: v })} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="Reps" value={exForm.reps} onChangeText={(v) => setExForm({ ...exForm, reps: v })} keyboardType="numeric" /></View>
            </Row>
            <Field label="Instructions" placeholder="e.g. Near a stable support" value={exForm.instructions} onChangeText={(v) => setExForm({ ...exForm, instructions: v })} />
            <Field label="Demo video link (optional)" placeholder="YouTube link" value={exForm.video} onChangeText={(v) => setExForm({ ...exForm, video: v })} autoCapitalize="none" />
            <Btn title="Assign to plan" loading={busy === 'assign'} onPress={() => {
              if (exForm.name.trim().length < 2) return setError('Write the exercise name first.');
              setExForm({ name: '', sets: '3', reps: '10', instructions: '', video: '' });
              return run('assign', () => api.post('/exercise-assignments', { patientId, exerciseName: exForm.name.trim(), sets: +exForm.sets || 1, reps: +exForm.reps || 10, instructions: exForm.instructions || undefined, exerciseVideoUrl: exForm.video.trim() || undefined }), 'Exercise added to plan.');
            }} />
          </Card>

          {plan.meds.length > 0 && (
            <>
              <SectionTitle>Current medicines (info only)</SectionTitle>
              {plan.meds.map((a) => (
                <Card key={a.id}><Text style={T.body}>{a.medicine?.name} — {a.dosage}</Text></Card>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
}
