import React, { useState, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Text, ScrollView, Platform, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Header } from './src/components/Header';
import { Sidebar } from './src/components/Sidebar';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { theme } from './src/theme/theme';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProfilesListScreen } from './src/screens/ProfilesListScreen';
import { PostDetailScreen } from './src/screens/PostDetailScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { NotFoundScreen } from './src/screens/NotFoundScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { DirectoryScreen } from './src/screens/DirectoryScreen';
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
      case 'Profile': return 'Perfil';
      case 'Login': return 'Iniciar Sesión';
      case 'PostDetail': return 'Conversación';
      case 'UserProfile': return 'Perfil';
      case 'Communities': return 'Comunidades';
      case 'Centers': return 'Centros';
      case 'Teams': return 'Equipos';
      case 'Settings': return 'Ajustes';
      case 'Directory': return 'Perfiles';
      case 'Students': return 'Personas';
      case 'NotFound': return 'No Encontrado';
      default: return 'Beauchapp';
    }
  };

  const rootScreens = ['Home', 'Profile', 'Communities', 'Centers', 'Teams', 'Settings', 'Directory', 'Students'];
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
              Communities: 'communities',
              Centers: 'centers',
              Teams: 'teams',
              Directory: 'directory',
              UserProfile: 'users/:userId',
              Students: 'students',
              Verification: 'verification',
              VerifyEmail: 'verify',
              ResetPassword: 'reset-password',
            }
          }
        }}
        onReady={() => {
          const currentRoute = navigationRef.getCurrentRoute();
          if (currentRoute) {
            setCurrentRouteName(currentRoute.name);
            setCurrentRouteParams(currentRoute.params || {});
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
        <View style={styles.appContainer}>
          {user ? (
            <>
              <Header 
                title={getScreenTitle(currentRouteName, currentRouteParams)} 
                onToggleSidebar={() => setIsSidebarOpen(true)} 
                onBack={canGoBack ? () => navigationRef.goBack() : undefined}
                onTitlePress={() => {
                  DeviceEventEmitter.emit('onGlobalRefresh');
                }}
              />
              <View style={styles.body}>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="Home" component={HomeScreen} />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                  <Stack.Screen name="Directory" component={DirectoryScreen} />
                  <Stack.Screen name="Students" component={ProfilesListScreen} />
                  <Stack.Screen name="Communities" component={ProfilesListScreen} />
                  <Stack.Screen name="Centers" component={ProfilesListScreen} />
                  <Stack.Screen name="Teams" component={ProfilesListScreen} />
                  <Stack.Screen name="PostDetail" component={PostDetailScreen} />
                  <Stack.Screen name="UserProfile" component={ProfileScreen} />
                  <Stack.Screen name="Settings" component={SettingsScreen} />
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
        </View>
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
  appContainer: {
    flex: 1,
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: 800,
        alignSelf: 'center',
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: theme.colors.border,
      }
    })
  },
});
