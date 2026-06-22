import React, { useState } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Text, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Header } from './src/components/Header';
import { Sidebar } from './src/components/Sidebar';
import { HomeScreen, theme } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { MatchRegisterScreen } from './src/screens/MatchRegisterScreen';

// ----------------------------------------------------
// PESTAÑA / COMPONENTE: RANKINGS (Pestaña del menú)
// ----------------------------------------------------
const RankingsScreen: React.FC = () => {
  // Datos estáticos placeholder para ilustrar el ELO
  const rankings = [
    { rank: 1, name: 'Diego Silva', email: 'diego@ug.uchile.cl', elo: 1350, winRate: '75%' },
    { rank: 2, name: 'Camila Rojas', email: 'camila@ug.uchile.cl', elo: 1290, winRate: '68%' },
    { rank: 3, name: 'Ignacio Fuentes', email: 'ignacio@ug.uchile.cl', elo: 1240, winRate: '60%' },
    { rank: 4, name: 'Sofía Valenzuela', email: 'sofia@ug.uchile.cl', elo: 1205, winRate: '50%' },
    { rank: 5, name: 'Tú', email: 'estudiante@ug.uchile.cl', elo: 1200, winRate: '0%' },
  ];

  return (
    <ScrollView style={styles.rankingsContainer} contentContainerStyle={styles.rankingsContent}>
      <Text style={styles.rankingsTitle}>Tabla de Posiciones ELO</Text>
      <Text style={styles.rankingsSubtitle}>disciplina: Taca-Taca (Patio Central)</Text>
      
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 0.15 }]}>Pos</Text>
        <Text style={[styles.headerCell, { flex: 0.5 }]}>Jugador</Text>
        <Text style={[styles.headerCell, { flex: 0.2, textAlign: 'right' }]}>ELO</Text>
        <Text style={[styles.headerCell, { flex: 0.15, textAlign: 'right' }]}>Win%</Text>
      </View>

      {rankings.map((player) => (
        <View 
          key={player.rank} 
          style={[
            styles.tableRow, 
            player.name === 'Tú' && styles.myRow
          ]}
        >
          <Text style={[styles.cellText, { flex: 0.15, fontWeight: '700', color: player.rank <= 3 ? theme.colors.accent : theme.colors.text }]}>
            #{player.rank}
          </Text>
          <Text style={[styles.cellText, { flex: 0.5, fontWeight: '600' }]} numberOfLines={1}>
            {player.name}
          </Text>
          <Text style={[styles.cellText, { flex: 0.2, textAlign: 'right', fontWeight: '800', color: theme.colors.accent }]}>
            {player.elo}
          </Text>
          <Text style={[styles.cellText, { flex: 0.15, textAlign: 'right', color: theme.colors.textMuted }]}>
            {player.winRate}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};

// ----------------------------------------------------
// COMPONENTE CONTENEDOR PRINCIPAL
// ----------------------------------------------------
function AppContent() {
  const { user, loading } = useAuth();
  const [activeScreen, setActiveScreen] = useState<string>('Home');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Mapeo de títulos de pantalla
  const getScreenTitle = (screen: string) => {
    switch (screen) {
      case 'Home': return 'Inicio';
      case 'Rankings': return 'Clasificación';
      case 'RegisterMatch': return 'Registrar Marcador';
      case 'Profile': return 'Mi Perfil';
      default: return 'Beauchapp';
    }
  };

  // Renderizado dinámico de pantallas
  const renderScreen = () => {
    switch (activeScreen) {
      case 'Home':
        return <HomeScreen onNavigate={setActiveScreen} />;
      case 'Rankings':
        return <RankingsScreen />;
      case 'RegisterMatch':
        return <MatchRegisterScreen onNavigate={setActiveScreen} />;
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
    <SafeAreaView style={styles.safeArea}>
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
  // Estilos del rankings screen
  rankingsContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  rankingsContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg * 2,
  },
  rankingsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  rankingsSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
    textTransform: 'uppercase',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  headerCell: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
  },
  myRow: {
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    borderWidth: 1,
  },
  cellText: {
    color: theme.colors.text,
    fontSize: 14,
  },
});
