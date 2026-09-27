import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Field, Banner, Loader, Row, ProgressBar, StatusBadge, SectionHead, EmptyState } from '../ui';
import { C, T } from '../theme';

export default function CalendarScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ patientId: '', title: 'Follow-up', date: '', time: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [{ data }, p] = await Promise.all([
        api.get('/appointments?upcoming=true'),
        api.get('/patients').catch(() => ({ data: { data: [] } })),
      ]);
      setItems(data.data || []);
      setPatients(p.data.data || []);
      if (!form.patientId && p.data.data?.[0]) setForm((f) => ({ ...f, patientId: p.data.data[0].id }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const todayKey = new Date().toISOString().slice(0, 10);
  const todays = items.filter((a) => String(a.scheduledAt).slice(0, 10) === todayKey);
  const upcoming = items.filter((a) => String(a.scheduledAt).slice(0, 10) !== todayKey);

  const create = async () => {
    if (!form.patientId) return setError('Select a patient first.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setError('Date must be YYYY-MM-DD.');
    if (!/^\d{2}:\d{2}$/.test(form.time)) return setError('Time must be HH:MM (24h).');
    setSaving(true); setError(''); setOkMsg('');
    try {
      await api.post('/appointments', {
        patientId: form.patientId, title: form.title.trim() || 'Follow-up',
        scheduledAt: new Date(`${form.date}T${form.time}:00`).toISOString(),
        notes: form.notes.trim() || undefined,
      });
      setForm({ patientId: patients[0]?.id || '', title: 'Follow-up', date: '', time: '', notes: '' });
      setShowAdd(false);
      setOkMsg('Appointment scheduled.');
      load(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    setError('');
    try {
      await api.put(`/appointments/${id}`, { status });
      load(true);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const renderRow = (a) => (
    <TouchableOpacity key={a.id} onPress={() => navigation.navigate('PatientDetail', { patientId: a.patientId, patientName: a.patientName })} activeOpacity={0.85}>
      <Card>
        <Row>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '800', color: C.primary, fontSize: 16 }}>{(a.patientName || '?').trim()[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.cardTitle}>{a.patientName}</Text>
            <Text style={T.muted}>{a.title} · {new Date(a.scheduledAt).toLocaleDateString()} {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          <StatusBadge label={a.status === 'scheduled' ? 'Upcoming' : a.status} tone={a.status === 'scheduled' ? 'info' : 'neutral'} />
        </Row>
        {a.status === 'scheduled' && (
          <Row>
            <View style={{ flex: 1 }}><Btn title="Done" kind="secondary" onPress={() => setStatus(a.id, 'completed')} /></View>
            <View style={{ flex: 1 }}><Btn title="Cancel" kind="ghost" onPress={() => setStatus(a.id, 'cancelled')} /></View>
          </Row>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Text style={T.display}>Calendar</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>Follow-ups and scheduled visits.</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      {loading ? <Loader /> : (
        <>
          <SectionHead title="Today" />
          {todays.length === 0 && <Text style={T.muted}>Nothing scheduled for today.</Text>}
          {todays.map(renderRow)}
          <SectionHead title="Upcoming" />
          {upcoming.length === 0 && <Text style={T.muted}>No upcoming appointments.</Text>}
          {upcoming.map(renderRow)}
        </>
      )}
      <Btn title={showAdd ? 'Cancel' : '+ New appointment'} kind={showAdd ? 'secondary' : 'primary'} onPress={() => setShowAdd((s) => !s)} />
      {showAdd && (
        <Card>
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>PATIENT</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {patients.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => setForm({ ...form, patientId: p.id })} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: form.patientId === p.id ? C.primary : C.white, borderWidth: 1, borderColor: form.patientId === p.id ? C.primary : C.line }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: form.patientId === p.id ? C.white : C.ink }}>{p.fullName}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Title" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Follow-up" />
          <Row>
            <View style={{ flex: 1 }}><Field label="Date (YYYY-MM-DD)" value={form.date} onChangeText={(v) => setForm({ ...form, date: v })} placeholder="2026-10-05" /></View>
            <View style={{ flex: 1 }}><Field label="Time (HH:MM)" value={form.time} onChangeText={(v) => setForm({ ...form, time: v })} placeholder="11:30" /></View>
          </Row>
          <Field label="Notes (optional)" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Bring walking aid" />
          <Btn title="Schedule" onPress={create} loading={saving} />
        </Card>
      )}
    </Screen>
  );
}
