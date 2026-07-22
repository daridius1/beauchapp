import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { theme } from '../theme/theme';
import { ladderService } from '../services/ladderService';
import { Ladder } from '../types/ladder';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { TacaTacaArbitrator } from '../components/arbitrators/TacaTacaArbitrator';
import { TableTennisArbitrator } from '../components/arbitrators/TableTennisArbitrator';
import { TipTapArbitrator } from '../components/arbitrators/TipTapArbitrator';

type ArbitratorScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LadderMatchArbitrator'>;
type ArbitratorScreenRouteProp = RouteProp<RootStackParamList, 'LadderMatchArbitrator'>;

interface Props {
  navigation: ArbitratorScreenNavigationProp;
  route: ArbitratorScreenRouteProp;
}

export const LadderMatchArbitratorScreen: React.FC<Props> = ({ navigation, route }) => {
  const { slug } = route.params;
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadLadder = async () => {
      try {
        const l = await ladderService.getLadderBySlug(slug);
        setLadder(l);
      } catch (err) {
        console.error('Error loading ladder for arbitrator:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLadder();
  }, [slug]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!ladder) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No se encontró la disciplina deportiva especificada.</Text>
      </View>
    );
  }

  // Router dinámico de árbitros según la disciplina deportiva
  if (ladder.slug.startsWith('taca-taca')) {
    return <TacaTacaArbitrator ladder={ladder} navigation={navigation} />;
  }

  if (ladder.slug.startsWith('tenis-de-mesa')) {
    return <TableTennisArbitrator ladder={ladder} navigation={navigation} />;
  }

  if (ladder.slug.startsWith('tiptap')) {
    return <TipTapArbitrator ladder={ladder} navigation={navigation} />;
  }

  // Fallback por defecto: Taca Taca
  return <TacaTacaArbitrator ladder={ladder} navigation={navigation} />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
