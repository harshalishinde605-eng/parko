import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth';
import { C, R, T, SH } from '../theme';

export default function RoleSelectScreen({ navigation }) {
  const { setRegRole } = useAuth();
  const pick = (role) => {
    setRegRole(role);
    navigation.navigate('Auth', { role });
  };
  return (
    <SafeAreaView style={s.wrap} edges={['top', 'bottom', 'left', 'right']}>
      <View style={s.hero}>
        <View style={s.logo}>
          <Ionicons name="heart-circle" size={60} color={C.primary} />
        </View>
        <Text style={s.kicker}>Parkinson's care platform</Text>
        <Text style={s.brand}>PARKO Care</Text>
        <Text style={s.tag}>Daily care recorded by caregivers.{"\n"}Reviewed with intelligence by doctors.</Text>
      </View>
      <TouchableOpacity style={[s.card, SH.card]} onPress={() => pick('DOCTOR')} activeOpacity={0.85}>
        <View style={[s.ic, { backgroundColor: C.primary }]}>
          <Ionicons name="stethoscope" size={28} color={C.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={T.h2}>Doctor / Physio</Text>
          <Text style={T.muted}>Patients · care plans · timelines · reports</Text>
        </View>
        <View style={s.go}><Ionicons name="arrow-forward" size={20} color={C.white} /></View>
      </TouchableOpacity>
      <TouchableOpacity style={[s.card, SH.card]} onPress={() => pick('CAREGIVER')} activeOpacity={0.85}>
        <View style={[s.ic, { backgroundColor: C.info }]}>
          <Ionicons name="people" size={28} color={C.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={T.h2}>Caregiver</Text>
          <Text style={T.muted}>Today's care · quick events · logging</Text>
        </View>
        <View style={[s.go, { backgroundColor: C.info }]}><Ionicons name="arrow-forward" size={20} color={C.white} /></View>
      </TouchableOpacity>
      <Text style={[T.tiny, { textAlign: 'center', marginTop: 16 }]}>The patient does not operate this app.</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 22, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 30 },
  logo: { width: 104, height: 104, borderRadius: 52, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...SH.card },
  kicker: { color: C.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  brand: { fontSize: 36, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  tag: { textAlign: 'center', color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: R.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.line, gap: 14 },
  ic: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  go: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
});
