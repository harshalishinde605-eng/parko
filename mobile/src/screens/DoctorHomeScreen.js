import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../auth';
import { Screen, Card, Btn, Field, Banner, Loader, Empty, Row, Bar, AttentionItem, Hero, StatTile, SectionHead } from '../ui';
import { C, T } from '../theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso) {
  if (!iso) return 'No records yet';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 6e4);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

const ACT_ICON = { exercise: 'fitness', medication: 'medkit', symptom: 'pulse', observation: 'eye' };

export default function DoctorHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [stage, setStage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [{ data }, alerts] = await Promise.all([
        api.get('/doctor/dashboard'),
        api.get('/alerts?unread=true').catch(() => null),
      ]);
      setDash(data.data);
      if (alerts) setOpenAlerts((alerts.data.data || []).length);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (name.trim().length < 2) return setError('Patient name needs at least 2 characters.');
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/patients', { fullName: name.trim(), diagnosisStage: stage.trim() || undefined });
      setName(''); setStage(''); setShowAdd(false);
      navigation.navigate('PatientDetail', { patientId: data.data.id, patientName: data.data.fullName });
      load(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const ov = dash?.overview || {};
  const attention = dash?.attentionPatients || [];
  const snap = dash?.snapshot || null;
  const feed = dash?.recentActivity || [];
  const all = dash?.patients || [];
  const q = query.trim().toLowerCase();
  const filtered = q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  const first = (dash?.doctor?.name || user?.fullName || '').replace(/^dr\.?\s+/i, '').split(' ')[0];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Hero
        kicker="Doctor dashboard"
        title={`${greeting()}${first ? `, ${first}` : ''}`}
        sub="Recorded care across your patients, organized for review."
        right={<Ionicons name="medkit" size={30} color="rgba(255,255,255,0.9)" />}
      />
      {!!error && <Banner kind="danger">{error}</Banner>}
      <Row>
        <StatTile value={ov.totalPatients ?? 0} label="PATIENTS" />
        <StatTile value={ov.patientsNeedingAttention ?? 0} label="NEED REVIEW" color={(ov.patientsNeedingAttention || 0) ? C.warn : C.ok} />
      </Row>
      <Row>
        <StatTile value={ov.activePlans ?? 0} label="ACTIVE PLANS" />
        <StatTile value={openAlerts} label="OPEN ALERTS" color={openAlerts ? C.danger : C.ink} />
      </Row>

      {loading ? <Loader /> : (
        <>
          <SectionHead title="Needs your attention" />
          {attention.length === 0 && <Banner kind="ok">Nothing recorded needs review right now.</Banner>}
          {attention.slice(0, 5).map((a) => (
            <TouchableOpacity key={a.patientId} onPress={() => navigation.navigate('PatientDetail', { patientId: a.patientId, patientName: a.name })} activeOpacity={0.85}>
              <Card>
                <Row between>
                  <Text style={T.h2}>{a.name}</Text>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chevron-forward" size={20} color={C.primary} />
                  </View>
                </Row>
                {(a.attention || []).slice(0, 3).map((t, i) => (
                  <Text key={i} style={[T.body, { marginTop: 2 }]}>{t.level === 'red' ? '🔴' : t.level === 'amber' ? '🟠' : '🟢'} {t.title}</Text>
                ))}
                <Text style={[T.muted, { marginTop: 6 }]}>💊 Medication records: {a.medicationRate}%   🏃 Exercise: {a.exerciseRate}%{a.falls === 0 ? '   ✓ No falls recorded' : `   ⚠ ${a.falls} fall${a.falls > 1 ? 's' : ''} recorded`}</Text>
              </Card>
            </TouchableOpacity>
          ))}

          {snap && (
            <>
              <SectionHead title="Care snapshot" />
              <Card>
                <Row between><Text style={T.h2}>🧠 {snap.name}</Text></Row>
                <Text style={T.muted}>{snap.period?.from} → {snap.period?.to}{snap.cached ? ' · cached' : ''}</Text>
                <View style={{ marginTop: 8 }}>
                  <Row between><Text style={T.body}>Medication</Text><Text style={T.h3}>{snap.medication?.rate ?? 0}%</Text></Row>
                  <Bar pct={snap.medication?.rate ?? 0} color={C.info} />
                  <Row between><Text style={[T.body, { marginTop: 6 }]}>Exercise</Text><Text style={T.h3}>{snap.exercise?.rate ?? 0}%</Text></Row>
                  <Bar pct={snap.exercise?.rate ?? 0} />
                  <Row between><Text style={[T.body, { marginTop: 6 }]}>Check-ins</Text><Text style={T.h3}>{snap.checkins?.completed ?? 0}/{snap.checkins?.expected ?? 7}</Text></Row>
                  <Text style={[T.body, { marginTop: 6 }]}>Falls: {snap.falls ?? 0} · {snap.records?.sessions ?? 0} sessions · {snap.records?.walking ?? 0} walking records · {snap.records?.tremor ?? 0} tremor records</Text>
                </View>
                <Btn title="View full summary" kind="secondary" onPress={() => navigation.navigate('PatientDetail', { patientId: snap.patientId, patientName: snap.name, tab: 'rp' })} />
              </Card>
            </>
          )}

          <SectionHead title="Recent activity" />
          {feed.length === 0 && <Text style={T.muted}>No patient activity recorded yet.</Text>}
          {feed.slice(0, 6).map((f, i) => (
            <Card key={i}>
              <Row>
                <Ionicons name={ACT_ICON[f.kind] || 'ellipse'} size={20} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.tiny, { fontWeight: '700' }]}>{f.patientName} · {timeAgo(f.at)}</Text>
                  <Text style={[T.body, { fontWeight: '700' }]}>{f.title}</Text>
                  {!!f.detail && <Text style={T.muted}>{f.detail}</Text>}
                </View>
              </Row>
            </Card>
          ))}

          <SectionHead title={`All patients (${all.length})`} />
          <Field placeholder="Search registered patients…" value={query} onChangeText={setQuery} />
          {filtered.length === 0 && <Empty>{all.length ? 'No match for your search.' : 'No patients yet. Register your first patient below.'}</Empty>}
          {filtered.map((r) => (
            <TouchableOpacity key={r.patientId} onPress={() => navigation.navigate('PatientDetail', { patientId: r.patientId, patientName: r.name })} activeOpacity={0.85}>
              <Card>
                <Row between>
                  <View style={{ flex: 1 }}>
                    <Text style={T.h2}>{r.name}</Text>
                    {!!r.diagnosisStage && <Text style={T.muted}>{r.diagnosisStage}</Text>}
                  </View>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chevron-forward" size={20} color={C.primary} />
                  </View>
                </Row>
                <View style={{ marginTop: 8 }}>
                  <Text style={T.tiny}>MEDICATION {r.medicationRate}% · EXERCISE {r.exerciseRate}%</Text>
                  <Bar pct={r.medicationRate} color={C.info} />
                </View>
                <Text style={[T.tiny, { marginTop: 4 }]}>Last active: {timeAgo(r.lastActive)}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}
      <Btn title={showAdd ? 'Cancel' : '+ Register patient'} kind={showAdd ? 'secondary' : 'primary'} onPress={() => setShowAdd((s) => !s)} />
      {showAdd && (
        <Card>
          <Field label="Patient full name" placeholder="e.g. Suresh Pawar" value={name} onChangeText={setName} />
          <Field label="Diagnosis stage" placeholder="e.g. Stage 2" value={stage} onChangeText={setStage} />
          <Btn title="Register patient" onPress={create} loading={saving} />
        </Card>
      )}
    </Screen>
  );
}
