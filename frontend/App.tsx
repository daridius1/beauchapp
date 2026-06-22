import React, { useState, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Text, ScrollView, Platform, ActivityIndicator, PanResponder } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Header } from './src/components/Header';
import { Sidebar } from './src/components/Sidebar';
import { HomeScreen, theme } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ContestsScreen } from './src/screens/ContestsScreen';
import { WorldCupContestScreen } from './src/screens/WorldCupContest';
import { SuperadminScreen } from './src/screens/SuperadminScreen';
import { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

// ----------------------------------------------------
// COMPONENTE CONTENEDOR PRINCIPAL
// ----------------------------------------------------
function AppContent() {
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [currentRouteName, setCurrentRouteName] = useState<string>('Home');
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // Gesto PanResponder para deslizar a la derecha y abrir el menú
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const isSwipeRight = gestureState.dx > 40 && Math.abs(gestureState.dy) < 30;
        const isNearLeftEdge = gestureState.x0 < 50;
        return isSwipeRight && isNearLeftEdge && !isSidebarOpen;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 40) {
          setIsSidebarOpen(true);
        }
      },
    })
  ).current;

  // Mapeo de títulos de pantalla
  const getScreenTitle = (screen: string) => {
    switch (screen) {
      case 'Home': return 'Inicio';
      case 'Profile': return 'Mi Perfil';
      case 'Contests': return 'Concursos';
      case 'WorldCupContest': return 'Polla Mundialera';
      case 'Superadmin': return 'Panel Superadmin';
      case 'Login': return 'Iniciar Sesión';
      default: return 'Beauchapp';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.cardBg} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.cardBg} />
      
      <NavigationContainer 
        ref={navigationRef}
        onStateChange={async () => {
          const currentRoute = navigationRef.getCurrentRoute();
          if (currentRoute) {
            setCurrentRouteName(currentRoute.name);
          }
        }}
      >
        {user ? (
          <>
            <Header 
              title={getScreenTitle(currentRouteName)} 
              onToggleSidebar={() => setIsSidebarOpen(true)} 
            />
            <View style={styles.body}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Contests" component={ContestsScreen} />
                <Stack.Screen name="WorldCupContest" component={WorldCupContestScreen} />
                <Stack.Screen name="Superadmin" component={SuperadminScreen} />
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
          </Stack.Navigator>
        )}
      </NavigationContainer>
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
  },
  body: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

});
