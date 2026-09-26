import React, { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, errMsg } from '../../../lib/api';
import { Card, Btn, Banner, Loader, Empty, Row, SectionTitle, MiniBars } from '../../ui';
import { C, T } from '../../theme';

const DIFF_LABEL = { 1: 'Easy', 2: 'Comfortable', 3: 'Difficult', 4: 'Very difficult', 5: 'Could not complete' };

export default function ProgressTab({ patientId, navigation }) {
  const [data, setData] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [p, r] = await Promise.all([
        api.get(`/patients/${patientId}/progress`),
        api.get(`/patients/${patientId}/reports`),
      ]);
      setData(p.data.data);
      setReports(r.data.data || []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <Loader />;
  return (
    <View>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      {!data ? <Empty>No progress data yet.</Empty> : (
        <>
          <SectionTitle>Exercise adherence</SectionTitle>
          <Card>
            <MiniBars bars={(data.adherenceWeeks || []).map((w) => ({ label: w.week.replace('Week ', 'W'), value: w.completionPct }))} color={C.primary} />
            {(data.adherenceWeeks || []).map((w, i) => (
              <Text key={i} style={T.muted}>{w.week}: {w.completionPct}% ({w.sessions} sessions)</Text>
            ))}
          </Card>

          <SectionTitle>Functional outcomes</SectionTitle>
          {!data.latestAssessment ? <Text style={T.muted}>No assessments recorded yet.</Text> : (
            <Card>
              {[
                ['Timed Up and Go', data.previousAssessment?.tug != null ? `${data.previousAssessment.tug} sec` : null, data.latestAssessment?.tug != null ? `${data.latestAssessment.tug} sec` : null],
                ['Gait speed', data.previousAssessment?.walkSpeed != null ? `${data.previousAssessment.walkSpeed} m/s` : null, data.latestAssessment?.walkSpeed != null ? `${data.latestAssessment.walkSpeed} m/s` : null],
                ['Sit-to-Stand', data.previousAssessment?.sitToStand != null ? `${data.previousAssessment.sitToStand} reps` : null, data.latestAssessment?.sitToStand != null ? `${data.latestAssessment.sitToStand} reps` : null],
                ['Balance', data.previousAssessment?.balanceScore != null ? `${data.previousAssessment.balanceScore}/${data.previousAssessment.balanceMax || 28}` : null, data.latestAssessment?.balanceScore != null ? `${data.latestAssessment.balanceScore}/${data.latestAssessment.balanceMax || 28}` : null],
              ].map(([label, prev, cur], i) => (
                <Text key={i} style={[T.body, { marginTop: 4 }]}>{label}: {prev ?? '–'} → {cur ?? '–'}</Text>
              ))}
              <Text style={[T.tiny, { marginTop: 6 }]}>Recorded assessment results — improvement here describes recorded numbers only.</Text>
            </Card>
          )}

          <SectionTitle>Patient feedback</SectionTitle>
          {(data.feedback || []).length === 0 && <Text style={T.muted}>No difficulty feedback recorded yet.</Text>}
          {(data.feedback || []).slice(0, 10).map((f, i) => (
            <Card key={i}>
              <Text style={T.body}>{f.exercise || 'Exercise'} — {f.status}</Text>
              <Text style={T.muted}>
                {new Date(f.at).toLocaleDateString()}
                {f.difficulty ? ` · ${DIFF_LABEL[f.difficulty] || `difficulty ${f.difficulty}`}` : ''}
                {f.feedbackReason ? ` · ${f.feedbackReason}` : ''}
                {f.remarks ? ` · ${f.remarks}` : ''}
              </Text>
            </Card>
          ))}

          <SectionTitle>Caregiver observations</SectionTitle>
          {(data.observations || []).length === 0 && <Text style={T.muted}>None recorded.</Text>}
          {(data.observations || []).slice(0, 5).map((o, i) => (
            <Card key={i}><Text style={T.body}>{o.text || 'Observation'}</Text><Text style={T.tiny}>{new Date(o.at).toLocaleString()}</Text></Card>
          ))}

          <Btn title="+ New assessment" kind="secondary" onPress={() => navigation.navigate('PatientDetail', { patientId, tab: 'as' })} />

          <SectionTitle>Reports</SectionTitle>
          <Row>
            {['daily', 'weekly', 'monthly'].map((t) => (
              <View key={t} style={{ flex: 1 }}>
                <Btn title={t[0].toUpperCase() + t.slice(1)} kind="secondary" loading={busy === t} onPress={async () => {
                  setBusy(t); setError(''); setOkMsg('');
                  try {
                    await api.post(`/patients/${patientId}/reports`, { type: t });
                    setOkMsg(`${t} report generated.`);
                    load(true);
                  } catch (e) { setError(errMsg(e)); } finally { setBusy(null); }
                }} />
              </View>
            ))}
          </Row>
          {reports.map((r) => (
            <Card key={r.id}>
              <Text style={T.h3}>{r.type} report</Text>
              <Text style={T.muted}>{new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}</Text>
            </Card>
          ))}
        </>
      )}
    </View>
  );
}
