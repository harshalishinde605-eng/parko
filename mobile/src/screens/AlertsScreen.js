import React, { useCallback, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../lib/api';
import { Screen, Card, Title, Banner, Loader, Empty, Chip, Row } from '../ui';
import { T } from '../theme';

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

  const unread = alerts.filter((a) => !a.isRead).length;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <Title sub={unread ? `${unread} need attention` : 'All caught up'}>Alerts</Title>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {loading ? <Loader /> : alerts.length === 0 ? (
        <Empty>No alerts. New warnings from missed doses, severe symptoms or falls will appear here.</Empty>
      ) : alerts.map((a) => (
        <TouchableOpacity key={a.id} onPress={() => !a.isRead && markRead(a.id)} activeOpacity={a.isRead ? 1 : 0.7}>
          <Card style={a.isRead ? { opacity: 0.65 } : null}>
            <Row between><Chip status={a.severity} /><Chip status={a.isRead ? 'info' : 'warning'} /></Row>
            <Title sub={new Date(a.createdAt).toLocaleString()}>{a.message}</Title>
            {!a.isRead && <Title sub="Tap to mark as read" />}
          </Card>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}
