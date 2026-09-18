import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '../auth';
import { BASE_URL } from '../../lib/api';
import { Screen, Card, Btn, Title } from '../ui';
import { C, T } from '../theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const initial = (user?.fullName || user?.email || '?').trim()[0]?.toUpperCase() || '?';

  return (
    <Screen>
      <Title sub={user?.email}>Profile</Title>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.white, fontSize: 24, fontWeight: '800' }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.h2}>{user?.fullName}</Text>
            <Text style={T.muted}>{user?.role === 'DOCTOR' ? 'Doctor / Physiotherapist' : user?.role}</Text>
          </View>
        </View>
      </Card>
      <Card>
        <Text style={T.h3}>Connection</Text>
        <Text style={[T.muted, { marginTop: 4 }]}>{BASE_URL}</Text>
        <Text style={[T.tiny, { marginTop: 4 }]}>PARKO Care v1.0.0 · data syncs to the secure cloud database</Text>
      </Card>
      <Btn title="Sign out" kind="danger" loading={busy} onPress={async () => { setBusy(true); await signOut(); setBusy(false); }} />
    </Screen>
  );
}
