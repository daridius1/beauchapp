import React, { useEffect, useState } from 'react';
import { StyleSheet, View, SafeAreaView, Platform, StatusBar, useWindowDimensions, DeviceEventEmitter } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
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
import { notificationService } from './src/services/notifications';
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
import { ActivitiesScreen } from './src/screens/ActivitiesScreen';
import { ActivityDetailScreen } from './src/screens/ActivityDetailScreen';
import { ActivityEditorScreen } from './src/screens/ActivityEditorScreen';
import { BeauchappsScreen } from './src/screens/BeauchappsScreen';
import { ReviewsScreen } from './src/screens/ReviewsScreen';
import { CourseDetailScreen } from './src/screens/CourseDetailScreen';
import { ProfessorDetailScreen } from './src/screens/ProfessorDetailScreen';
import { InfoScreen } from './src/screens/InfoScreen';
import { InstallAppScreen } from './src/screens/InstallAppScreen';
import { AnnouncementModal } from './src/components/AnnouncementModal';
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
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState<boolean>(false);

  const checkUnreadNotifications = React.useCallback(async () => {
    if (!user) {
      setHasUnreadNotifications(false);
      return;
    }
    try {
      const count = await notificationService.getUnreadCount(user.id);
      setHasUnreadNotifications(count > 0);
    } catch (err) {
      console.warn('Error checking unread notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    checkUnreadNotifications();
    const interval = setInterval(checkUnreadNotifications, 10000);
    const subRefresh = DeviceEventEmitter.addListener('onGlobalRefresh', checkUnreadNotifications);
    const subRead = DeviceEventEmitter.addListener('onNotificationsRead', checkUnreadNotifications);
    return () => {
      clearInterval(interval);
      subRefresh.remove();
      subRead.remove();
    };
  }, [checkUnreadNotifications]);

  // Inyección global de Scroll Defensivo, Safe Area Insets iOS, Título Web e Ícono PWA para Web/Safari/Chrome
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Beauchapp';

      const styleId = 'beauchapp-pwa-defensive-css';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          html {
            height: 100% !important;
            height: 100dvh !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            min-height: 100% !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
            background-color: #0c0c0c !important;
            overscroll-behavior-y: contain !important;
            overscroll-behavior-x: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          #root {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            height: 100dvh !important;
            width: 100% !important;
            box-sizing: border-box !important;
            padding-top: env(safe-area-inset-top, 0px) !important;
            padding-left: env(safe-area-inset-left, 0px) !important;
            padding-right: env(safe-area-inset-right, 0px) !important;
          }
        `;
        document.head.appendChild(style);
      }

      let faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = '/favicon.png';
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
      case 'Activities': return 'Actividades';
      case 'ActivityDetail': return 'Actividad';
      case 'ActivityEditor': return 'Nueva Actividad';
      case 'Reviews': return 'Reseñas';
      case 'CourseDetail': return 'Ramo';
      case 'ProfessorDetail': return 'Profesor';
      case 'Info': return 'Info y Políticas';
      case 'InstallApp': return 'Instalar Aplicación';
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

  const showBackButton = currentRouteName !== 'Home' && currentRouteName !== 'Directory' && currentRouteName !== 'Beauchapps' && currentRouteName !== 'Activities';

  const handleBack = () => {
    // 1. Si hay historial real en la pila de navegación, volvemos limpiamente hacia atrás
    if (navigationRef.canGoBack()) {
      navigationRef.goBack();
      return;
    }

    // 2. Si NO hay historial previo (acceso directo por enlace profundo / refresco de página):
    // Redirigimos jerárquicamente a la pantalla contenedora lógica correspondiente:
    if (['LadderMatchArbitrator', 'LadderMatchDetail', 'LadderPlayerProfile', 'LadderDetail'].includes(currentRouteName)) {
      navigationRef.navigate('LaddersList' as never);
    } else if (['ProblemDetail', 'ProblemEditor'].includes(currentRouteName)) {
      navigationRef.navigate('ProblemsList' as never);
    } else if (['MarketplaceItemDetail', 'SellerProfile', 'SellerProfileEditor', 'MarketplaceItemEditor'].includes(currentRouteName)) {
      navigationRef.navigate('Marketplace' as never);
    } else if (['LaddersList', 'ProblemsList', 'Marketplace', 'Tinder', 'Reviews'].includes(currentRouteName)) {
      navigationRef.navigate('Beauchapps' as never);
    } else if (['UserProfile', 'Students', 'Communities', 'Centers', 'Teams', 'Bands', 'FollowList'].includes(currentRouteName)) {
      navigationRef.navigate('Directory' as never);
    } else if (['ActivityDetail', 'ActivityEditor'].includes(currentRouteName)) {
      navigationRef.navigate('Activities' as never);
    } else if (['CourseDetail', 'ProfessorDetail'].includes(currentRouteName)) {
      navigationRef.navigate('Reviews' as never);
    } else if (currentRouteName === 'PostDetail') {
      navigationRef.navigate('Home' as never);
    } else {
      navigationRef.navigate('Home' as never);
    }
  };

  if (!isInitialized) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <NavigationContainer
          ref={navigationRef}
          linking={{
            prefixes: [
              'http://localhost:8081',
              'http://127.0.0.1:8081',
              'https://beauchapp.cl',
              'beauchapp://',
            ],
            config: {
              screens: {
                Home: '',
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
                Activities: 'activities',
                ActivityDetail: 'activities/:activityId',
                ActivityEditor: 'activities/editor',
                Reviews: 'reviews',
                CourseDetail: 'reviews/course/:courseId',
                ProfessorDetail: 'reviews/professor/:professorId',
                Info: 'info',
                InstallApp: 'instalar',
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
                <AnnouncementModal />
                {isDesktop && (
                  <Sidebar 
                    activeScreen={currentRouteName} 
                    onNavigate={(screen) => {
                      navigationRef.navigate(screen as never);
                    }}
                    isDocked={true}
                    hasUnreadNotifications={hasUnreadNotifications}
                  />
                )}
                
                <View style={{ flex: 1, flexDirection: 'column' }}>
                  <Header 
                    title={getScreenTitle(currentRouteName, currentRouteParams)} 
                    onToggleSidebar={isDesktop ? undefined : () => setIsSidebarOpen(true)} 
                    onBack={showBackButton ? handleBack : undefined}
                    onRefresh={['Home', 'ProblemsList', 'ProblemDetail', 'PostDetail', 'Notifications', 'Profile', 'UserProfile', 'Communities', 'Centers', 'Teams', 'Bands', 'Students', 'FollowList', 'LadderDetail', 'LadderMatchDetail', 'LadderPlayerProfile', 'Marketplace', 'MarketplaceItemDetail', 'SellerProfile', 'Tinder', 'Activities', 'ActivityDetail', 'Reviews', 'CourseDetail', 'ProfessorDetail'].includes(currentRouteName) ? () => {
                      DeviceEventEmitter.emit('onGlobalRefresh');
                    } : undefined}
                    hasUnreadNotifications={hasUnreadNotifications}
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
                      <Stack.Screen name="Activities" component={ActivitiesScreen} />
                      <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
                      <Stack.Screen name="ActivityEditor" component={ActivityEditorScreen} />
                      <Stack.Screen name="Reviews" component={ReviewsScreen} />
                      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
                      <Stack.Screen name="ProfessorDetail" component={ProfessorDetailScreen} />
                      <Stack.Screen name="Settings" component={SettingsScreen} />
                      <Stack.Screen name="Info" component={InfoScreen} />
                      <Stack.Screen name="InstallApp" component={InstallAppScreen} />
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
                    hasUnreadNotifications={hasUnreadNotifications}
                  />
                )}
              </View>
            ) : (
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Verification" component={VerificationScreen} />
                <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                <Stack.Screen name="Info" component={InfoScreen} />
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
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
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
