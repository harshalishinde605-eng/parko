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

function statusOf(r) {
  if (r.assessmentDue) return { label: 'Review due', color: C.warn, bg: C.warnSoft };
  if ((r.exerciseRate ?? 0) < 50) return { label: 'Needs review', color: C.danger, bg: C.dangerSoft };
  return { label: 'On Track', color: C.ok, bg: C.okSoft };
}

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
  const all = dash?.patients || [];
  const q = query.trim().toLowerCase();
  const filtered = q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  const first = (dash?.doctor?.name || user?.fullName || '').replace(/^dr\.?\s+/i, '').split(' ')[0];

  const work = [];
  for (const r of all.filter((x) => x.assessmentDue).slice(0, 3)) {
    work.push({ key: `due-${r.patientId}`, icon: 'clipboard', title: r.name, sub: r.lastAssessment ? 'Reassessment due — review assessment' : 'Initial assessment needed', go: () => navigation.navigate('PatientDetail', { patientId: r.patientId, patientName: r.name, tab: 'as' }), btn: 'Review Assessment' });
  }
  for (const r of all.filter((x) => !x.assessmentDue && (x.exerciseRate ?? 100) < 50).slice(0, 3)) {
    work.push({ key: `adh-${r.patientId}`, icon: 'trending-down', title: r.name, sub: `Exercise adherence ${r.exerciseRate}%`, go: () => navigation.navigate('PatientDetail', { patientId: r.patientId, patientName: r.name, tab: 'prog' }), btn: 'View Progress' });
  }
  for (const a of attention.filter((x) => (x.attention || []).some((t) => /difficult/i.test(t.title))).slice(0, 2)) {
    if (work.length >= 5) break;
    work.push({ key: `dif-${a.patientId}`, icon: 'alert-circle', title: a.name, sub: 'Patient reported increased difficulty', go: () => navigation.navigate('PatientDetail', { patientId: a.patientId, patientName: a.name }), btn: 'Review Patient' });
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Hero
        kicker="Physiotherapy dashboard"
        title={`${greeting()}${first ? `, ${first}` : ''}`}
        sub="Let's review your patients' rehabilitation progress."
        right={<Ionicons name="fitness" size={30} color="rgba(255,255,255,0.9)" />}
      />
      {!!error && <Banner kind="danger">{error}</Banner>}
      <Row>
        <StatTile value={ov.totalPatients ?? 0} label="PATIENTS" />
        <StatTile value={ov.activePlans ?? 0} label="ACTIVE PLANS" />
      </Row>
      <Row>
        <StatTile value={ov.assessmentsDue ?? 0} label="ASSESSMENTS DUE" color={(ov.assessmentsDue || 0) ? C.warn : C.ink} />
        <StatTile value={ov.patientsNeedingAttention ?? 0} label="NEED REVIEW" color={(ov.patientsNeedingAttention || 0) ? C.danger : C.ok} />
      </Row>

      {loading ? <Loader /> : (
        <>
          <SectionHead title="Today's physiotherapy work" />
          {work.length === 0 && <Banner kind="ok">Nothing scheduled — no reassessments due and adherence looks steady.</Banner>}
          {work.map((w) => (
            <Card key={w.key}>
              <Row>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={w.icon} size={22} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={T.h3}>{w.title}</Text>
                  <Text style={T.muted}>{w.sub}</Text>
                </View>
              </Row>
              <Btn title={w.btn} kind="secondary" onPress={w.go} />
            </Card>
          ))}

          <SectionHead title={`Patients (${all.length})`} />
          <Field placeholder="Search registered patients…" value={query} onChangeText={setQuery} />
          {filtered.length === 0 && <Empty>{all.length ? 'No match for your search.' : 'No patients yet. Register your first patient below.'}</Empty>}
          {filtered.map((r) => {
            const st = statusOf(r);
            return (
              <TouchableOpacity key={r.patientId} onPress={() => navigation.navigate('PatientDetail', { patientId: r.patientId, patientName: r.name })} activeOpacity={0.85}>
                <Card>
                  <Row between>
                    <View style={{ flex: 1 }}>
                      <Text style={T.h2}>{r.name}</Text>
                      <Text style={T.muted}>{r.diagnosisStage || 'Parkinson’s Disease'}</Text>
                    </View>
                    <View style={{ borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: st.bg }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: st.color }}>{st.label}</Text>
                    </View>
                  </Row>
                  <View style={{ marginTop: 8 }}>
                    <Text style={T.tiny}>EXERCISE ADHERENCE {r.exerciseRate ?? 0}%</Text>
                    <Bar pct={r.exerciseRate ?? 0} />
                  </View>
                  <Text style={[T.tiny, { marginTop: 4 }]}>Last assessment: {r.lastAssessment ? new Date(r.lastAssessment).toLocaleDateString() : 'none yet'}</Text>
                </Card>
              </TouchableOpacity>
            );
          })}
        </>
      )}
      <Btn title={showAdd ? 'Cancel' : '+ Register patient'} kind={showAdd ? 'secondary' : 'primary'} onPress={() => setShowAdd((s) => !s)} />
      {showAdd && (
        <Card>
          <Field label="Patient full name" placeholder="e.g. Suresh Pawar" value={name} onChangeText={setName} />
          <Field label="Parkinson's information" placeholder="e.g. Stage 2" value={stage} onChangeText={setStage} />
          <Btn title="Register patient" onPress={create} loading={saving} />
        </Card>
      )}
    </Screen>
  );
}
