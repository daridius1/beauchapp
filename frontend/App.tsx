import React, { useState, useRef } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Text, ScrollView, Platform, ActivityIndicator, PanResponder } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Header } from './src/components/Header';
import { Sidebar } from './src/components/Sidebar';
import { HomeScreen, theme } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

// ----------------------------------------------------
// COMPONENTE CONTENEDOR PRINCIPAL
// ----------------------------------------------------
function AppContent() {
  const { user, loading } = useAuth();
  const [activeScreen, setActiveScreen] = useState<string>('Home');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Gesto PanResponder para deslizar a la derecha y abrir el menú
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Detecta un deslizamiento a la derecha (dx > 40) iniciado en el borde izquierdo (x0 < 50)
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
      default: return 'Beauchapp';
    }
  };

  // Renderizado dinámico de pantallas
  const renderScreen = () => {
    switch (activeScreen) {
      case 'Home':
        return <HomeScreen onNavigate={setActiveScreen} />;
      case 'Profile':
        return <ProfileScreen onNavigate={setActiveScreen} />;
      default:
        return <HomeScreen onNavigate={setActiveScreen} />;
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

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.cardBg} />
        <LoginScreen onNavigate={setActiveScreen} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.cardBg} />
      
      {/* Header */}
      <Header 
        title={getScreenTitle(activeScreen)} 
        onToggleSidebar={() => setIsSidebarOpen(true)} 
      />

      {/* Main Body */}
      <View style={styles.body}>
        {renderScreen()}
      </View>

      {/* Sidebar de Navegación Lateral */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
      />
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
