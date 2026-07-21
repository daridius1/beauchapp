import React, { useState, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Text, ScrollView, Platform, ActivityIndicator, DeviceEventEmitter, useWindowDimensions } from 'react-native';
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
import { ProblemsListScreen } from './src/screens/ProblemsListScreen';
import { ProblemDetailScreen } from './src/screens/ProblemDetailScreen';
import { ProblemEditorScreen } from './src/screens/ProblemEditorScreen';
import { TinderScreen } from './src/screens/TinderScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { LaddersListScreen } from './src/screens/LaddersListScreen';
import { LadderDetailScreen } from './src/screens/LadderDetailScreen';
import { LadderMatchArbitratorScreen } from './src/screens/LadderMatchArbitratorScreen';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import * as Linking from 'expo-linking';

if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    body {
      background-color: #0a0a0a;
      overflow-x: hidden;
      overscroll-behavior-y: contain;
      overscroll-behavior-x: none;
      -webkit-tap-highlight-color: transparent;
    }
    #root {
      height: 100vh;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);
}

const Stack = createNativeStackNavigator<RootStackParamList>();

// ----------------------------------------------------
// COMPONENTE CONTENEDOR PRINCIPAL
// ----------------------------------------------------
const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ 
        backgroundColor: '#0a0a0a',
        borderLeftColor: '#6366F1',
        borderWidth: 1,
        borderColor: '#222222',
        borderRadius: 8
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700'
      }}
      text2Style={{
        color: '#888888',
        fontSize: 12
      }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ 
        backgroundColor: '#0a0a0a',
        borderLeftColor: '#ff4444',
        borderWidth: 1,
        borderColor: '#222222',
        borderRadius: 8
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700'
      }}
      text2Style={{
        color: '#888888',
        fontSize: 12
      }}
    />
  )
};

function AppContent() {
  const { user, isInitialized } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
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
      case 'FollowList': {
        const type = params?.type;
        return type === 'followers' ? 'Seguidores' : 'Siguiendo';
      }
      case 'ProblemsList': return 'Problemas';
      case 'ProblemDetail': {
        const type = params?.type;
        return type === 'solution' ? 'Solución' : 'Problema';
      }
      case 'ProblemEditor': return params?.type === 'problem' ? 'Subir Problema' : 'Subir Pauta';
      case 'Tinder': return 'Tinder Beauchef';
      case 'Notifications': return 'Notificaciones';
      case 'LaddersList': return 'Ladders & Competencias';
      case 'LadderDetail': return 'Tabla de Posiciones';
      case 'LadderMatchArbitrator': return 'Arbitraje en Vivo';
      case 'NotFound': return 'No Encontrado';
      default: return 'Beauchapp';
    }
  };

  const rootScreens = ['Home', 'Profile', 'Settings', 'Directory', 'ProblemsList', 'Notifications', 'LaddersList'];
  const showBackButton = !rootScreens.includes(currentRouteName);

  const handleBack = () => {
    if (navigationRef.isReady()) {
      if (navigationRef.canGoBack()) {
        navigationRef.goBack();
      } else {
        // Fallback for deep-linking
        if (currentRouteName === 'ProblemDetail' || currentRouteName === 'ProblemEditor') {
          navigationRef.navigate('ProblemsList' as never);
        } else if (currentRouteName === 'LadderDetail' || currentRouteName === 'LadderMatchArbitrator') {
          navigationRef.navigate('LaddersList' as never);
        } else if (currentRouteName === 'PostDetail') {
          navigationRef.navigate('Home' as never);
        } else if (['Students', 'Communities', 'Centers', 'Teams', 'FollowList', 'UserProfile'].includes(currentRouteName)) {
          navigationRef.navigate('Directory' as never);
        } else {
          navigationRef.navigate('Home' as never);
        }
      }
    }
  };

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
              FollowList: 'users/:userId/:type',
              ProblemsList: 'problems',
              ProblemDetail: 'problems/:problemId',
              ProblemEditor: 'problems/editor/:type',
              Verification: 'verification',
              VerifyEmail: 'verify',
              ResetPassword: 'reset-password',
              Tinder: 'tinder',
              Notifications: 'notifications',
              LaddersList: 'ladders',
              LadderDetail: 'ladders/:slug',
              LadderMatchArbitrator: 'ladders/:slug/arbitrate',
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
        <View style={[styles.appContainer, isDesktop && styles.appContainerDesktop]}>
          {user ? (
            <View style={{ flex: 1, flexDirection: 'row' }}>
              {isDesktop && (
                <Sidebar 
                  activeScreen={currentRouteName} 
                  onNavigate={(screen) => {
                    navigationRef.navigate(screen as never);
                  }}
                  isDocked={true}
                />
              )}
              
              <View style={{ flex: 1, flexDirection: 'column' }}>
                <Header 
                  title={getScreenTitle(currentRouteName, currentRouteParams)} 
                  onToggleSidebar={isDesktop ? undefined : () => setIsSidebarOpen(true)} 
                  onBack={showBackButton ? handleBack : undefined}
                  onRefresh={['Home', 'ProblemsList', 'Notifications', 'Profile', 'UserProfile', 'Communities', 'Centers', 'Teams', 'Students', 'FollowList', 'LaddersList', 'LadderDetail'].includes(currentRouteName) ? () => {
                    DeviceEventEmitter.emit('onGlobalRefresh');
                  } : undefined}
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
                    <Stack.Screen name="FollowList" component={ProfilesListScreen} />
                    <Stack.Screen name="ProblemsList" component={ProblemsListScreen} />
                    <Stack.Screen name="ProblemDetail" component={ProblemDetailScreen} />
                    <Stack.Screen name="ProblemEditor" component={ProblemEditorScreen} />
                    <Stack.Screen name="Tinder" component={TinderScreen} />
                    <Stack.Screen name="Notifications" component={NotificationsScreen} />
                    <Stack.Screen name="LaddersList" component={LaddersListScreen} />
                    <Stack.Screen name="LadderDetail" component={LadderDetailScreen} />
                    <Stack.Screen name="LadderMatchArbitrator" component={LadderMatchArbitratorScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="NotFound" component={NotFoundScreen} />
                  </Stack.Navigator>
                </View>
              </View>

              {!isDesktop && (
                <Sidebar 
                  isOpen={isSidebarOpen} 
                  onClose={() => setIsSidebarOpen(false)} 
                  activeScreen={currentRouteName}
                  onNavigate={(screen) => {
                    navigationRef.navigate(screen as never);
                    setIsSidebarOpen(false);
                  }}
                  isDocked={false}
                />
              )}
            </View>
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
      <Toast config={toastConfig} />
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
      },
    }),
  },
  appContainerDesktop: {
    maxWidth: 1050,
  },
});
