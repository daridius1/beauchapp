import React, { useState, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Text, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Header } from './src/components/Header';
import { Sidebar } from './src/components/Sidebar';
import { HomeScreen } from './src/screens/HomeScreen';
import { theme } from './src/theme/theme';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ContestsScreen } from './src/screens/ContestsScreen';
import { PollaContestScreen } from './src/screens/PollaContest';
import { CommunitiesScreen } from './src/screens/CommunitiesScreen';
import { CommunityDetailScreen } from './src/screens/CommunityDetailScreen';
import { OrganizationsScreen } from './src/screens/OrganizationsScreen';
import { SuperadminScreen } from './src/screens/SuperadminScreen';
import { ParticipantPredictionsScreen } from './src/screens/ParticipantPredictionsScreen';
import { MatchPredictionsScreen } from './src/screens/MatchPredictionsScreen';
import { PostDetailScreen } from './src/screens/PostDetailScreen';
import { UserProfileScreen } from './src/screens/UserProfileScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { NotFoundScreen } from './src/screens/NotFoundScreen';
import { RootStackParamList } from './src/types/navigation';
import Toast from 'react-native-toast-message';
import * as Linking from 'expo-linking';

if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    body {
      background-color: #1A1A1A;
      overflow-x: hidden;
    }
    #root {
      height: 100vh;
    }
  `;
  document.head.appendChild(style);
}

const Stack = createNativeStackNavigator<RootStackParamList>();

// ----------------------------------------------------
// COMPONENTE CONTENEDOR PRINCIPAL
// ----------------------------------------------------
function AppContent() {
  const { user, isInitialized } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [currentRouteName, setCurrentRouteName] = useState<string>('Home');
  const [currentRouteParams, setCurrentRouteParams] = useState<any>({});
  const navigationRef = useNavigationContainerRef<RootStackParamList>();



  // Mapeo de títulos de pantalla
  const getScreenTitle = (screen: string, params: any) => {
    switch (screen) {
      case 'Home': return 'Inicio';
      case 'Profile': return 'Mi Perfil';
      case 'Contests': return 'Actividades';
      case 'WorldCupContest': return 'Polla Mundialera';
      case 'Superadmin': return 'Panel Superadmin';
      case 'Login': return 'Iniciar Sesión';
      case 'PostDetail': return 'Conversación';
      case 'UserProfile': return 'Perfil de Usuario';
      case 'ParticipantPredictions': return 'Predicciones';
      case 'MatchPredictions': return 'Partidos';
      case 'Communities': return 'Comunidades';
      case 'CommunityDetail': return params?.communityName || 'Comunidad';
      case 'Organizations': return 'Organizaciones';
      case 'NotFound': return 'No Encontrado';
      default: return 'Beauchapp';
    }
  };

  const rootScreens = ['Home', 'Profile', 'Contests', 'Superadmin', 'Communities', 'Organizations'];
  const canGoBack = !rootScreens.includes(currentRouteName) && navigationRef.isReady() && navigationRef.canGoBack();

  if (!isInitialized) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.cardBg} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.cardBg} />
      
      <NavigationContainer 
        ref={navigationRef}
        linking={{
          prefixes: [Linking.createURL('/'), 'http://localhost:8081'],
          config: {
            screens: {
              Profile: 'profile',
              Contests: 'activities',
              Communities: 'communities',
              Organizations: 'organizations',
              Verification: 'verification',
              VerifyEmail: 'verify',
              ResetPassword: 'reset-password',
            }
          }
        }}
        onStateChange={async () => {
          const currentRoute = navigationRef.getCurrentRoute();
          if (currentRoute) {
            setCurrentRouteName(currentRoute.name);
            setCurrentRouteParams(currentRoute.params || {});
          }
        }}
      >
        {user ? (
          <>
            <Header 
              title={getScreenTitle(currentRouteName, currentRouteParams)} 
              onToggleSidebar={() => setIsSidebarOpen(true)} 
              onBack={canGoBack ? () => navigationRef.goBack() : undefined}
            />
            <View style={styles.body}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Contests" component={ContestsScreen} />
                <Stack.Screen name="PollaContest" component={PollaContestScreen} />
                <Stack.Screen name="Communities" component={CommunitiesScreen} />
              <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
                <Stack.Screen name="Organizations" component={OrganizationsScreen} />
                <Stack.Screen name="Superadmin" component={SuperadminScreen} />
                <Stack.Screen name="ParticipantPredictions" component={ParticipantPredictionsScreen} />
                <Stack.Screen name="MatchPredictions" component={MatchPredictionsScreen} />
                <Stack.Screen name="PostDetail" component={PostDetailScreen} />
                <Stack.Screen name="UserProfile" component={UserProfileScreen} />
                <Stack.Screen name="NotFound" component={NotFoundScreen} />
              </Stack.Navigator>
            </View>
            <Sidebar 
              isOpen={isSidebarOpen} 
              onClose={() => setIsSidebarOpen(false)} 
              activeScreen={currentRouteName}
              onNavigate={(screen) => {
                navigationRef.navigate(screen as never);
                setIsSidebarOpen(false);
              }}
            />
          </>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Verification" component={VerificationScreen} />
            <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
      <Toast />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.cardBg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

});
