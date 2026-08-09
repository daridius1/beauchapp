import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Beauchapps'>;

export const BeauchappsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  const apps = [
    {
      id: 'Marketplace',
      title: 'Marketplace',
      icon: 'shopping-bag',
      screen: 'Marketplace',
    },
    {
      id: 'ProblemsList',
      title: 'Problemas',
      icon: 'book-open',
      screen: 'ProblemsList',
    },
    {
      id: 'LaddersList',
      title: 'Ladders',
      icon: 'award',
      screen: 'LaddersList',
    },
    {
      id: 'Reviews',
      title: 'Reseñas',
      icon: 'star',
      screen: 'Reviews',
    },
    {
      id: 'Beaudle',
      title: 'Beaudle',
      icon: 'grid',
      screen: 'Beaudle',
    },
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
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {apps.map((item) => (
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
