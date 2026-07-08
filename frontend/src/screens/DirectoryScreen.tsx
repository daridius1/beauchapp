import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity 
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Directory'>;

export const DirectoryScreen: React.FC<Props> = ({ navigation }) => {
  const categories = [
    {
      id: 'Communities',
      title: 'Comunidades',
      description: 'Grupos libres de estudiantes con intereses comunes, pasatiempos, arte y más.',
      icon: 'users' as const,
      color: '#3B82F6',
    },
    {
      id: 'Centers',
      title: 'Centros de Estudiantes',
      description: 'Órganos de representación estudiantil de plan común y de especialidades.',
      icon: 'award' as const,
      color: '#8B5CF6',
    },
    {
      id: 'Teams',
      title: 'Equipos y Proyectos',
      description: 'Grupos organizados oficiales, deportivos, robótica, investigación y tecnología.',
      icon: 'cpu' as const,
      color: '#F59E0B',
    },
    {
      id: 'Students',
      title: 'Personas',
      description: 'Explora y conecta con perfiles de tus compañeros y otros estudiantes.',
      icon: 'user' as const,
      color: '#10B981',
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryCard}
              activeOpacity={0.8}
              onPress={() => navigation.push(cat.id as any)}
            >
              <View style={[styles.iconWrapper, { backgroundColor: cat.color + '15' }]}>
                <Feather name={cat.icon} size={24} color={cat.color} />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.categoryTitle}>{cat.title}</Text>
                <Text style={styles.categoryDesc}>{cat.description}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingVertical: theme.spacing.lg,
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  categoryTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoryDesc: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
