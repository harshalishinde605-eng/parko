import React, { useCallback, useState } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Title, Banner, Loader, Empty, Chip, Row, SectionTitle, Btn } from '../ui';
import { T } from '../theme';

function group(alerts) {
  return {
    review: alerts.filter((a) => !a.isRead && a.severity === 'critical'),
    attention: alerts.filter((a) => !a.isRead && a.severity !== 'critical'),
    info: alerts.filter((a) => a.isRead || a.severity === 'info'),
  };
}

export default function AlertsScreen({ navigation }) {
  const canOpenPatient = () => {
    try { return (navigation.getState()?.routeNames || []).includes('PatientDetail'); } catch { return false; }
  };
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/alerts');
      setAlerts(data.data || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async (id) => {
    try {
      await api.put(`/alerts/${id}/read`);
      setAlerts((list) => list.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const markReviewed = async (id) => {
    try {
      await api.put(`/alerts/${id}/resolve`);
      setAlerts((list) => list.map((a) => (a.id === id ? { ...a, isRead: true, resolvedAt: new Date().toISOString() } : a)));
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const g = group(alerts);
  const renderRow = (a) => (
    <TouchableOpacity key={a.id} onPress={() => !a.isRead && markRead(a.id)} activeOpacity={a.isRead ? 1 : 0.7}>
      <Card style={a.isRead ? { opacity: 0.65 } : null}>
        <Row between><Chip status={a.severity} /><Text style={T.tiny}>{a.type}</Text></Row>
        {!!a.patient?.fullName && <Text style={[T.h3, { marginTop: 6 }]}>{a.patient.fullName}</Text>}
        <Text style={[T.body, { fontWeight: '700', marginTop: 2 }]}>{a.message}</Text>
        <Text style={T.tiny}>{new Date(a.createdAt).toLocaleString()}{a.resolvedAt ? ' · reviewed' : !a.isRead ? ' · tap to mark read' : ''}</Text>
        {!a.isRead && a.severity === 'critical' && (
          <Btn title="Mark reviewed" kind="secondary" onPress={() => markReviewed(a.id)} />
        )}
        {a.patient && canOpenPatient() && (
          <Btn title="View event in timeline" kind="ghost" onPress={() => navigation.navigate('PatientDetail', { patientId: a.patient.id, patientName: a.patient.fullName, tab: 'tl' })} />
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Title sub="Falls and severe entries first — routine updates last">Alerts</Title>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {loading ? <Loader /> : alerts.length === 0 ? (
        <Empty>No items need your review. Falls, severe entries, assignment updates and observations will appear here.</Empty>
      ) : (
        <>
          {g.review.length > 0 && <><SectionTitle>Needs review</SectionTitle>{g.review.map(renderRow)}</>}
          {g.attention.length > 0 && <><SectionTitle>Attention</SectionTitle>{g.attention.map(renderRow)}</>}
          {g.info.length > 0 && <><SectionTitle>Information & done</SectionTitle>{g.info.map(renderRow)}</>}
        </>
      )}
    </Screen>
  );
}
