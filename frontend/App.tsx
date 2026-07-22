import React, { useEffect, useState } from 'react';
import { StyleSheet, View, SafeAreaView, Platform, StatusBar, useWindowDimensions, DeviceEventEmitter } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { PostDetailScreen } from './src/screens/PostDetailScreen';
import { DirectoryScreen } from './src/screens/DirectoryScreen';
import { ProfilesListScreen } from './src/screens/ProfilesListScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Header } from './src/components/Header';
import { Sidebar } from './src/components/Sidebar';
import { theme } from './src/theme/theme';
import { RootStackParamList } from './src/types/navigation';
import { ProblemsListScreen } from './src/screens/ProblemsListScreen';
import { ProblemDetailScreen } from './src/screens/ProblemDetailScreen';
import { ProblemEditorScreen } from './src/screens/ProblemEditorScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { TinderScreen } from './src/screens/TinderScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { LaddersListScreen } from './src/screens/LaddersListScreen';
import { LadderDetailScreen } from './src/screens/LadderDetailScreen';
import { LadderMatchArbitratorScreen } from './src/screens/LadderMatchArbitratorScreen';
import { LadderMatchDetailScreen } from './src/screens/LadderMatchDetailScreen';
import { LadderPlayerProfileScreen } from './src/screens/LadderPlayerProfileScreen';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';

const Stack = createNativeStackNavigator<RootStackParamList>();

const NotFoundScreen = ({ navigation, route }: any) => (
  <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ padding: theme.spacing.lg }}>
      <HomeScreen navigation={navigation} route={route} />
    </View>
  </View>
);

const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: '#0a0a0a',
        borderLeftColor: theme.colors.primary,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        height: 'auto',
        minHeight: 60,
        paddingVertical: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ffffff',
      }}
      text2Style={{
        fontSize: 12,
        color: '#aaaaaa',
        numberOfLines: 3,
      }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{
        backgroundColor: '#0a0a0a',
        borderLeftColor: '#ef4444',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        height: 'auto',
        minHeight: 60,
        paddingVertical: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ffffff',
      }}
      text2Style={{
        fontSize: 12,
        color: '#aaaaaa',
        numberOfLines: 3,
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
      case 'LaddersList': return 'Ladders';
      case 'LadderDetail':
      case 'LadderMatchArbitrator':
      case 'LadderMatchDetail':
      case 'LadderPlayerProfile': {
        const slug = params?.slug;
        const name = params?.name;
        if (name) return name;
        if (slug === 'tiptap') return 'TipTap';
        if (slug === 'tenis-de-mesa') return 'Tenis de Mesa';
        if (slug === 'taca-taca') return 'Taca Taca';
        if (slug) {
          return slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
        return 'Competencia';
      }
      default: return 'Beauchapp';
    }
  };

  const showBackButton = currentRouteName !== 'Home' && currentRouteName !== 'Directory';

  const handleBack = () => {
    // Navegación defensiva anti-bucles para Ladders y Partidos
    if (['LadderMatchArbitrator', 'LadderMatchDetail'].includes(currentRouteName)) {
      const state = navigationRef.getRootState();
      const routes = state?.routes || [];
      const prevRoute = routes.length > 1 ? routes[routes.length - 2] : null;
      if (prevRoute && prevRoute.name === 'LadderDetail') {
        navigationRef.goBack();
      } else if (currentRouteParams?.slug) {
        navigationRef.navigate('LadderDetail', { slug: currentRouteParams.slug });
      } else {
        navigationRef.navigate('LaddersList');
      }
      return;
    }

    if (currentRouteName === 'LadderDetail') {
      navigationRef.navigate('LaddersList');
      return;
    }

    if (currentRouteName === 'LaddersList') {
      navigationRef.navigate('Home');
      return;
    }

    if (navigationRef.canGoBack()) {
      navigationRef.goBack();
    } else {
      if (['ProblemDetail', 'ProblemEditor'].includes(currentRouteName)) {
        navigationRef.navigate('ProblemsList');
      } else if (['UserProfile', 'Students', 'Communities', 'Centers', 'Teams', 'FollowList'].includes(currentRouteName)) {
        navigationRef.navigate('Directory');
      } else {
        navigationRef.navigate('Home');
      }
    }
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <NavigationContainer
        ref={navigationRef}
        linking={{
          prefixes: ['https://beauchapp.cl', 'beauchapp://'],
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
              LadderMatchDetail: 'ladders/matches/:matchId',
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
                  onRefresh={['Home', 'ProblemsList', 'Notifications', 'Profile', 'UserProfile', 'Communities', 'Centers', 'Teams', 'Students', 'FollowList', 'LaddersList', 'LadderDetail', 'LadderMatchDetail'].includes(currentRouteName) ? () => {
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
                    <Stack.Screen name="LadderMatchDetail" component={LadderMatchDetailScreen} />
                    <Stack.Screen name="LadderPlayerProfile" component={LadderPlayerProfileScreen} />
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
    backgroundColor: theme.colors.background,
  },
  appContainerDesktop: {
    maxWidth: 1050,
    alignSelf: 'center',
  },
});
