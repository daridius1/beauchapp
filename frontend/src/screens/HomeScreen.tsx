import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';

export const theme = {
  colors: {
    primary: '#ffffff', // White accent
    background: '#000000', // Pure black background
    cardBg: '#0a0a0a', // Almost black cards
    text: '#ffffff', // Pure white text
    textMuted: '#888888', // Muted gray text
    border: '#222222', // Subtle dark border
    accent: '#ffffff', // White accents
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    md: 4,
    lg: 4,
  }
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  const announcements = [
    {
      id: '1',
      title: '🏆 Gran Torneo de Taca-Taca Beauchef 2026',
      date: 'Hace 2 horas',
      content: 'Inscríbete con tu pareja para el campeonato oficial del patio este viernes. ¡Premios sorpresa para los campeones!',
      tag: 'Torneos',
    },
    {
      id: '2',
      title: '♟️ Encuentros de Ajedrez - Patio de Ingeniería',
      date: 'Ayer',
      content: 'Las mesas de ajedrez están disponibles todos los días en el patio central. ¡Ven a jugar y participa en la comunidad!',
      tag: 'Ajedrez',
    },
    {
      id: '3',
      title: '⚙️ Lanzamiento oficial de Beauchapp',
      date: 'Hace 3 días',
      content: '¡Bienvenidos! Beauchapp ya está activa para la comunidad. Conéctate con tus compañeros y entérate de todas las novedades de los patios. Restringido solo a alumnos @ug.uchile.cl.',
      tag: 'Comunidad',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>Beauchapp 🏆</Text>
        <Text style={styles.heroSubtitle}>
          La plataforma comunitaria oficial para los patios de Beauchef.
        </Text>
        
        {!user ? (
          <TouchableOpacity 
            style={styles.heroButton} 
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.heroButtonText}>Registrarme con @ug.uchile.cl</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.welcomeBanner}>
            <Text style={styles.welcomeText}>¡Hola, {user.name}!</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Anuncios y Noticias</Text>

      {announcements.map((post) => (
        <View key={post.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.tagContainer}>
              <Text style={styles.tagText}>{post.tag}</Text>
            </View>
            <Text style={styles.cardDate}>{post.date}</Text>
          </View>
          <Text style={styles.cardTitle}>{post.title}</Text>
          <Text style={styles.cardContent}>{post.content}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg * 2,
  },
  heroSection: {
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  heroSubtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  heroButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  heroButtonText: {
    color: '#000000', // Black text on white button
    fontSize: 14,
    fontWeight: '600',
  },
  welcomeBanner: {
    paddingTop: theme.spacing.sm,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  userEloText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  eloValue: {
    color: theme.colors.accent,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  card: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  tagContainer: {
    backgroundColor: '#111111',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#222222',
  },
  tagText: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  cardDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  cardContent: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});
