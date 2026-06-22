import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from './HomeScreen';
import { Match } from './PollaContest/types';
import Toast from 'react-native-toast-message';
import { formatMatchDate } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'MatchPredictions'>;

interface MatchPrediction {
  id: string;
  userName: string;
  homeScore: number | null;
  awayScore: number | null;
  points: number;
}

export const MatchPredictionsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { matchId, contestId } = route.params;

  const [match, setMatch] = useState<Match | null>(null);
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch match details
        const matchData = await pb.collection('matches').getOne<Match>(matchId);
        setMatch(matchData);

        // Fetch predictions for this match, expand user to get their name
        const predictionsData = await pb.collection('predictions').getFullList<any>({
          filter: `match = "${matchId}"`,
          expand: 'user',
        });

        const mappedPreds: MatchPrediction[] = predictionsData.map((p) => ({
          id: p.id,
          userName: p.expand?.user?.name || 'Usuario',
          homeScore: p.homeScore,
          awayScore: p.awayScore,
          points: p.points,
        }));

        // Sort predictions: highest points first, then alphabetically by name
        mappedPreds.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return a.userName.localeCompare(b.userName);
        });

        setPredictions(mappedPreds);
      } catch (err: any) {
        console.error('Error fetching match predictions:', err);
        Toast.show({ type: 'error', text1: 'Ocurrió un error al cargar las apuestas del partido.', position: 'top' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [matchId]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtnText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        {match && (
          <View style={styles.matchCard}>
            <View style={styles.matchHeader}>
              <Text style={styles.stageText}>{match.stage}</Text>
              <Text style={styles.matchDate}>
                {formatMatchDate(match.date)}
              </Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {match.played ? 'FINALIZADO' : 'PENDIENTE'}
                </Text>
              </View>
            </View>

            <View style={styles.teamsRow}>
              <View style={[styles.teamCol, { alignItems: 'flex-start' }]}>
                <Text style={styles.flagEmoji}>{match.homeFlag}</Text>
                <Text style={styles.teamName}>{match.homeTeam}</Text>
              </View>

              <View style={styles.scoreCol}>
                {match.played ? (
                  <Text style={styles.officialScore}>
                    {match.homeScore} - {match.awayScore}
                  </Text>
                ) : (
                  <Text style={styles.vsText}>VS</Text>
                )}
              </View>

              <View style={[styles.teamCol, { alignItems: 'flex-end' }]}>
                <Text style={styles.flagEmoji}>{match.awayFlag}</Text>
                <Text style={styles.teamName}>{match.awayTeam}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.predictionsSection}>
          <Text style={styles.sectionTitle}>Apuestas Registradas ({predictions.length})</Text>

          {predictions.length === 0 ? (
            <Text style={styles.noPredText}>Nadie ha registrado una predicción para este partido aún.</Text>
          ) : (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Participante</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Apuesta</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Pts</Text>
              </View>
              
              {predictions.map((pred, index) => (
                <View key={pred.id} style={[styles.tableRow, index === predictions.length - 1 && styles.tableRowLast]}>
                  <Text style={[styles.tableCell, styles.cellName, { flex: 2 }]} numberOfLines={1}>
                    {pred.userName}
                  </Text>
                  <Text style={[styles.tableCell, styles.cellScore, { flex: 1, textAlign: 'center' }]}>
                    {pred.homeScore !== null ? pred.homeScore : '-'} - {pred.awayScore !== null ? pred.awayScore : '-'}
                  </Text>
                  <Text style={[styles.tableCell, styles.cellPoints, { flex: 1, textAlign: 'right' }]}>
                    {match?.played ? `+${pred.points}` : '-'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  headerRow: {
    marginBottom: theme.spacing.lg,
  },
  backBtn: {
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  matchCard: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.3)',
    paddingBottom: 8,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  matchDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginHorizontal: 8,
  },
  statusBadge: {
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  teamCol: {
    flex: 1,
  },
  flagEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  scoreCol: {
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  officialScore: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.accent,
  },
  vsText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  predictionsSection: {
    marginTop: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  noPredText: {
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    fontSize: 14,
  },
  tableContainer: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.3)',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    fontSize: 14,
  },
  cellName: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  cellScore: {
    color: theme.colors.text,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cellPoints: {
    color: '#22c55e',
    fontWeight: '700',
  },
});
