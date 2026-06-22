import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { Match, PredictionState } from '../types';
import { styles } from '../styles';
import { theme } from '../../HomeScreen';

interface UserPredictionsPanelProps {
  groupedMatches: { [stage: string]: Match[] };
  predictions: PredictionState;
  handleScoreChange: (matchId: string, side: 'home' | 'away', value: string) => void;
  handleSavePredictions: () => void;
  saving: boolean;
  isAdminMode: boolean;
}

export const UserPredictionsPanel: React.FC<UserPredictionsPanelProps> = ({
  groupedMatches,
  predictions,
  handleScoreChange,
  handleSavePredictions,
  saving,
}) => {
  return (
    <View>
      {Object.keys(groupedMatches).length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay partidos programados para este concurso.</Text>
        </View>
      ) : (
        Object.keys(groupedMatches).map((stage) => (
          <View key={stage} style={styles.stageSection}>
            <View style={styles.stageHeader}>
              <Text style={styles.stageHeaderText}>{stage.toUpperCase()}</Text>
            </View>

            {groupedMatches[stage].map((match) => {
              const pred = predictions[match.id] || { homeScore: '', awayScore: '' };
              return (
                <View key={match.id} style={styles.matchCard}>
                  {/* Fecha y Fase */}
                  <View style={styles.matchHeader}>
                    <Text style={styles.matchDate}>
                      {match.date ? new Date(match.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Por definir'}
                    </Text>
                    {match.played && (
                      <View style={styles.infoBadgeContainer}>
                        <View style={styles.officialBadge}>
                          <Text style={styles.officialBadgeText}>FINALIZADO</Text>
                        </View>
                        {pred.id && (
                          <View style={styles.predSavedIndicator}>
                            <Text style={styles.predSavedText}>✓ Guardado</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={styles.teamsRow}>
                    {/* Equipo Local */}
                    <View style={[styles.teamContainer, styles.teamHome]}>
                      <Text style={styles.teamName} numberOfLines={2}>{match.homeTeam}</Text>
                      <Text style={styles.flagEmoji}>{match.homeFlag}</Text>
                    </View>

                    {/* Contenedor de Inputs o Resultados Oficiales */}
                    <View style={styles.scoreInputsContainer}>
                      {match.played ? (
                        // Si el partido ya se jugó, mostramos el marcador oficial y lo que el usuario predijo
                        <View style={styles.playedScoresContainer}>
                          <Text style={styles.playedScoreText}>
                            {match.homeScore} - {match.awayScore}
                          </Text>
                          <Text style={styles.predResultText}>
                            Tu predicción: {pred.homeScore || '-'} - {pred.awayScore || '-'}
                          </Text>
                        </View>
                      ) : (
                        // Si no se ha jugado, mostramos los inputs para predecir
                        <View style={styles.adminScoreRow}>
                          <TextInput
                            style={styles.scoreInput}
                            keyboardType="number-pad"
                            maxLength={2}
                            value={pred.homeScore}
                            onChangeText={(val) => handleScoreChange(match.id, 'home', val)}
                            placeholder="-"
                            placeholderTextColor={theme.colors.textMuted}
                            selectTextOnFocus
                          />
                          <Text style={styles.scoreDivider}>:</Text>
                          <TextInput
                            style={styles.scoreInput}
                            keyboardType="number-pad"
                            maxLength={2}
                            value={pred.awayScore}
                            onChangeText={(val) => handleScoreChange(match.id, 'away', val)}
                            placeholder="-"
                            placeholderTextColor={theme.colors.textMuted}
                            selectTextOnFocus
                          />
                        </View>
                      )}
                    </View>

                    {/* Equipo Visita */}
                    <View style={[styles.teamContainer, styles.teamAway]}>
                      <Text style={styles.flagEmoji}>{match.awayFlag}</Text>
                      <Text style={styles.teamName} numberOfLines={2}>{match.awayTeam}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}

      {/* Botón Guardar Predicciones (si hay partidos disponibles) */}
      {Object.keys(groupedMatches).length > 0 && (
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSavePredictions}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Predicciones</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};
