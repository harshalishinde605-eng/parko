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
import CgHomeScreen from './src/screens/caregiver/CgHomeScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GuideScreen from './src/screens/GuideScreen';
import ExerciseLibraryScreen from './src/screens/ExerciseLibraryScreen';
import CgCareScreen from './src/screens/caregiver/CgCareScreen';
import CgReportsScreen from './src/screens/caregiver/CgReportsScreen';
import CgMoreScreen from './src/screens/caregiver/CgMoreScreen';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import MoreScreen from './src/screens/MoreScreen';
import AIDocsScreen from './src/screens/AIDocsScreen';

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
      headerShown: false,
      tabBarActiveTintColor: C.primary,
      tabBarInactiveTintColor: C.muted,
      tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6, borderTopColor: C.line },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      tabBarIcon: ({ color, size }) => {
        const icon = route.name === 'Home' ? 'home' : route.name === 'Patients' ? 'people' : route.name === 'Calendar' ? 'calendar' : route.name === 'Alerts' ? 'notifications' : 'menu';
        return <Ionicons name={icon} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Patients" component={DoctorHomeScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

function CaregiverTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...screenOpts,
      headerShown: false,
      tabBarActiveTintColor: C.primary,
      tabBarInactiveTintColor: C.muted,
      tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6, borderTopColor: C.line },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      tabBarIcon: ({ color, size }) => {
        const icon = route.name === 'Home' ? 'home' : route.name === 'Care' ? 'heart' : route.name === 'Reports' ? 'bar-chart' : route.name === 'Alerts' ? 'notifications' : 'menu';
        return <Ionicons name={icon} size={size} color={color} />;
      },
    })}>
      <Tab.Screen name="Home" component={CgHomeScreen} />
      <Tab.Screen name="Care" component={CgCareScreen} />
      <Tab.Screen name="Reports" component={CgReportsScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="More" component={CgMoreScreen} />
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
          <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} options={{ title: 'Exercise Library' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="AIDocs" component={AIDocsScreen} options={({ route }) => ({ title: route.params?.patientName ? `AI Docs · ${route.params.patientName}` : 'AI Documentation' })} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={CaregiverTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Guide" component={GuideScreen} options={{ title: 'Exercise Guide' }} />
        </>
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
