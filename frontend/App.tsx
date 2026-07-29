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
import { MarketplaceScreen } from './src/screens/MarketplaceScreen';
import { MarketplaceItemDetailScreen } from './src/screens/MarketplaceItemDetailScreen';
import { SellerProfileScreen } from './src/screens/SellerProfileScreen';
import { SellerProfileEditorScreen } from './src/screens/SellerProfileEditorScreen';
import { MarketplaceItemEditorScreen } from './src/screens/MarketplaceItemEditorScreen';
import { BeauchappsScreen } from './src/screens/BeauchappsScreen';
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
        minHeight: 54,
        paddingVertical: 8,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
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
        minHeight: 54,
        paddingVertical: 8,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
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
  info: (props: any) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: '#0a0a0a',
        borderLeftColor: '#3b82f6',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        height: 'auto',
        minHeight: 54,
        paddingVertical: 8,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
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
};

function AppContent() {
  const { user, isInitialized } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [currentRouteName, setCurrentRouteName] = useState<string>('Home');
  const [currentRouteParams, setCurrentRouteParams] = useState<any>({});
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // Inyección global de Scroll Defensivo y Viewports PWA para Web/Safari/Chrome
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'beauchapp-pwa-defensive-css';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          #root, html, body {
            height: 100dvh !important;
            overscroll-behavior-y: contain !important;
            overscroll-behavior-x: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

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
      case 'Bands': return 'Bandas';
      case 'Beauchapps': return 'Beauchapps';
      case 'Settings': return 'Ajustes';
      case 'Directory': return 'Perfiles';
      case 'Students': return 'Personas';
      case 'FollowList': {
        const type = params?.type;
        return type === 'followers' ? 'Seguidores' : type === 'following' ? 'Siguiendo' : type === 'recommendations' ? 'Recomendaciones' : 'Integrantes';
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
      case 'Marketplace': return 'Marketplace';
      case 'MarketplaceItemDetail': return 'Producto';
      case 'SellerProfile': return 'Perfil de Vendedor';
      case 'SellerProfileEditor': return 'Editar Perfil de Vendedor';
      case 'MarketplaceItemEditor': return 'Publicar Producto';
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

  const showBackButton = currentRouteName !== 'Home' && currentRouteName !== 'Directory' && currentRouteName !== 'Beauchapps';

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
      } else if (['UserProfile', 'Students', 'Communities', 'Centers', 'Teams', 'Bands', 'FollowList'].includes(currentRouteName)) {
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
              Bands: 'bands',
              Directory: 'directory',
              Beauchapps: 'beauchapps',
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
              Marketplace: 'marketplace',
              MarketplaceItemDetail: 'marketplace/item/:itemId',
              SellerProfile: 'marketplace/seller/:sellerProfileId',
              SellerProfileEditor: 'marketplace/seller-editor',
              MarketplaceItemEditor: 'marketplace/item-editor',
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
                  onRefresh={['Home', 'ProblemsList', 'ProblemDetail', 'PostDetail', 'Notifications', 'Profile', 'UserProfile', 'Communities', 'Centers', 'Teams', 'Bands', 'Students', 'FollowList', 'LadderDetail', 'LadderMatchDetail', 'LadderPlayerProfile', 'Marketplace', 'MarketplaceItemDetail', 'SellerProfile', 'Tinder'].includes(currentRouteName) ? () => {
                    DeviceEventEmitter.emit('onGlobalRefresh');
                  } : undefined}
                />
                <View style={styles.body}>
                  <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="Directory" component={DirectoryScreen} />
                    <Stack.Screen name="Beauchapps" component={BeauchappsScreen} />
                    <Stack.Screen name="Students" component={ProfilesListScreen} />
                    <Stack.Screen name="Communities" component={ProfilesListScreen} />
                    <Stack.Screen name="Centers" component={ProfilesListScreen} />
                    <Stack.Screen name="Teams" component={ProfilesListScreen} />
                    <Stack.Screen name="Bands" component={ProfilesListScreen} />
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
                    <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
                    <Stack.Screen name="MarketplaceItemDetail" component={MarketplaceItemDetailScreen} />
                    <Stack.Screen name="SellerProfile" component={SellerProfileScreen} />
                    <Stack.Screen name="SellerProfileEditor" component={SellerProfileEditorScreen} />
                    <Stack.Screen name="MarketplaceItemEditor" component={MarketplaceItemEditorScreen} />
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
