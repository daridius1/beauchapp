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
          {/* Encabezados de Tabla */}
          <View style={[styles.leaderboardRow, { borderBottomWidth: 2, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.02)' }]}>
            <Text style={[styles.rankText, { fontSize: 13, minWidth: 24 }]}>#</Text>
            <View style={[styles.leaderboardInfo, { justifyContent: 'center' }]}>
              <Text style={{ color: '#888', fontSize: 13, fontWeight: '600' }}>Participante</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', marginRight: 16, width: 65, justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, width: 16, textAlign: 'center' }}>🥇</Text>
                <Text style={{ fontSize: 12, width: 16, textAlign: 'center' }}>🥈</Text>
                <Text style={{ fontSize: 12, width: 16, textAlign: 'center' }}>🥉</Text>
              </View>
              <View style={[styles.pointsContainer, { width: 32 }]}>
                <Text style={{ color: '#888', fontSize: 13, fontWeight: '600' }}>Pts</Text>
              </View>
            </View>
          </View>

          {/* Filas de Participantes */}
          {participants.map((p, index) => {
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
                {/* Ranking */}
                <Text style={styles.rankText}>{index + 1}.</Text>

                {/* Info Participante */}
                <View style={[styles.leaderboardInfo, { justifyContent: 'center' }]}>
                  <Text style={[styles.participantName, { marginBottom: 0 }]} numberOfLines={1}>{p.name}</Text>
                </View>

                {/* Medallas y Puntos (Valores Numéricos) */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', marginRight: 16, width: 65, justifyContent: 'space-between' }}>
                    <Text style={{ color: '#aaa', fontSize: 13, width: 16, textAlign: 'center' }}>{p.exactCount}</Text>
                    <Text style={{ color: '#aaa', fontSize: 13, width: 16, textAlign: 'center' }}>{p.diffCount}</Text>
                    <Text style={{ color: '#aaa', fontSize: 13, width: 16, textAlign: 'center' }}>{p.trendCount}</Text>
                  </View>
                  <View style={[styles.pointsContainer, { width: 32 }]}>
                    <Text style={styles.pointsValue}>{p.totalPoints}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};
