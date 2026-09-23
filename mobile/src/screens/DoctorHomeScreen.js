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

export default function DoctorHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
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
      const { data } = await api.get('/dashboard/doctor');
      setRows(data.data || []);
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

  const openAlerts = rows.reduce((n, r) => n + (r.openAlerts || 0), 0);
  const attention = [];
  rows.forEach((r) => (r.attention || []).forEach((a) => attention.push({ ...a, patient: r.patient })));
  const reds = attention.filter((a) => a.level === 'red');
  const ambers = attention.filter((a) => a.level === 'amber');
  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.patient.fullName.toLowerCase().includes(q)) : rows;
  const first = (user?.fullName || '').replace(/^dr\.?\s+/i, '').split(' ')[0];

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
        <StatTile value={rows.length} label="PATIENTS" />
        <StatTile value={openAlerts} label="OPEN ALERTS" color={openAlerts ? C.danger : C.ink} />
        <StatTile value={reds.length} label="URGENT" color={reds.length ? C.danger : C.ok} />
      </Row>

      {loading ? <Loader /> : (
        <>
          <SectionHead title="Needs your attention" />
          {attention.length === 0 && <Banner kind="ok">Nothing recorded needs review right now.</Banner>}
          {reds.concat(ambers).slice(0, 5).map((a, i) => (
            <AttentionItem
              key={i}
              level={a.level}
              sub={a.patient.fullName}
              title={a.title}
              detail={a.detail}
              onPress={() => navigation.navigate('PatientDetail', { patientId: a.patient.id, patientName: a.patient.fullName })}
            />
          ))}

          <SectionHead title={`Your patients (${rows.length})`} />
          <Field placeholder="Search registered patients…" value={query} onChangeText={setQuery} />
          {filtered.length === 0 && <Empty>{rows.length ? 'No match for your search.' : 'No patients yet. Register your first patient below.'}</Empty>}
          {filtered.map((r) => (
            <TouchableOpacity key={r.patient.id} onPress={() => navigation.navigate('PatientDetail', { patientId: r.patient.id, patientName: r.patient.fullName })} activeOpacity={0.85}>
              <Card>
                <Row between>
                  <View style={{ flex: 1 }}>
                    <Text style={T.h2}>{r.patient.fullName}</Text>
                    {!!r.patient.diagnosisStage && <Text style={T.muted}>{r.patient.diagnosisStage}</Text>}
                  </View>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chevron-forward" size={20} color={C.primary} />
                  </View>
                </Row>
                <View style={{ marginTop: 10 }}>
                  <Text style={T.tiny}>EXERCISE {r.exercise?.completionPct ?? 0}%</Text>
                  <Bar pct={r.exercise?.completionPct ?? 0} />
                  <Text style={[T.tiny, { marginTop: 6 }]}>MEDICATION {r.meds?.adherencePct ?? 0}%</Text>
                  <Bar pct={r.meds?.adherencePct ?? 0} color={C.info} />
                </View>
                {(r.attention || []).length > 0 && (
                  <Row><Ionicons name="alert-circle" size={14} color={r.attention[0].level === 'red' ? C.danger : C.warn} /><Text style={[T.tiny, { color: r.attention[0].level === 'red' ? C.danger : C.warn, fontWeight: '700' }]}>{r.attention[0].title}</Text></Row>
                )}
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
