import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, ActivityIndicator, Image, DeviceEventEmitter } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { pb } from '../../services/pocketbase';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types/navigation';
import { Match, Contest, PredictionState, EditingScoreState, NewMatchForm, Participant } from './types';
import { styles } from './styles';
import { UserPredictionsPanel } from './components/UserPredictionsPanel';
import { ParticipantsTable } from './components/ParticipantsTable';
import { AdminPanel } from './components/AdminPanel';
import Toast from 'react-native-toast-message';
import { theme } from '../../theme/theme';

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
    stage: '', homeTeam: '', homeFlag: '', awayTeam: '', awayFlag: '', date: '', tag: '',
  });
  const [creatingMatch, setCreatingMatch] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isContestAdmin = !!(user && (contest && contest.admins && contest.admins.includes(user.id)));

  const existingStages = [...new Set(matches.map(m => m.stage))];

  const fetchData = async (showLoadingIndicator: boolean = true) => {
    if (!contestId) {
      Toast.show({ type: 'error', text1: 'ID de concurso inválido.', position: 'top' });
      if (showLoadingIndicator) setLoading(false);
      return;
    }

    try {
      if (showLoadingIndicator) setLoading(true);

      const contestData = await pb.collection('contests').getOne<Contest>(contestId);
      setContest(contestData);

      // Compute admin status here with fresh data to avoid stale closure
      const isAdmin = !!(user && (contestData.admins && contestData.admins.includes(user.id)));
      const matchFilter = isAdmin ? `contest = "${contestId}"` : `contest = "${contestId}" && active = true`;
      const matchesData = await pb.collection('matches').getFullList<Match>({
        filter: matchFilter,
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
            exactCount: (current?.exactCount || 0) + (pred.points === 6 ? 1 : 0),
            diffCount: (current?.diffCount || 0) + (pred.points === 4 ? 1 : 0),
            trendCount: (current?.trendCount || 0) + (pred.points === 3 ? 1 : 0),
          });
        }
      });
      
      const sortedParticipants = Array.from(participantsMap.values()).sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
        if (b.diffCount !== a.diffCount) return b.diffCount - a.diffCount;
        if (b.trendCount !== a.trendCount) return b.trendCount - a.trendCount;
        return a.name.localeCompare(b.name);
      });
      setParticipants(sortedParticipants);

    } catch (err: any) {
      console.error('Error al cargar datos del concurso:', err);
      Toast.show({ type: 'error', text1: 'Error al obtener la información. Por favor, reintenta.', position: 'top' });
    } finally {
      if (showLoadingIndicator) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', () => fetchData(true));
    return () => sub.remove();
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
    // Format the date to YYYY-MM-DD HH:mm local time
    let formattedDate = '';
    if (match.date) {
      const d = new Date(match.date);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        formattedDate = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
      }
    }

    setEditingMatchId(match.id);
    setEditingScores((prev) => ({
      ...prev,
      [match.id]: {
        homeScore: match.homeScore?.toString() || '',
        awayScore: match.awayScore?.toString() || '',
        played: match.played || false,
        homeTeam: match.homeTeam || '',
        awayTeam: match.awayTeam || '',
        homeFlag: match.homeFlag || '',
        awayFlag: match.awayFlag || '',
        date: formattedDate,
        tag: match.tag || '',
      },
    }));
  };

  const handleEditFieldChange = (matchId: string, field: keyof EditingScoreState[string], value: string | boolean) => {
    setEditingScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value,
      },
    }));
  };

  const handleEditTogglePlayed = (matchId: string) => {
    setEditingScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        played: !prev[matchId]?.played,
      },
    }));
  };

  const handleSavePredictions = async () => {
    if (!user) return;
    
    setSaving(true);

    try {
      const matchIds = Object.keys(predictions);
      let operationsCount = 0;
      const errors: string[] = [];

      for (const matchId of matchIds) {
        const match = matches.find(m => m.id === matchId);
        if (!match) continue;
        
        // No guardar si el partido ya se jugó o si está bloqueado (faltan < 10 mins)
        const matchTime = match.date ? new Date(match.date.replace(' ', 'T')).getTime() : 0;
        const isLocked = !match.played && matchTime > 0 && Date.now() >= matchTime - 10 * 60 * 1000;
        if (match.played || isLocked) continue;

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
        Toast.show({ type: 'error', text1: 'Ingresa al menos un marcador completo (Local y Visita) para guardar.', position: 'top' });
        setSaving(false);
        return;
      }

      await fetchData(false);

      if (errors.length > 0) {
        Toast.show({ type: 'error', text1: `Se guardaron ${operationsCount} predicción(es), pero hubo errores en ${errors.length}. Inténtalo de nuevo.`, position: 'top' });
      } else {
        Toast.show({
          type: 'success',
          text1: '¡Predicciones guardadas correctamente!',
          position: 'top',
        });
      }

    } catch (err: any) {
      console.error('Error al guardar predicciones:', err);
      Toast.show({ type: 'error', text1: 'Ocurrió un error al guardar tus predicciones. Inténtalo de nuevo.', position: 'top' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSingleMatch = async (matchId: string) => {
    if (!user || !isContestAdmin) return;

    const editData = editingScores[matchId];
    if (!editData) return;

    setSavingMatchId(matchId);

    try {
      const hScoreStr = editData.homeScore.trim();
      const aScoreStr = editData.awayScore.trim();

      const dataToSave: any = {
        played: editData.played,
        homeTeam: editData.homeTeam.trim(),
        awayTeam: editData.awayTeam.trim(),
        homeFlag: editData.homeFlag.trim(),
        awayFlag: editData.awayFlag.trim(),
        tag: editData.tag ? editData.tag.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '',
      };

      if (!dataToSave.homeTeam || !dataToSave.awayTeam || !dataToSave.homeFlag || !dataToSave.awayFlag || !editData.date.trim()) {
        throw new Error("Datos incompletos");
      }

      // Try parsing date
      try {
        const d = new Date(editData.date);
        if (isNaN(d.getTime())) throw new Error("Fecha inválida");
        dataToSave.date = d.toISOString();
      } catch (e) {
        throw new Error("Fecha inválida");
      }

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
      await fetchData(false);
      Toast.show({
        type: 'success',
        text1: 'Resultado guardado correctamente.',
        position: 'top',
      });

    } catch (err: any) {
      console.error('Error al guardar partido:', err);
      let msg = 'Error al guardar el partido. Verifica tus permisos.';
      if (err.message === "Marcador inválido" || err.message === "Marcador incompleto") {
        msg = 'Ingresa ambos goles o deja ambos en blanco.';
      } else if (err.message === "Datos incompletos") {
        msg = 'Completa todos los campos del partido.';
      } else if (err.message === "Fecha inválida") {
        msg = 'Formato de fecha inválido. Usa YYYY-MM-DD HH:mm';
      }
      Toast.show({ type: 'error', text1: msg, position: 'top' });
    } finally {
      setSavingMatchId(null);
    }
  };

  const handleCreateMatch = async () => {
    if (!user || !isContestAdmin || !contestId) return;

    const { stage, homeTeam, homeFlag, awayTeam, awayFlag, date, tag } = newMatch;
    if (!stage.trim() || !homeTeam.trim() || !homeFlag.trim() || !awayTeam.trim() || !awayFlag.trim() || !date.trim()) {
      Toast.show({ type: 'error', text1: 'Completa todos los campos obligatorios, incluyendo la fecha.', position: 'top' });
      return;
    }

    // Try parsing date from local timezone (YYYY-MM-DD HH:mm) to UTC ISO string
    let parsedDate: string;
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) throw new Error("Fecha inválida");
      parsedDate = d.toISOString();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Formato de fecha inválido. Usa YYYY-MM-DD HH:mm', position: 'top' });
      return;
    }

    setCreatingMatch(true);

    try {
      await pb.collection('matches').create({
        contest: contestId,
        stage: stage.trim(),
        homeTeam: homeTeam.trim(),
        homeFlag: homeFlag.trim(),
        awayTeam: awayTeam.trim(),
        awayFlag: awayFlag.trim(),
        date: parsedDate,
        tag: tag.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(),
        active: true,
        played: false,
      });

      setNewMatch({ stage: '', homeTeam: '', homeFlag: '', awayTeam: '', awayFlag: '', date: '', tag: '' });
      setShowCreateForm(false);
      await fetchData(false);
      Toast.show({
        type: 'success',
        text1: 'Partido creado exitosamente.',
        position: 'top',
      });
    } catch (err: any) {
      console.error('Error al crear partido:', err);
      Toast.show({ type: 'error', text1: 'No se pudo crear el partido. Verifica que tengas permisos de administrador.', position: 'top' });
    } finally {
      setCreatingMatch(false);
    }
  };

  const handleArchiveMatch = async (matchId: string, currentActive: boolean) => {
    if (!user || !isContestAdmin) return;
    const newActive = !currentActive;
    try {
      await pb.collection('matches').update(matchId, { active: newActive });
      Toast.show({ type: 'success', text1: newActive ? 'Partido restaurado.' : 'Partido archivado.', position: 'top' });
      await fetchData(false);
    } catch (err: any) {
      console.error('Error al cambiar estado del partido:', err);
      Toast.show({ type: 'error', text1: 'No se pudo cambiar el estado del partido.', position: 'top' });
    }
  };

  const cancelEditingMatch = () => {
    setEditingMatchId(null);
  };

  // All matches grouped (for admin panel - includes archived)
  const groupedMatches: { [stage: string]: Match[] } = {};
  matches.forEach((match) => {
    if (!groupedMatches[match.stage]) {
      groupedMatches[match.stage] = [];
    }
    groupedMatches[match.stage].push(match);
  });

  // Only active matches grouped (for user predictions view)
  const activeMatches = matches.filter(m => m.active !== false);
  const groupedActiveMatches: { [stage: string]: Match[] } = {};
  activeMatches.forEach((match) => {
    if (!groupedActiveMatches[match.stage]) {
      groupedActiveMatches[match.stage] = [];
    }
    groupedActiveMatches[match.stage].push(match);
  });

  if (loading) {
    return (
      <View style={[styles.keyboardContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.title}>{contest.name}</Text>
              {contest.tag ? (
                <TouchableOpacity 
                  onPress={() => {
                    navigation.navigate('Home', { 
                      initialFilterTag: contest.tag,
                      initialPostTags: [contest.tag!]
                    });
                  }}
                  style={[styles.matchTagBadge, { marginBottom: theme.spacing.xs, marginLeft: theme.spacing.sm }]}
                >
                  <Text style={styles.matchTagBadgeText}>#{contest.tag}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.description}>{contest.description}</Text>
            
            <TouchableOpacity onPress={() => setShowRules(!showRules)} style={styles.rulesToggle}>
              <Text style={styles.rulesToggleText}>{showRules ? 'Ocultar Reglas' : 'Ver Reglas de Puntuación'}</Text>
            </TouchableOpacity>
            {showRules && (
              <View style={styles.rulesContainer}>
                <Text style={styles.ruleItem}>• <Text style={styles.ruleHighlight}>6 Pts (🥇 Marcador Exacto)</Text>: Achuntas al resultado exacto.</Text>
                <Text style={styles.ruleItem}>• <Text style={styles.ruleHighlight}>4 Pts (🥈 Dif. de Goles)</Text>: Achuntas al ganador y la diferencia exacta de goles.</Text>
                <Text style={styles.ruleItem}>• <Text style={styles.ruleHighlight}>3 Pts (🥉 Tendencia Simple)</Text>: Achuntas a quién gana o si empatan.</Text>
                <Text style={styles.ruleItem}>• <Text style={styles.ruleHighlight}>1 Pto (Precisión por Equipo)</Text>: Fallas al ganador, pero le achuntas a los goles exactos de un equipo (solo válido si el resultado no se da vuelta al revés).</Text>
                <Text style={styles.ruleItem}>• En caso de empate, definen primero los 🥇, luego los 🥈 y finalmente los 🥉.</Text>
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
            handleEditFieldChange={handleEditFieldChange}
            handleEditTogglePlayed={handleEditTogglePlayed}
            handleSaveSingleMatch={handleSaveSingleMatch}
            cancelEditingMatch={cancelEditingMatch}
            setShowCreateForm={setShowCreateForm}
            setNewMatch={setNewMatch}
            handleCreateMatch={handleCreateMatch}
            handleArchiveMatch={handleArchiveMatch}
            setError={setError}
          />
        ) : activeTab === 'matches' ? (
          user?.type === 'organization' ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 16, textAlign: 'center' }}>Las organizaciones no pueden participar en esta actividad.</Text>
            </View>
          ) : (
            <UserPredictionsPanel 
              groupedMatches={groupedActiveMatches}
              predictions={predictions}
              handleScoreChange={handleScoreChange}
              handleSavePredictions={handleSavePredictions}
              saving={saving}
              isAdminMode={isAdminMode}
              contestId={contestId}
              contestTag={contest?.tag}
            />
          )
        ) : (
          <ParticipantsTable participants={participants} contestId={contestId} />
        )}
      </View>
    </ScrollView>
  );
};
