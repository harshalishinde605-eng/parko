import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../lib/api';
import { useAuth } from '../auth';
import { Screen, Card, Banner, Loader, Row, StatCard, SectionHead, AppHeader, AttentionItem } from '../ui';
import { C, T } from '../theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 6e4);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ACT_ICON = { exercise: 'fitness', medication: 'medkit', symptom: 'pulse', observation: 'eye', note: 'document-text', alert: 'notifications' };

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/doctor/dashboard');
      setDash(data.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const ov = dash?.overview || {};
  const attention = dash?.attentionPatients || [];
  const appts = dash?.todaysAppointments || [];
  const feed = dash?.recentActivity || [];
  const first = (dash?.doctor?.name || user?.fullName || '').replace(/^dr\.?\s+/i, '').split(' ')[0];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}>
      <AppHeader
        eyebrow="Physiotherapy dashboard"
        title={`${greeting()}${first ? `,\nDr. ${first}` : ''}`}
        sub="Here's your patient overview today."
        right={<Ionicons name="fitness" size={28} color="rgba(255,255,255,0.9)" />}
      />
      {!!error && <Banner kind="danger">{error}</Banner>}
      {loading ? <Loader /> : (
        <>
          <Row>
            <View style={{ flex: 1 }}><StatCard value={ov.totalPatients ?? 0} label="TOTAL PATIENTS" icon="people" /></View>
            <View style={{ flex: 1 }}><StatCard value={ov.appointmentsToday ?? 0} label="APPOINTMENTS" icon="calendar" /></View>
            <View style={{ flex: 1 }}><StatCard value={ov.patientsNeedingAttention ?? 0} label="NEED ATTENTION" icon="alert-circle" /></View>
          </Row>

          <SectionHead title="Today's appointments" action="Calendar" onAction={() => navigation.navigate('Calendar')} />
          {appts.length === 0 && <Text style={T.muted}>No appointments scheduled for today.</Text>}
          {appts.slice(0, 3).map((a) => (
            <TouchableOpacity key={a.id} onPress={() => navigation.navigate('PatientDetail', { patientId: a.patientId, patientName: a.patientName })} activeOpacity={0.85}>
              <Card>
                <Row>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '800', color: C.warn, fontSize: 15 }}>{(a.patientName || '?').trim()[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={T.cardTitle}>{a.patientName}</Text>
                    <Text style={T.muted}>{a.title} · {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={C.muted} />
                </Row>
              </Card>
            </TouchableOpacity>
          ))}

          <SectionHead title="Needs your attention" action="Patients" onAction={() => navigation.navigate('Patients')} />
          {attention.length === 0 && <Banner kind="ok">Nothing recorded needs review right now.</Banner>}
          {attention.slice(0, 3).map((a) => (
            <TouchableOpacity key={a.patientId} onPress={() => navigation.navigate('PatientDetail', { patientId: a.patientId, patientName: a.name })} activeOpacity={0.85}>
              <Card>
                <Text style={T.cardTitle}>{a.name}</Text>
                {(a.attention || []).slice(0, 2).map((t, i) => (
                  <Text key={i} style={[T.body, { marginTop: 2 }]}>{t.level === 'red' ? '🔴' : t.level === 'amber' ? '🟠' : '🟢'} {t.title}</Text>
                ))}
                <Text style={[T.muted, { marginTop: 4 }]}>View patient →</Text>
              </Card>
            </TouchableOpacity>
          ))}

          <SectionHead title="Recent activity" />
          {feed.length === 0 && <Text style={T.muted}>No patient activity recorded yet.</Text>}
          {feed.slice(0, 4).map((f, i) => (
            <Card key={i}>
              <Row>
                <Ionicons name={ACT_ICON[f.kind] || 'ellipse'} size={20} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.tiny, { fontWeight: '700' }]}>{f.patientName} · {timeAgo(f.at)}</Text>
                  <Text style={[T.body, { fontWeight: '700' }]}>{f.title}</Text>
                </View>
              </Row>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
