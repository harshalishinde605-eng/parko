import React, { useState } from 'react';
import { View, Text, TextInput, Button, ScrollView, StyleSheet, Alert } from 'react-native';
import { api, saveTokens, clearTokens } from './lib/api';

const SYMPTOMS = ['tremor', 'stiffness', 'pain', 'fatigue', 'balance', 'walking', 'other'];

export default function App() {
  const [role, setRole] = useState(null);
  const [screen, setScreen] = useState('role');
  const [tab, setTab] = useState('home');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [user, setUser] = useState(null);
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [patientId, setPatientId] = useState('');
  // forms
  const [newPatient, setNewPatient] = useState({ fullName: '', diagnosisStage: '' });
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [exForm, setExForm] = useState({ assignmentId: '', status: 'completed', repsDone: '', durationMin: '', difficulty: '3', remarks: '' });
  const [medForm, setMedForm] = useState({ assignmentId: '', status: 'taken', remarks: '' });
  const [symForm, setSymForm] = useState({ type: 'tremor', severity: '5', notes: '' });
  const [obsForm, setObsForm] = useState({ notes: '', mood: '', sleepHours: '' });
  const [assignEx, setAssignEx] = useState({ exerciseId: '', sets: '3', reps: '10', instructions: '' });
  const [assignMed, setAssignMed] = useState({ medicineId: '', dosage: '', instructions: '' });
  const [note, setNote] = useState('');

  const err = (e) => Alert.alert('Error', e.response?.data?.error || e.message);

  const login = async () => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await saveTokens(data.data.accessToken, data.data.refreshToken);
      setUser(data.data.user);
      setScreen('dash'); setTab('home');
      await loadDash(data.data.user);
    } catch (e) { err(e); }
  };
  const register = async () => {
    try { await api.post('/auth/register', { email, password, fullName, role }); Alert.alert('Registered', 'Now login'); }
    catch (e) { err(e); }
  };
  const loadDash = async (u) => {
    try {
      const me = u || user;
      if (!me) return;
      if (me.role === 'DOCTOR') {
        const r = await api.get('/dashboard/doctor');
        setPatients(r.data.data.map((x) => x.patient));
        if (r.data.data[0]?.patient && !patientId) setPatientId(r.data.data[0].patient.id);
      } else {
        const r = await api.get('/dashboard/caregiver');
        setPatients(r.data.data.patients || []);
        setAlerts(r.data.data.alerts || []);
        if (r.data.data.patients?.[0] && !patientId) setPatientId(r.data.data.patients[0].id);
      }
      const a = await api.get('/alerts?unread=true').catch(() => null);
      if (a) setAlerts(a.data.data);
    } catch (e) { err(e); }
  };

  // ---- caregiver actions ----
  const logExercise = async () => {
    try {
      await api.post('/exercise-logs', { assignmentId: exForm.assignmentId, patientId, status: exForm.status, repsDone: exForm.repsDone ? +exForm.repsDone : undefined, durationMin: exForm.durationMin ? +exForm.durationMin : undefined, difficulty: +exForm.difficulty, remarks: exForm.remarks });
      Alert.alert('Saved', 'Exercise log stored in cloud DB'); loadDash();
    } catch (e) { err(e); }
  };
  const logMedicine = async () => {
    try {
      await api.post('/medicine-logs', { assignmentId: medForm.assignmentId, patientId, status: medForm.status, remarks: medForm.remarks });
      Alert.alert('Saved', 'Medicine log stored'); loadDash();
    } catch (e) { err(e); }
  };
  const logSymptom = async () => {
    try {
      await api.post('/symptom-logs', { patientId, type: symForm.type, severity: +symForm.severity, notes: symForm.notes });
      Alert.alert('Saved', 'Symptom stored'); loadDash();
    } catch (e) { err(e); }
  };
  const logObs = async () => {
    try {
      await api.post('/observations', { patientId, notes: obsForm.notes, mood: obsForm.mood, sleepHours: obsForm.sleepHours ? +obsForm.sleepHours : undefined });
      Alert.alert('Saved', 'Observation stored');
    } catch (e) { err(e); }
  };

  // ---- doctor actions ----
  const createPatient = async () => {
    try {
      const { data } = await api.post('/patients', { fullName: newPatient.fullName, diagnosisStage: newPatient.diagnosisStage });
      Alert.alert('Created', data.data.id); setPatientId(data.data.id); loadDash();
    } catch (e) { err(e); }
  };
  const linkCaregiver = async () => {
    try { await api.post(`/patients/${patientId}/caregiver`, { caregiverEmail }); Alert.alert('Linked', caregiverEmail); }
    catch (e) { err(e); }
  };
  const doAssignEx = async () => {
    try { await api.post('/exercise-assignments', { patientId, exerciseId: assignEx.exerciseId, sets: +assignEx.sets, reps: +assignEx.reps, instructions: assignEx.instructions }); Alert.alert('Assigned'); }
    catch (e) { err(e); }
  };
  const doAssignMed = async () => {
    try { await api.post('/medicine-assignments', { patientId, medicineId: assignMed.medicineId, dosage: assignMed.dosage, instructions: assignMed.instructions, scheduleTimes: ['08:00', '20:00'] }); Alert.alert('Assigned'); }
    catch (e) { err(e); }
  };
  const addNote = async () => {
    try { await api.post('/notes', { patientId, note }); Alert.alert('Note saved'); setNote(''); }
    catch (e) { err(e); }
  };
  const makeReport = async (type) => {
    try { const { data } = await api.post(`/patients/${patientId}/reports`, { type }); Alert.alert('Report', `ID ${data.data.id}. PDF: /api/reports/${data.data.id}/pdf`); }
    catch (e) { err(e); }
  };

  if (screen === 'role') {
    return (
      <View style={s.c}>
        <Text style={s.h}>PARKO Care</Text>
        <Text>One app, two roles. Pick yours:</Text>
        <View style={{ height: 12 }} />
        <Button title="Doctor / Physiotherapist" onPress={() => { setRole('DOCTOR'); setScreen('auth'); }} />
        <View style={{ height: 12 }} />
        <Button title="Caregiver" onPress={() => { setRole('CAREGIVER'); setScreen('auth'); }} />
      </View>
    );
  }
  if (screen === 'auth') {
    return (
      <ScrollView contentContainerStyle={s.c}>
        <Text style={s.h}>{role} Login</Text>
        <TextInput style={s.i} placeholder="Full name (register)" value={fullName} onChangeText={setFullName} />
        <TextInput style={s.i} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <TextInput style={s.i} placeholder="Password (min 8)" secureTextEntry value={password} onChangeText={setPassword} />
        <Button title="Login" onPress={login} />
        <View style={{ height: 8 }} /><Button title="Register" onPress={register} />
        <View style={{ height: 8 }} /><Button title="Back" onPress={() => setScreen('role')} />
      </ScrollView>
    );
  }

  const isDoc = user?.role === 'DOCTOR';
  return (
    <ScrollView contentContainerStyle={s.c}>
      <Text style={s.h}>{isDoc ? 'Doctor' : 'Caregiver'} Dashboard</Text>
      <Text>{user?.fullName} · {user?.email}</Text>
      <TextInput style={s.i} placeholder="Active patientId" value={patientId} onChangeText={setPatientId} />
      <View style={s.row}>
        <Button title="Home" onPress={() => setTab('home')} />
        <Button title={isDoc ? 'Manage' : 'Log'} onPress={() => setTab('log')} />
        <Button title="Alerts" onPress={() => setTab('alerts')} />
      </View>
      <Button title="Refresh" onPress={() => loadDash()} />
      {tab === 'home' && (
        <View>
          <Text style={s.sub}>Assigned patients ({patients.length})</Text>
          {patients.map((p) => (
            <View key={p.id} style={s.card}>
              <Text style={{ fontWeight: 'bold' }}>{p.fullName}</Text>
              <Text>{p.id}</Text>
              <Button title="Select" onPress={() => setPatientId(p.id)} />
            </View>
          ))}
        </View>
      )}
      {tab === 'log' && !isDoc && (
        <View>
          <Text style={s.sub}>Log exercise (needs assignmentId)</Text>
          <TextInput style={s.i} placeholder="assignmentId" value={exForm.assignmentId} onChangeText={(v) => setExForm({ ...exForm, assignmentId: v })} />
          <TextInput style={s.i} placeholder="status completed|partial|missed" value={exForm.status} onChangeText={(v) => setExForm({ ...exForm, status: v })} />
          <TextInput style={s.i} placeholder="repsDone" keyboardType="numeric" value={exForm.repsDone} onChangeText={(v) => setExForm({ ...exForm, repsDone: v })} />
          <TextInput style={s.i} placeholder="durationMin" keyboardType="numeric" value={exForm.durationMin} onChangeText={(v) => setExForm({ ...exForm, durationMin: v })} />
          <Button title="Save exercise log" onPress={logExercise} />
          <Text style={s.sub}>Log medicine</Text>
          <TextInput style={s.i} placeholder="assignmentId" value={medForm.assignmentId} onChangeText={(v) => setMedForm({ ...medForm, assignmentId: v })} />
          <TextInput style={s.i} placeholder="taken|missed|delayed" value={medForm.status} onChangeText={(v) => setMedForm({ ...medForm, status: v })} />
          <Button title="Save medicine log" onPress={logMedicine} />
          <Text style={s.sub}>Log symptom ({SYMPTOMS.join(',')})</Text>
          <TextInput style={s.i} placeholder="type" value={symForm.type} onChangeText={(v) => setSymForm({ ...symForm, type: v })} />
          <TextInput style={s.i} placeholder="severity 1-10" keyboardType="numeric" value={symForm.severity} onChangeText={(v) => setSymForm({ ...symForm, severity: v })} />
          <TextInput style={s.i} placeholder="notes" value={symForm.notes} onChangeText={(v) => setSymForm({ ...symForm, notes: v })} />
          <Button title="Save symptom" onPress={logSymptom} />
          <Text style={s.sub}>Observation</Text>
          <TextInput style={s.i} placeholder="mood" value={obsForm.mood} onChangeText={(v) => setObsForm({ ...obsForm, mood: v })} />
          <TextInput style={s.i} placeholder="notes" value={obsForm.notes} onChangeText={(v) => setObsForm({ ...obsForm, notes: v })} />
          <Button title="Save observation" onPress={logObs} />
        </View>
      )}
      {tab === 'log' && isDoc && (
        <View>
          <Text style={s.sub}>Create patient</Text>
          <TextInput style={s.i} placeholder="Patient full name" value={newPatient.fullName} onChangeText={(v) => setNewPatient({ ...newPatient, fullName: v })} />
          <TextInput style={s.i} placeholder="Stage" value={newPatient.diagnosisStage} onChangeText={(v) => setNewPatient({ ...newPatient, diagnosisStage: v })} />
          <Button title="Create" onPress={createPatient} />
          <Text style={s.sub}>Assign caregiver</Text>
          <TextInput style={s.i} placeholder="caregiver email" value={caregiverEmail} onChangeText={setCaregiverEmail} />
          <Button title="Link caregiver" onPress={linkCaregiver} />
          <Text style={s.sub}>Assign exercise (exerciseId)</Text>
          <TextInput style={s.i} placeholder="exerciseId" value={assignEx.exerciseId} onChangeText={(v) => setAssignEx({ ...assignEx, exerciseId: v })} />
          <Button title="Assign exercise" onPress={doAssignEx} />
          <Text style={s.sub}>Assign medicine (medicineId)</Text>
          <TextInput style={s.i} placeholder="medicineId" value={assignMed.medicineId} onChangeText={(v) => setAssignMed({ ...assignMed, medicineId: v })} />
          <TextInput style={s.i} placeholder="dosage e.g. 100mg 1-0-1" value={assignMed.dosage} onChangeText={(v) => setAssignMed({ ...assignMed, dosage: v })} />
          <Button title="Assign medicine" onPress={doAssignMed} />
          <Text style={s.sub}>Clinical note</Text>
          <TextInput style={s.i} placeholder="note" value={note} onChangeText={setNote} />
          <Button title="Save note" onPress={addNote} />
          <Text style={s.sub}>Reports</Text>
          <View style={s.row}><Button title="Daily" onPress={() => makeReport('daily')} /><Button title="Weekly" onPress={() => makeReport('weekly')} /><Button title="Monthly" onPress={() => makeReport('monthly')} /></View>
        </View>
      )}
      {tab === 'alerts' && (
        <View>
          <Text style={s.sub}>Unread alerts ({alerts.length})</Text>
          {alerts.map((a) => (<View key={a.id} style={s.card}><Text>[{a.severity}] {a.message}</Text></View>))}
        </View>
      )}
      <View style={{ height: 12 }} />
      <Button title="Logout" onPress={async () => { await clearTokens(); setScreen('role'); setUser(null); }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  c: { flexGrow: 1, padding: 20, paddingTop: 48 },
  h: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  sub: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 6 },
  i: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 8, borderRadius: 8 },
  card: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
});
