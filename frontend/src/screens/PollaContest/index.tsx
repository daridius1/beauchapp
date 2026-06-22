import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, ActivityIndicator, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { pb } from '../../services/pocketbase';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types/navigation';
import { Match, Contest, PredictionState, EditingScoreState, NewMatchForm, Participant } from './types';
import { styles } from './styles';
import { UserPredictionsPanel } from './components/UserPredictionsPanel';
import { ParticipantsTable } from './components/ParticipantsTable';
import { AdminPanel } from './components/AdminPanel';

type Props = NativeStackScreenProps<RootStackParamList, 'PollaContest'>;

export const PollaContestScreen: React.FC<Props> = ({ navigation, route }) => {
  const { contestId } = route.params;
  const { user } = useAuth();
  
  const [contest, setContest] = useState<Contest | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<PredictionState>({});
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  const [activeTab, setActiveTab] = useState<'matches' | 'participants'>('matches');
  const [showRules, setShowRules] = useState<boolean>(false);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  
  // Estado para edición individual de partidos
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editingScores, setEditingScores] = useState<EditingScoreState>({});
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);

  // Estado para crear nuevo partido
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [newMatch, setNewMatch] = useState<NewMatchForm>({
    stage: '', homeTeam: '', homeFlag: '', awayTeam: '', awayFlag: '',
  });
  const [creatingMatch, setCreatingMatch] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isContestAdmin = !!(user && (user.isSuperadmin || (contest && contest.admins && contest.admins.includes(user.id))));

  const existingStages = [...new Set(matches.map(m => m.stage))];

  const fetchData = async () => {
    if (!contestId) {
      setError('ID de concurso inválido.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const contestData = await pb.collection('contests').getOne<Contest>(contestId);
      setContest(contestData);

      const matchesData = await pb.collection('matches').getFullList<Match>({
        filter: `contest = "${contestId}"`,
        sort: 'date',
      });
      setMatches(matchesData);

      if (user) {
        const predictionsData = await pb.collection('predictions').getFullList({
          filter: `user = "${user.id}" && match.contest = "${contestId}"`,
        });

        const initialPreds: PredictionState = {};
        predictionsData.forEach((pred: any) => {
          initialPreds[pred.match] = {
            id: pred.id,
            homeScore: (pred.homeScore !== undefined && pred.homeScore !== null) ? String(pred.homeScore) : '',
            awayScore: (pred.awayScore !== undefined && pred.awayScore !== null) ? String(pred.awayScore) : '',
          };
        });
        setPredictions(initialPreds);
      }

      const allPredictions = await pb.collection('predictions').getFullList({
        filter: `match.contest = "${contestId}"`,
        expand: 'user',
      });

      const participantsMap = new Map<string, Participant>();
      allPredictions.forEach((pred: any) => {
        if (pred.expand && pred.expand.user) {
          const u = pred.expand.user;
          const current = participantsMap.get(u.id);
          participantsMap.set(u.id, {
            id: u.id,
            name: u.name || 'Sin Nombre',
            email: u.email,
            predictionsCount: (current?.predictionsCount || 0) + 1,
            totalPoints: (current?.totalPoints || 0) + (pred.points || 0),
          });
        }
      });
      
      const sortedParticipants = Array.from(participantsMap.values()).sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        return a.name.localeCompare(b.name);
      });
      setParticipants(sortedParticipants);

    } catch (err: any) {
      console.error('Error al cargar datos del concurso:', err);
      setError('Error al obtener la información. Por favor, reintenta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [contestId, user]);

  const handleScoreChange = (matchId: string, side: 'home' | 'away', value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side === 'home' ? 'homeScore' : 'awayScore']: cleanValue,
      },
    }));
  };

  const startEditingMatch = (match: Match) => {
    setEditingMatchId(match.id);
    setEditingScores((prev) => ({
      ...prev,
      [match.id]: {
        homeScore: match.homeScore !== undefined && match.homeScore !== null ? String(match.homeScore) : '',
        awayScore: match.awayScore !== undefined && match.awayScore !== null ? String(match.awayScore) : '',
        played: !!match.played,
      },
    }));
  };

  const handleEditScoreChange = (matchId: string, side: 'home' | 'away', value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    setEditingScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side === 'home' ? 'homeScore' : 'awayScore']: cleanValue,
      },
    }));
  };

  const handleEditTogglePlayed = (matchId: string) => {
    setEditingScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        played: !prev[matchId].played,
      },
    }));
  };

  const handleSavePredictions = async () => {
    if (!user) return;
    
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const matchIds = Object.keys(predictions);
      let operationsCount = 0;
      const errors: string[] = [];

      for (const matchId of matchIds) {
        const match = matches.find(m => m.id === matchId);
        if (match?.played) continue;

        const pred = predictions[matchId];
        const hScoreStr = (pred.homeScore ?? '').trim();
        const aScoreStr = (pred.awayScore ?? '').trim();

        if (hScoreStr === '' || aScoreStr === '') continue;

        const homeScore = parseInt(hScoreStr, 10);
        const awayScore = parseInt(aScoreStr, 10);
        if (isNaN(homeScore) || isNaN(awayScore)) continue;

        const data = {
          user: user.id,
          match: matchId,
          homeScore,
          awayScore,
          points: 0,
        };

        try {
          if (pred.id) {
            await pb.collection('predictions').update(pred.id, data);
          } else {
            await pb.collection('predictions').create(data);
          }
          operationsCount++;
        } catch (innerErr: any) {
          console.error(`Error guardando predicción para partido ${matchId}:`, innerErr);
          errors.push(matchId);
        }
      }

      if (operationsCount === 0 && errors.length === 0) {
        setError('Ingresa al menos un marcador completo (Local y Visita) para guardar.');
        setSaving(false);
        return;
      }

      await fetchData();

      if (errors.length > 0) {
        setError(`Se guardaron ${operationsCount} predicción(es), pero hubo errores en ${errors.length}. Inténtalo de nuevo.`);
      } else {
        setSuccessMessage('¡Predicciones guardadas correctamente!');
        setTimeout(() => setSuccessMessage(null), 4000);
      }

    } catch (err: any) {
      console.error('Error al guardar predicciones:', err);
      setError('Ocurrió un error al guardar tus predicciones. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSingleMatch = async (matchId: string) => {
    if (!user || !isContestAdmin) return;

    const editData = editingScores[matchId];
    if (!editData) return;

    setSavingMatchId(matchId);
    setError(null);
    setSuccessMessage(null);

    try {
      const hScoreStr = editData.homeScore.trim();
      const aScoreStr = editData.awayScore.trim();

      const dataToSave: any = {
        played: editData.played,
      };

      if (hScoreStr !== '' && aScoreStr !== '') {
        const hs = parseInt(hScoreStr, 10);
        const as = parseInt(aScoreStr, 10);
        if (!isNaN(hs) && !isNaN(as)) {
          dataToSave.homeScore = hs;
          dataToSave.awayScore = as;
        } else {
          throw new Error("Marcador inválido");
        }
      } else if (hScoreStr === '' && aScoreStr === '') {
        dataToSave.homeScore = null;
        dataToSave.awayScore = null;
      } else {
        throw new Error("Marcador incompleto");
      }

      await pb.collection('matches').update(matchId, dataToSave);
      
      setEditingMatchId(null);
      await fetchData();
      setSuccessMessage('Resultado guardado correctamente.');
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      console.error('Error al guardar partido:', err);
      setError(err.message === "Marcador inválido" || err.message === "Marcador incompleto" 
        ? 'Ingresa ambos goles o deja ambos en blanco.' 
        : 'Error al guardar el partido. Verifica tus permisos.');
    } finally {
      setSavingMatchId(null);
    }
  };

  const handleCreateMatch = async () => {
    if (!user || !isContestAdmin || !contestId) return;

    const { stage, homeTeam, homeFlag, awayTeam, awayFlag } = newMatch;
    if (!stage.trim() || !homeTeam.trim() || !homeFlag.trim() || !awayTeam.trim() || !awayFlag.trim()) {
      setError('Completa todos los campos.');
      return;
    }

    setCreatingMatch(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await pb.collection('matches').create({
        contest: contestId,
        stage: stage.trim(),
        homeTeam: homeTeam.trim(),
        homeFlag: homeFlag.trim(),
        awayTeam: awayTeam.trim(),
        awayFlag: awayFlag.trim(),
        played: false,
      });

      setNewMatch({ stage: '', homeTeam: '', homeFlag: '', awayTeam: '', awayFlag: '' });
      setShowCreateForm(false);
      await fetchData();
      setSuccessMessage('Partido creado exitosamente.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error al crear partido:', err);
      setError('No se pudo crear el partido. Verifica que tengas permisos de administrador.');
    } finally {
      setCreatingMatch(false);
    }
  };

  const cancelEditingMatch = () => {
    setEditingMatchId(null);
    setError(null);
  };

  const groupedMatches: { [stage: string]: Match[] } = {};
  matches.forEach((match) => {
    if (!groupedMatches[match.stage]) {
      groupedMatches[match.stage] = [];
    }
    groupedMatches[match.stage].push(match);
  });

  if (loading) {
    return (
      <View style={[styles.keyboardContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.keyboardContainer}>
      <View style={styles.contentContainer}>
        
        {/* Cabecera / Navegación */}
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => navigation.navigate('Contests')}
          >
            <Text style={styles.backBtnText}>← Volver</Text>
          </TouchableOpacity>
          {isContestAdmin && (
            <TouchableOpacity 
              style={[styles.adminToggleBtn, isAdminMode && styles.adminToggleBtnActive]}
              onPress={() => setIsAdminMode(!isAdminMode)}
            >
              <Text style={[styles.adminToggleBtnText, isAdminMode && styles.adminToggleBtnTextActive]}>
                Panel Admin
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {contest && (
          <View style={styles.titleSection}>
            <Text style={styles.title}>{contest.name}</Text>
            <Text style={styles.description}>{contest.description}</Text>
            
            <TouchableOpacity onPress={() => setShowRules(!showRules)} style={styles.rulesToggle}>
              <Text style={styles.rulesToggleText}>{showRules ? 'Ocultar Reglas' : 'Ver Reglas de Puntuación'}</Text>
            </TouchableOpacity>
            {showRules && (
              <View style={styles.rulesContainer}>
                <Text style={styles.ruleItem}>• <Text style={styles.ruleHighlight}>3 puntos</Text> por acertar el resultado exacto (ej. predices 2-1 y termina 2-1).</Text>
                <Text style={styles.ruleItem}>• <Text style={styles.ruleHighlight}>1 punto</Text> por acertar al ganador o empate (ej. predices 2-1 y termina 3-0).</Text>
                <Text style={styles.ruleItem}>• <Text style={styles.ruleHighlight}>0 puntos</Text> si no aciertas ni el ganador ni el resultado exacto.</Text>
                <Text style={styles.ruleItem}>• El puntaje se actualiza automáticamente al finalizar el partido.</Text>
              </View>
            )}
          </View>
        )}

        {/* Pestañas (Ocultas si estamos en modo admin) */}
        {!isAdminMode && (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'matches' && styles.activeTab]}
              onPress={() => setActiveTab('matches')}
            >
              <Text style={[styles.tabText, activeTab === 'matches' && styles.activeTabText]}>Predicciones</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'participants' && styles.activeTab]}
              onPress={() => setActiveTab('participants')}
            >
              <Text style={[styles.tabText, activeTab === 'participants' && styles.activeTabText]}>Tabla de Posiciones</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mensajes de feedback */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {successMessage && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {/* Renderizado Condicional */}
        {isAdminMode ? (
          <AdminPanel 
            groupedMatches={groupedMatches}
            editingMatchId={editingMatchId}
            editingScores={editingScores}
            savingMatchId={savingMatchId}
            showCreateForm={showCreateForm}
            newMatch={newMatch}
            creatingMatch={creatingMatch}
            existingStages={existingStages}
            startEditingMatch={startEditingMatch}
            handleEditScoreChange={handleEditScoreChange}
            handleEditTogglePlayed={handleEditTogglePlayed}
            handleSaveSingleMatch={handleSaveSingleMatch}
            cancelEditingMatch={cancelEditingMatch}
            setShowCreateForm={setShowCreateForm}
            setNewMatch={setNewMatch}
            handleCreateMatch={handleCreateMatch}
            setError={setError}
          />
        ) : activeTab === 'matches' ? (
          <UserPredictionsPanel 
            groupedMatches={groupedMatches}
            predictions={predictions}
            handleScoreChange={handleScoreChange}
            handleSavePredictions={handleSavePredictions}
            saving={saving}
            isAdminMode={isAdminMode}
          />
        ) : (
          <ParticipantsTable participants={participants} />
        )}
      </View>
    </ScrollView>
  );
};
