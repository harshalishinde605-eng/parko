import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../auth';
import { Screen, Card, Btn, Field, Title, Banner, Loader, Empty, Chip, Row, Bar } from '../ui';
import { C, T } from '../theme';

export default function DoctorHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
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

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Title sub={`Signed in as ${user?.fullName || ''}`}>My patients</Title>
      {!!error && <Banner kind="danger">{error}</Banner>}
      <Row>
        <Card style={{ flex: 1 }}><Text style={T.h1}>{rows.length}</Text><Text style={T.muted}>Patients</Text></Card>
        <Card style={{ flex: 1 }}><Text style={[T.h1, { color: openAlerts ? C.danger : C.ink }]}>{openAlerts}</Text><Text style={T.muted}>Open alerts</Text></Card>
      </Row>
      {loading ? <Loader /> : rows.length === 0 ? (
        <Empty>No patients yet. Add your first patient below.</Empty>
      ) : rows.map((r) => (
        <TouchableOpacity key={r.patient.id} onPress={() => navigation.navigate('PatientDetail', { patientId: r.patient.id, patientName: r.patient.fullName })} activeOpacity={0.8}>
          <Card>
            <Row between>
              <Text style={T.h2}>{r.patient.fullName}</Text>
              <Ionicons name="chevron-forward" size={20} color={C.muted} />
            </Row>
            {!!r.patient.diagnosisStage && <Text style={T.muted}>{r.patient.diagnosisStage}</Text>}
            <View style={{ marginTop: 8 }}>
              <Text style={T.tiny}>EXERCISE {r.exercise?.completionPct ?? 0}%</Text>
              <Bar pct={r.exercise?.completionPct ?? 0} />
              <Text style={[T.tiny, { marginTop: 6 }]}>MEDICATION {r.meds?.adherencePct ?? 0}%</Text>
              <Bar pct={r.meds?.adherencePct ?? 0} color={C.info} />
            </View>
          </Card>
        </TouchableOpacity>
      ))}
      <Btn title={showAdd ? 'Cancel' : '+ Add patient'} kind={showAdd ? 'secondary' : 'primary'} onPress={() => setShowAdd((s) => !s)} />
      {showAdd && (
        <Card>
          <Field label="Patient full name" placeholder="e.g. Suresh Pawar" value={name} onChangeText={setName} />
          <Field label="Diagnosis stage" placeholder="e.g. Stage 2" value={stage} onChangeText={setStage} />
          <Btn title="Create patient" onPress={create} loading={saving} />
        </Card>
      )}
    </Screen>
  );
}
