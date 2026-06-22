import React from 'react';
import { View, Text } from 'react-native';
import { Participant } from '../types';
import { styles } from '../styles';

interface ParticipantsTableProps {
  participants: Participant[];
}

export const ParticipantsTable: React.FC<ParticipantsTableProps> = ({ participants }) => {
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
              <View key={p.id} style={styles.leaderboardRow}>
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
                  <Text style={styles.participantEmail}>{p.predictionsCount} predicciones hechas</Text>
                </View>

                {/* Puntos */}
                <View style={styles.pointsContainer}>
                  <Text style={styles.pointsValue}>{p.totalPoints}</Text>
                  <Text style={styles.pointsSubText}>pts</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};
