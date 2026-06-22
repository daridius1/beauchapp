import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Match, EditingScoreState, NewMatchForm } from '../types';
import { styles } from '../styles';
import { theme } from '../../HomeScreen';

interface AdminPanelProps {
  groupedMatches: { [stage: string]: Match[] };
  editingMatchId: string | null;
  editingScores: EditingScoreState;
  savingMatchId: string | null;
  showCreateForm: boolean;
  newMatch: NewMatchForm;
  creatingMatch: boolean;
  existingStages: string[];
  startEditingMatch: (match: Match) => void;
  handleEditFieldChange: (matchId: string, field: keyof EditingScoreState[string], value: string | boolean) => void;
  handleEditTogglePlayed: (matchId: string) => void;
  handleSaveSingleMatch: (matchId: string) => void;
  cancelEditingMatch: () => void;
  setShowCreateForm: (show: boolean) => void;
  setNewMatch: React.Dispatch<React.SetStateAction<NewMatchForm>>;
  handleCreateMatch: () => void;
  handleArchiveMatch: (matchId: string, currentActive: boolean) => void;
  setError: (err: string | null) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  groupedMatches,
  editingMatchId,
  editingScores,
  savingMatchId,
  showCreateForm,
  newMatch,
  creatingMatch,
  existingStages,
  startEditingMatch,
  handleEditFieldChange,
  handleEditTogglePlayed,
  handleSaveSingleMatch,
  cancelEditingMatch,
  setShowCreateForm,
  setNewMatch,
  handleCreateMatch,
  handleArchiveMatch,
  setError,
}) => {
  const confirmArchiveMatch = (match: Match) => {
    const isArchiving = match.active !== false;
    Alert.alert(
      isArchiving ? 'Archivar Partido' : 'Restaurar Partido',
      isArchiving ? '¿Estás seguro que deseas ocultar/archivar este partido?' : '¿Estás seguro que deseas restaurar este partido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, estoy seguro', style: isArchiving ? 'destructive' : 'default', onPress: () => handleArchiveMatch(match.id, isArchiving) }
      ]
    );
  };

  return (
    <View style={styles.adminSection}>
      {/* Cabecera del panel con botón Nuevo Partido */}
      <View style={styles.adminPanelHeader}>
        <Text style={styles.adminPanelTitle}>Gestión de Partidos</Text>
        <TouchableOpacity
          style={[styles.newMatchBtn, showCreateForm && styles.newMatchBtnActive]}
          onPress={() => {
            setShowCreateForm(!showCreateForm);
            setError(null);
          }}
        >
          <Text style={[styles.newMatchBtnText, showCreateForm && styles.newMatchBtnTextActive]}>
            {showCreateForm ? '✕ Cancelar' : '＋ Nuevo Partido'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Formulario de creación de nuevo partido */}
      {showCreateForm && (
        <View style={styles.createMatchCard}>
          <Text style={styles.createMatchTitle}>CREAR NUEVO PARTIDO</Text>

          {/* Selector de Categoría */}
          <Text style={styles.createMatchLabel}>Categoría / Fase</Text>
          {existingStages.length > 0 && (
            <View style={styles.stageChipsRow}>
              {existingStages.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.stageChip, newMatch.stage === s && styles.stageChipActive]}
                  onPress={() => setNewMatch(prev => ({ ...prev, stage: s }))}
                >
                  <Text style={[styles.stageChipText, newMatch.stage === s && styles.stageChipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TextInput
            style={styles.createInput}
            placeholder="O escribe una categoría nueva..."
            placeholderTextColor={theme.colors.textMuted}
            value={newMatch.stage}
            onChangeText={v => setNewMatch(prev => ({ ...prev, stage: v }))}
          />

          {/* Equipo Local */}
          <Text style={styles.createMatchLabel}>Equipo Local</Text>
          <View style={styles.teamInputRow}>
            <TextInput
              style={[styles.createInput, styles.flagInput]}
              placeholder="🏳️"
              placeholderTextColor={theme.colors.textMuted}
              value={newMatch.homeFlag}
              onChangeText={v => setNewMatch(prev => ({ ...prev, homeFlag: v }))}
            />
            <TextInput
              style={[styles.createInput, styles.teamNameInput]}
              placeholder="Nombre del equipo"
              placeholderTextColor={theme.colors.textMuted}
              value={newMatch.homeTeam}
              onChangeText={v => setNewMatch(prev => ({ ...prev, homeTeam: v }))}
            />
          </View>

          {/* Equipo Visita */}
          <Text style={styles.createMatchLabel}>Equipo Visita</Text>
          <View style={styles.teamInputRow}>
            <TextInput
              style={[styles.createInput, styles.flagInput]}
              placeholder="🏳️"
              placeholderTextColor={theme.colors.textMuted}
              value={newMatch.awayFlag}
              onChangeText={v => setNewMatch(prev => ({ ...prev, awayFlag: v }))}
            />
            <TextInput
              style={[styles.createInput, styles.teamNameInput]}
              placeholder="Nombre del equipo"
              placeholderTextColor={theme.colors.textMuted}
              value={newMatch.awayTeam}
              onChangeText={v => setNewMatch(prev => ({ ...prev, awayTeam: v }))}
            />
          </View>

          {/* Fecha y Hora */}
          <Text style={styles.createMatchLabel}>Fecha y Hora (Horario Local, ej. 2026-06-25 15:30)</Text>
          <TextInput
            style={styles.createInput}
            placeholder="YYYY-MM-DD HH:mm"
            placeholderTextColor={theme.colors.textMuted}
            value={newMatch.date}
            onChangeText={v => setNewMatch(prev => ({ ...prev, date: v }))}
          />

          <TouchableOpacity
            style={[styles.createMatchSubmitBtn, creatingMatch && styles.saveButtonDisabled]}
            onPress={handleCreateMatch}
            disabled={creatingMatch}
            activeOpacity={0.8}
          >
            {creatingMatch ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createMatchSubmitBtnText}>Crear Partido</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de partidos existentes por fase */}
      {Object.keys(groupedMatches).map((stage) => (
        <View key={stage} style={styles.stageSection}>
          <View style={styles.stageHeader}>
            <Text style={styles.stageHeaderText}>{stage.toUpperCase()}</Text>
          </View>

          {groupedMatches[stage].map((match) => {
            const isEditing = editingMatchId === match.id;
            const editData = editingScores[match.id] || { homeScore: '', awayScore: '', played: false };

            return (
              <View key={match.id} style={styles.adminMatchContainer}>
                {isEditing ? (
                  // Formulario de edición para el partido seleccionado
                  <View style={styles.editCard}>
                    <Text style={styles.editCardTitle}>Editar Detalles y Resultado</Text>
                    
                    <View style={styles.teamInputRow}>
                      <TextInput
                        style={[styles.createInput, styles.flagInput, { height: 34 }]}
                        value={editData.homeFlag}
                        onChangeText={(val) => handleEditFieldChange(match.id, 'homeFlag', val)}
                        placeholder="🏳️"
                      />
                      <TextInput
                        style={[styles.createInput, styles.teamNameInput, { height: 34 }]}
                        value={editData.homeTeam}
                        onChangeText={(val) => handleEditFieldChange(match.id, 'homeTeam', val)}
                        placeholder="Local"
                      />
                    </View>

                    <View style={styles.editRow}>
                      <View style={styles.editInputsContainer}>
                        <TextInput
                          style={styles.editScoreInput}
                          keyboardType="number-pad"
                          maxLength={2}
                          value={editData.homeScore}
                          onChangeText={(val) => handleEditFieldChange(match.id, 'homeScore', val)}
                          placeholder="-"
                          placeholderTextColor={theme.colors.textMuted}
                        />
                        <Text style={styles.editScoreDivider}>:</Text>
                        <TextInput
                          style={styles.editScoreInput}
                          keyboardType="number-pad"
                          maxLength={2}
                          value={editData.awayScore}
                          onChangeText={(val) => handleEditFieldChange(match.id, 'awayScore', val)}
                          placeholder="-"
                          placeholderTextColor={theme.colors.textMuted}
                        />
                      </View>
                    </View>

                    <View style={styles.teamInputRow}>
                      <TextInput
                        style={[styles.createInput, styles.flagInput, { height: 34 }]}
                        value={editData.awayFlag}
                        onChangeText={(val) => handleEditFieldChange(match.id, 'awayFlag', val)}
                        placeholder="🏳️"
                      />
                      <TextInput
                        style={[styles.createInput, styles.teamNameInput, { height: 34 }]}
                        value={editData.awayTeam}
                        onChangeText={(val) => handleEditFieldChange(match.id, 'awayTeam', val)}
                        placeholder="Visita"
                      />
                    </View>

                    <Text style={[styles.createMatchLabel, { marginTop: theme.spacing.sm }]}>Fecha y Hora</Text>
                    <TextInput
                      style={[styles.createInput, { height: 34, marginBottom: theme.spacing.sm }]}
                      placeholder="YYYY-MM-DD HH:mm"
                      placeholderTextColor={theme.colors.textMuted}
                      value={editData.date}
                      onChangeText={(val) => handleEditFieldChange(match.id, 'date', val)}
                    />

                    <View style={styles.editActions}>
                      <TouchableOpacity
                        style={[styles.playedToggle, editData.played && styles.playedToggleActive]}
                        onPress={() => handleEditTogglePlayed(match.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.playedToggleText, editData.played && styles.playedToggleTextActive]}>
                          {editData.played ? '✓ MARCADO COMO FINALIZADO' : '¿MARCAR COMO FINALIZADO?'}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.editButtonsRow}>
                        <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditingMatch}>
                          <Text style={styles.cancelEditBtnText}>Cancelar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.saveEditBtn}
                          onPress={() => handleSaveSingleMatch(match.id)}
                          disabled={savingMatchId === match.id}
                        >
                          {savingMatchId === match.id ? (
                            <ActivityIndicator size="small" color="#0f172a" />
                          ) : (
                            <Text style={styles.saveEditBtnText}>Guardar</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : (
                  // Vista de solo lectura del partido (con botón para editar)
                  <View style={styles.adminMatchRow}>
                    <View style={styles.adminMatchInfo}>
                      <View style={styles.adminMatchTeam}>
                        <Text style={styles.flagEmoji}>{match.homeFlag}</Text>
                        <Text style={styles.adminTeamName} numberOfLines={1}>{match.homeTeam}</Text>
                      </View>

                      <Text style={styles.adminScoreText}>
                        {match.homeScore !== undefined && match.homeScore !== null ? match.homeScore : '-'} 
                        {' : '}
                        {match.awayScore !== undefined && match.awayScore !== null ? match.awayScore : '-'}
                      </Text>

                      <View style={[styles.adminMatchTeam, styles.teamAlignRight]}>
                        <Text style={styles.adminTeamName} numberOfLines={1}>{match.awayTeam}</Text>
                        <Text style={styles.flagEmoji}>{match.awayFlag}</Text>
                      </View>
                    </View>

                    <View style={styles.adminMatchFooter}>
                      <View style={[styles.statusBadge, match.played ? styles.statusBadgePlayed : styles.statusBadgePending]}>
                        <Text style={[styles.statusBadgeText, match.played ? styles.statusBadgeTextPlayed : styles.statusBadgeTextPending]}>
                          {match.played ? 'FINALIZADO' : 'PENDIENTE'}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                          style={styles.modifyBtn}
                          onPress={() => startEditingMatch(match)}
                        >
                          <Text style={styles.modifyBtnText}>
                            {match.played ? 'Modificar' : 'Registrar Resultado'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modifyBtn, match.active !== false
                            ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', marginLeft: 8 }
                            : { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)', marginLeft: 8 }
                          ]}
                          onPress={() => confirmArchiveMatch(match)}
                        >
                          <Text style={[styles.modifyBtnText, match.active !== false ? { color: '#ef4444' } : { color: '#22c55e' }]}>
                            {match.active !== false ? 'Archivar' : 'Restaurar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};
