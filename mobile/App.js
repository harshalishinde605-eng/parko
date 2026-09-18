import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { C } from './src/theme';
import RoleSelectScreen from './src/screens/RoleSelectScreen';
import AuthScreen from './src/screens/AuthScreen';
import DoctorHomeScreen from './src/screens/DoctorHomeScreen';
import PatientDetailScreen from './src/screens/PatientDetailScreen';
import CaregiverHomeScreen from './src/screens/CaregiverHomeScreen';
import CaregiverLogScreen from './src/screens/CaregiverLogScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOpts = {
  headerStyle: { backgroundColor: C.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

function DoctorTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...screenOpts,
      tabBarActiveTintColor: C.primary,
      tabBarInactiveTintColor: '#8AA19A',
      tabBarIcon: ({ color, size }) => {
        const icon = route.name === 'Patients' ? 'people' : route.name === 'Alerts' ? 'notifications' : 'person';
        return <Ionicons name={icon} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Patients" component={DoctorHomeScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function CaregiverTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...screenOpts,
      tabBarActiveTintColor: C.primary,
      tabBarInactiveTintColor: '#8AA19A',
      tabBarIcon: ({ color, size }) => {
        const icon = route.name === 'Today' ? 'sunny' : route.name === 'Log' ? 'create' : route.name === 'Alerts' ? 'notifications' : 'person';
        return <Ionicons name={icon} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Today" component={CaregiverHomeScreen} />
      <Tab.Screen name="Log" component={CaregiverLogScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, booting } = useAuth();
  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F7F5' }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={screenOpts}>
      {!user ? (
        <>
          <Stack.Screen name="Role" component={RoleSelectScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Sign in' }} />
        </>
      ) : user.role === 'DOCTOR' ? (
        <>
          <Stack.Screen name="Main" component={DoctorTabs} options={{ headerShown: false }} />
          <Stack.Screen name="PatientDetail" component={PatientDetailScreen} options={({ route }) => ({ title: route.params?.patientName || 'Patient' })} />
        </>
      ) : (
        <Stack.Screen name="Main" component={CaregiverTabs} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Root />
      </NavigationContainer>
    </AuthProvider>
  );
}
