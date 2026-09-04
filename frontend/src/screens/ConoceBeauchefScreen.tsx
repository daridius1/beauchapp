import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ConoceBeauchef'>;

// Categorías de "Conoce Beauchef": cada una es un espacio donde la comunidad comparte
// cosas propias (fotos, historias) o hace match por gustos en común. Agregar una nueva
// categoría es agregar un ítem acá.
export const ConoceBeauchefScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  const categorias = [
    // Mismo gateo que tenía en ComunidadScreen: organizaciones no tienen perfil de citas.
    ...(user && user.type !== 'organization'
      ? [
          {
            id: 'Tinder',
            title: 'Tinder Beauchef',
            icon: 'heart',
            screen: 'Tinder',
          },
        ]
      : []),
    {
      id: 'Mascotas',
      title: 'Mascotas',
      icon: 'heart',
      screen: 'Mascotas',
    },
    {
      id: 'Musica',
      title: 'Música',
      icon: 'music',
      screen: 'Musica',
    },
    {
      id: 'Peliculas',
      title: 'Películas y Series',
      icon: 'film',
      screen: 'Peliculas',
    },
    {
      id: 'Videojuegos',
      title: 'Videojuegos',
      icon: 'cpu',
      screen: 'Videojuegos',
    },
    {
      id: 'Libros',
      title: 'Libros',
      icon: 'book',
      screen: 'Libros',
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {categorias.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.itemRow}
            activeOpacity={0.7}
            onPress={() => navigation.push(item.screen as any)}
          >
            <View style={styles.iconWrapper}>
              <Feather name={item.icon as any} size={20} color={theme.colors.text} />
            </View>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ))}
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 40,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconWrapper: {
    marginRight: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
