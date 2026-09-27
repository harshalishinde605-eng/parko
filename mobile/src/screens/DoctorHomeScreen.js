import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Btn, Field, Banner, Loader, Row, ProgressBar, StatusBadge, EmptyState } from '../ui';
import { C, T } from '../theme';

export default function DoctorHomeScreen({ navigation }) {
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
      const { data } = await api.get('/doctor/dashboard');
      setRows(data.data?.patients || []);
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

  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Text style={T.display}>Patients</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>{rows.length} under your care.</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      <Field placeholder="Search patient by name..." value={query} onChangeText={setQuery} />
      {loading ? <Loader /> : (
        <>
          {filtered.length === 0 && <EmptyState icon="people" title={rows.length ? 'No match found' : 'No patients yet'} sub={rows.length ? 'Try a different search.' : 'Register your first patient below.'} />}
          {filtered.map((r) => {
            const badge = r.assessmentDue
              ? { label: 'Review due', tone: 'warn' }
              : (r.exerciseRate ?? 0) < 50 ? { label: 'Needs review', tone: 'danger' } : { label: 'Active', tone: 'ok' };
            return (
              <TouchableOpacity key={r.patientId} onPress={() => navigation.navigate('PatientDetail', { patientId: r.patientId, patientName: r.name })} activeOpacity={0.85}>
                <Card>
                  <Row>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontWeight: '800', color: C.primary, fontSize: 18 }}>{(r.name || '?').trim()[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={T.cardTitle}>{r.name}</Text>
                      <Text style={T.muted}>{r.diagnosisStage || 'Parkinson’s Disease'}</Text>
                    </View>
                    <StatusBadge label={badge.label} tone={badge.tone} />
                  </Row>
                  <Text style={[T.label, { marginTop: 10 }]}>EXERCISE ADHERENCE</Text>
                  <Row>
                    <View style={{ flex: 1 }}><ProgressBar pct={r.exerciseRate ?? 0} /></View>
                    <Text style={[T.cardTitle, { minWidth: 52, textAlign: 'right' }]}>{r.exerciseRate ?? 0}%</Text>
                  </Row>
                  <Text style={[T.tiny, { marginTop: 6 }]}>Last assessment: {r.lastAssessment ? new Date(r.lastAssessment).toLocaleDateString() : 'none yet'}</Text>
                  <View style={{ alignItems: 'flex-end', marginTop: 2 }}>
                    <Ionicons name="chevron-forward" size={20} color={C.muted} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </>
      )}
      <Btn title={showAdd ? 'Cancel' : '+ Register Patient'} kind={showAdd ? 'secondary' : 'primary'} onPress={() => setShowAdd((s) => !s)} />
      {showAdd && (
        <Card>
          <Field label="Patient full name" placeholder="e.g. Ramesh Sharma" value={name} onChangeText={setName} />
          <Field label="Parkinson's stage" placeholder="e.g. Stage 2" value={stage} onChangeText={setStage} />
          <Btn title="Register patient" onPress={create} loading={saving} />
        </Card>
      )}
    </Screen>
  );
}
