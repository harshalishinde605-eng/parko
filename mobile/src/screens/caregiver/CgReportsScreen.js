import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../../../lib/api';
import { Screen, Card, Banner, Loader, EmptyState, Row, SectionHead, Dots, MiniBars } from '../../ui';
import { C, T } from '../../theme';

const KIND_ICON = { exercise: 'fitness', medication: 'medkit', symptom: 'pulse', observation: 'eye', note: 'document-text', alert: 'notifications' };
const FILTERS = [
  { label: 'All', value: 'all' }, { label: 'Exercises', value: 'exercise' }, { label: 'Medicines', value: 'medication' },
  { label: 'Symptoms', value: 'symptom' }, { label: 'Check-ins', value: 'checkin' }, { label: 'Observations', value: 'observation' },
];

export default function CgReportsScreen() {
  const [patients, setPatients] = useState([]);
  const [sel, setSel] = useState('');
  const [ins, setIns] = useState(null);
  const [timeline, setTimeline] = useState({ groups: {} });
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent, pid) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      let id = pid;
      if (!id) {
        const { data } = await api.get('/dashboard/caregiver');
        const ps = data.data.patients || [];
        setPatients(ps);
        id = ps[0]?.id || '';
        setSel(id);
      }
      if (!id) return;
      const [i, tl, sm] = await Promise.all([
        api.get(`/patients/${id}/insights?days=7`),
        api.get(`/patients/${id}/timeline?days=7`),
        api.get(`/patients/${id}/summary`).catch(() => ({ data: { data: null } })),
      ]);
      setIns(i.data.data);
      setTimeline(tl.data.data || { groups: {} });
      setSummary(sm.data.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pick = (id) => { setSel(id); setIns(null); setTimeline({ groups: {} }); setSummary(null); load(true, id); };
  const st = ins?.stats;
  const hasData = (st?.exercise?.total || 0) + (st?.meds?.total || 0) > 0;

  const matchKind = (it) => {
    if (filter === 'all') return true;
    if (filter === 'checkin') return it.kind === 'observation';
    return it.kind === filter;
  };

  return (
    <Screen refreshing={false} onRefresh={() => load(true, sel)}>
      <Text style={T.display}>Reports</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>Progress, activity and weekly summary.</Text>
      {!!error && <Banner kind="danger">{error}</Banner>}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        {patients.map((p) => (
          <TouchableOpacity key={p.id} onPress={() => pick(p.id)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: sel === p.id ? C.primary : C.white, borderWidth: 1, borderColor: sel === p.id ? C.primary : C.line }}>
            <Text style={{ fontWeight: '700', color: sel === p.id ? C.white : C.ink }}>{p.fullName}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <Loader /> : !sel ? (
        <EmptyState icon="people" title="No patient linked" sub="Ask your physiotherapist to link your account." />
      ) : (
        <>
          <SectionHead title="This week" />
          {!hasData ? (
            <EmptyState icon="bar-chart" title="No sessions recorded yet" sub="Logged exercises and medicines will appear here as progress." />
          ) : (
            <>
              <Row>
                <Card style={{ flex: 1 }}><Text style={T.h1}>{st.exercise.completionPct}%</Text><Text style={[T.tiny, { fontWeight: '700' }]}>EXERCISE</Text></Card>
                <Card style={{ flex: 1 }}><Text style={T.h1}>{st.meds.adherencePct}%</Text><Text style={[T.tiny, { fontWeight: '700' }]}>MEDICATION</Text></Card>
              </Row>
              <Row>
                <Card style={{ flex: 1 }}><Text style={T.h1}>{st.checkins}/7</Text><Text style={[T.tiny, { fontWeight: '700' }]}>CHECK-INS</Text><Dots values={st.dots || []} /></Card>
                <Card style={{ flex: 1 }}><Text style={[T.h1, { color: st.falls ? C.danger : C.ink }]}>{st.falls}</Text><Text style={[T.tiny, { fontWeight: '700' }]}>FALLS</Text></Card>
              </Row>
              <Card>
                <Text style={T.h3}>Exercise consistency</Text>
                <MiniBars bars={(ins.sessionsPerWeek || []).map((v, i) => ({ label: `W${i + 1}`, value: v }))} color={C.ok} />
              </Card>
            </>
          )}

          <SectionHead title="Weekly summary" />
          {!summary?.paragraphs?.length ? (
            <Text style={T.muted}>Not enough recorded data for a summary yet.</Text>
          ) : (
            <Card>
              {summary.paragraphs.map((p, i) => <Text key={i} style={[T.body, { marginBottom: 6 }]}>• {p}</Text>)}
            </Card>
          )}

          <SectionHead title="Activity timeline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {FILTERS.map((f) => (
              <TouchableOpacity key={f.value} onPress={() => setFilter(f.value)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: filter === f.value ? C.primary : C.white, borderWidth: 1, borderColor: filter === f.value ? C.primary : C.line }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: filter === f.value ? C.white : C.ink }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {(() => {
            const entries = Object.entries(timeline.groups || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1))
              .map(([day, items]) => [day, items.filter(matchKind)])
              .filter(([, items]) => items.length);
            if (!entries.length) return <EmptyState icon="time" title="No activity yet" sub="Recorded care will appear here day by day." />;
            return entries.map(([day, items]) => (
              <View key={day}>
                <Text style={[T.h3, { marginTop: 10, marginBottom: 6 }]}>{day}</Text>
                {items.map((it, i) => (
                  <Card key={it.id || i}>
                    <Row>
                      <Ionicons name={KIND_ICON[it.kind] || 'ellipse'} size={20} color={C.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[T.tiny, { fontWeight: '700' }]}>{new Date(it.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        <Text style={[T.body, { fontWeight: '700' }]}>{it.title}</Text>
                        {!!it.detail && <Text style={T.muted}>{it.detail}</Text>}
                      </View>
                    </Row>
                  </Card>
                ))}
              </View>
            ));
          })()}

          <SectionHead title="Caregiver notes" />
          <Card>
            <Text style={T.muted}>Things you noticed that the physiotherapist should know live in your observations. Add them from the Care tab.</Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
