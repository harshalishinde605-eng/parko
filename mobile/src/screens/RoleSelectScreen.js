import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth';
import { C, R, T } from '../theme';

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
          <Ionicons name="heart-circle" size={54} color={C.primary} />
        </View>
        <Text style={s.brand}>PARKO Care</Text>
        <Text style={T.muted}>Parkinson's physiotherapy & medication tracking — recorded by caregivers, supervised by doctors.</Text>
      </View>
      <TouchableOpacity style={s.card} onPress={() => pick('DOCTOR')} activeOpacity={0.8}>
        <View style={[s.ic, { backgroundColor: C.primarySoft }]}>
          <Ionicons name="stethoscope" size={26} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={T.h2}>Doctor / Physio</Text>
          <Text style={T.muted}>Patients, care plans, progress & reports</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={C.muted} />
      </TouchableOpacity>
      <TouchableOpacity style={s.card} onPress={() => pick('CAREGIVER')} activeOpacity={0.8}>
        <View style={[s.ic, { backgroundColor: '#E8F0FE' }]}>
          <Ionicons name="people" size={26} color={C.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={T.h2}>Caregiver</Text>
          <Text style={T.muted}>Daily exercises, medicines & symptoms</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={C.muted} />
      </TouchableOpacity>
      <Text style={[T.tiny, { textAlign: 'center', marginTop: 14 }]}>The patient does not operate this app.</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 20, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 26 },
  logo: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, marginBottom: 12 },
  brand: { fontSize: 30, fontWeight: '800', color: C.ink, marginBottom: 6 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: R.md, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line, gap: 12 },
  ic: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
