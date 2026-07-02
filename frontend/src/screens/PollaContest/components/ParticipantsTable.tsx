import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../types/navigation';
import { Participant } from '../types';
import { styles } from '../styles';

interface ParticipantsTableProps {
  participants: Participant[];
  contestId: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PollaContest'>;

export const ParticipantsTable: React.FC<ParticipantsTableProps> = ({ participants, contestId }) => {
  const navigation = useNavigation<NavigationProp>();
  return (
    <View style={styles.participantsSection}>
      {participants.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay participantes registrados aún.</Text>
        </View>
      ) : (
        <View style={styles.leaderboardList}>
          {participants.map((p, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;

            return (
              <TouchableOpacity 
                key={p.id} 
                style={styles.leaderboardRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ParticipantPredictions', { 
                  contestId, 
                  participantId: p.id, 
                  participantName: p.name 
                })}
              >
                {/* Ranking / Medalla */}
                <View style={[
                  styles.rankBadge,
                  isFirst && styles.rankGold,
                  isSecond && styles.rankSilver,
                  isThird && styles.rankBronze,
                ]}>
                  <Text style={[
                    styles.rankText,
                    (isFirst || isSecond || isThird) && styles.rankTextPodium
                  ]}>
                    {index + 1}
                  </Text>
                </View>

                {/* Info Participante */}
                <View style={styles.leaderboardInfo}>
                  <Text style={styles.participantName}>{p.name}</Text>
                  <Text style={styles.participantEmail}>
                    🥇 {p.exactCount}  🥈 {p.diffCount}  🥉 {p.trendCount}
                  </Text>
                </View>

                {/* Puntos */}
                <View style={styles.pointsContainer}>
                  <Text style={styles.pointsValue}>{p.totalPoints}</Text>
                  <Text style={styles.pointsSubText}>pts</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};
