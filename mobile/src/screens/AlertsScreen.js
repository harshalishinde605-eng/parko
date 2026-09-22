import React, { useCallback, useState } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Title, Banner, Loader, Empty, Chip, Row, SectionTitle } from '../ui';
import { T } from '../theme';

function group(alerts) {
  return {
    review: alerts.filter((a) => !a.isRead && a.severity === 'critical'),
    attention: alerts.filter((a) => !a.isRead && a.severity !== 'critical'),
    info: alerts.filter((a) => a.isRead || a.severity === 'info'),
  };
}

export default function AlertsScreen() {
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

  const g = group(alerts);
  const renderRow = (a) => (
    <TouchableOpacity key={a.id} onPress={() => !a.isRead && markRead(a.id)} activeOpacity={a.isRead ? 1 : 0.7}>
      <Card style={a.isRead ? { opacity: 0.65 } : null}>
        <Row between><Chip status={a.severity} /><Text style={T.tiny}>{a.type}</Text></Row>
        <Text style={[T.body, { fontWeight: '700', marginTop: 6 }]}>{a.message}</Text>
        <Text style={T.tiny}>{new Date(a.createdAt).toLocaleString()}{!a.isRead ? ' · tap to mark read' : ''}</Text>
      </Card>
    </TouchableOpacity>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Title sub="Falls and severe entries first — routine updates last">Alerts</Title>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {loading ? <Loader /> : alerts.length === 0 ? (
        <Empty>No alerts. Falls, severe symptoms, missed doses and new assignments will appear here.</Empty>
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
