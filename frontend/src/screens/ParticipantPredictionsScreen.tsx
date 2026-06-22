import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from './HomeScreen';
import { Match } from './PollaContest/types';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'ParticipantPredictions'>;

interface Prediction {
  id: string;
  match: string;
  homeScore: number | null;
  awayScore: number | null;
  points: number;
}

export const ParticipantPredictionsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { contestId, participantId, participantName } = route.params;

  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<{ [matchId: string]: Prediction }>({});
  const [contestName, setContestName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch contest info
        const contestData = await pb.collection('contests').getOne(contestId);
        setContestName(contestData.name);

        // Fetch matches for this contest
        const matchesData = await pb.collection('matches').getFullList<Match>({
          filter: `contest = "${contestId}"`,
          sort: 'date',
        });
        setMatches(matchesData);

        // Fetch predictions for this specific user in this contest
        const predictionsData = await pb.collection('predictions').getFullList<any>({
          filter: `user = "${participantId}" && match.contest = "${contestId}"`,
        });

        const predsMap: { [matchId: string]: Prediction } = {};
        predictionsData.forEach((p) => {
          predsMap[p.match] = {
            id: p.id,
            match: p.match,
            homeScore: p.homeScore,
            awayScore: p.awayScore,
            points: p.points,
          };
        });
        setPredictions(predsMap);
      } catch (err: any) {
        console.error('Error fetching participant predictions:', err);
        Toast.show({ type: 'error', text1: 'Ocurrió un error al cargar las predicciones.', position: 'top' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contestId, participantId]);

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

        <View style={styles.headerInfo}>
          <Text style={styles.title}>Predicciones de {participantName}</Text>
          <Text style={styles.subtitle}>En {contestName}</Text>
        </View>

        {matches.map((match) => {
          const pred = predictions[match.id];
          const hasPred = pred !== undefined;

          return (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <Text style={styles.stageText}>{match.stage}</Text>
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

              <View style={styles.predContainer}>
                {hasPred ? (
                  <View style={styles.predRow}>
                    <Text style={styles.predLabel}>Apostó:</Text>
                    <Text style={styles.predScore}>
                      {pred.homeScore !== null ? pred.homeScore : '-'} - {pred.awayScore !== null ? pred.awayScore : '-'}
                    </Text>
                    {match.played && (
                      <View style={styles.pointsBadge}>
                        <Text style={styles.pointsBadgeText}>+{pred.points} pts</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.noPredText}>No registró predicción.</Text>
                )}
              </View>
            </View>
          );
        })}
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
    marginBottom: theme.spacing.md,
  },
  backBtn: {
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  headerInfo: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
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
    marginBottom: theme.spacing.md,
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
    marginBottom: theme.spacing.md,
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
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.accent,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  predContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    padding: theme.spacing.sm,
    borderRadius: 4,
  },
  predRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  predLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginRight: 8,
  },
  predScore: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  pointsBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pointsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
  },
  noPredText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
});
