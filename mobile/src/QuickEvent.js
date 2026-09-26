import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../lib/api';
import { Card, Btn, Field, Banner, BigButton, SectionTitle, Seg } from './ui';
import { C, T } from './theme';

const EVENTS = [
  { key: 'walking', icon: 'footsteps', label: 'Walking difficulty', kind: 'symptom', type: 'walking', sev: 4 },
  { key: 'tremor', icon: 'pulse', label: 'Tremor', kind: 'symptom', type: 'tremor', sev: 4 },
  { key: 'freezing', icon: 'snow', label: 'Freezing episode', kind: 'symptom', type: 'walking', sev: 5, prefix: 'Freezing episode. ' },
  { key: 'tired', icon: 'bed', label: 'Excessive tiredness', kind: 'symptom', type: 'fatigue', sev: 5 },
  { key: 'fall', icon: 'warning', label: 'Fall', kind: 'fall', sev: 8 },
  { key: 'med', icon: 'medkit', label: 'Medication issue', kind: 'observation' },
  { key: 'mood', icon: 'happy', label: 'Mood change', kind: 'observation' },
  { key: 'other', icon: 'create', label: 'Other', kind: 'observation' },
];

export default function QuickEvent({ patientId, onSaved }) {
  const [open, setOpen] = useState(false);
  const [ev, setEv] = useState(null);
  const [sev, setSev] = useState(4);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState('now');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  if (!open) {
    return <BigButton title="Something happened?" sub="Tap to record it in seconds" icon="flash" onPress={() => setOpen(true)} />;
  }

  const whenOptions = () => {
    const now = Date.now();
    const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime() > now ? d.getTime() - 864e5 : d.getTime(); };
    return { now, hour1: now - 36e5, morning: at(9), evening: at(20) };
  };

  const save = async () => {
    if (!patientId) return setError('No patient selected.');
    setBusy(true); setError(''); setOkMsg('');
    try {
      const occurredAt = new Date(whenOptions()[when]).toISOString();
      const text = (ev.prefix || '') + (note.trim() || ev.label);
      if (ev.kind === 'symptom') {
        await api.post('/symptom-logs', { patientId, type: ev.type, severity: sev, notes: text, occurredAt });
      } else if (ev.kind === 'fall') {
        await api.post('/observations', { patientId, falls: true, notes: text, occurredAt });
      } else {
        await api.post('/observations', { patientId, notes: `${ev.label}: ${note.trim() || 'reported'}`, occurredAt });
      }
      setOkMsg('Recorded. The doctor will see this.');
      setNote(''); setEv(null); setOpen(false);
      if (onSaved) onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle>What happened?</SectionTitle>
      {!!error && <Banner kind="danger">{error}</Banner>}
      {!!okMsg && <Banner kind="ok">{okMsg}</Banner>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {EVENTS.map((e) => (
          <TouchableOpacity
            key={e.key}
            onPress={() => { setEv(e); setSev(e.sev || 4); }}
            style={{ width: '23%', aspectRatio: 0.85, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: ev?.key === e.key ? C.primary : '#EFF5F2', borderWidth: 1, borderColor: ev?.key === e.key ? C.primary : C.line, padding: 4 }}
          >
            <Ionicons name={e.icon} size={24} color={ev?.key === e.key ? C.white : C.primary} />
            <Text style={{ fontSize: 10, fontWeight: '700', textAlign: 'center', color: ev?.key === e.key ? C.white : C.ink }}>{e.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {ev && (
        <>
          {(ev.kind === 'symptom' || ev.kind === 'fall') && (
            <>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>SEVERITY (1–10)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <TouchableOpacity onPress={() => setSev(Math.max(1, sev - 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20, color: C.primary, fontWeight: '800' }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 24, fontWeight: '800', color: sev >= 8 ? C.danger : C.ink }}>{sev}</Text>
                <TouchableOpacity onPress={() => setSev(Math.min(10, sev + 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20, color: C.white, fontWeight: '800' }}>+</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          <Field label="What happened? (optional note)" value={note} onChangeText={setNote} placeholder="e.g. after lunch, needed support" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6 }}>WHEN DID IT HAPPEN?</Text>
          <Seg options={[{ label: 'Just now', value: 'now' }, { label: '1 hr ago', value: 'hour1' }, { label: 'Morning', value: 'morning' }, { label: 'Evening', value: 'evening' }]} value={when} onChange={setWhen} />
          <Btn title={`Save “${ev.label}”`} loading={busy} onPress={save} />
          <Btn title="Cancel" kind="ghost" onPress={() => { setOpen(false); setEv(null); }} />
        </>
      )}
    </Card>
  );
}
