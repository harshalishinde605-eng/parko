import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth';
import { Screen, Card, Btn, Banner } from '../ui';
import { C, T } from '../theme';

export default function MoreScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const initial = (user?.fullName || user?.email || '?').trim()[0]?.toUpperCase() || '?';

  const rows = [
    { icon: 'person', label: 'My Profile', go: () => navigation.navigate('Profile') },
    { icon: 'fitness', label: 'Exercise Library', go: () => navigation.navigate('ExerciseLibrary') },
    { icon: 'help-circle', label: 'Help & Support', go: () => setHelp((h) => !h) },
  ];

  return (
    <Screen>
      <Text style={T.display}>More</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>Account, tools and support.</Text>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.white, fontSize: 24, fontWeight: '800' }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.cardTitle}>{user?.fullName}</Text>
            <Text style={T.muted}>{user?.role === 'DOCTOR' ? 'Physiotherapist' : user?.role}</Text>
            <Text style={T.tiny}>{user?.email}</Text>
          </View>
        </View>
      </Card>
      {rows.map((r) => (
        <TouchableOpacity key={r.label} onPress={r.go} activeOpacity={0.8}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={r.icon} size={22} color={C.primary} />
              </View>
              <Text style={[T.body, { flex: 1, fontWeight: '700' }]}>{r.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={C.muted} />
            </View>
          </Card>
        </TouchableOpacity>
      ))}
      {help && (
        <Banner kind="info">For help: contact your clinic administrator. Session data syncs to the secure cloud database. In an emergency, contact local emergency services — this app is not an emergency tool.</Banner>
      )}
      <Btn title="Sign out" kind="danger" loading={busy} onPress={async () => { setBusy(true); await signOut(); setBusy(false); }} />
    </Screen>
  );
}
