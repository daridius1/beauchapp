import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  DeviceEventEmitter,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { CommentsHeader } from '../components/CommentsHeader';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { summarizeEvents, computeLiveElapsedMs, computeLiveStatus, MatchEvent } from '../utils/matchEvents';
import { hourLabel } from '../components/schedule/AvailabilityGrid';
import { withMinimumDelay } from '../utils/refresh';
import { LeagueMatchScoreboard } from '../components/leagues/LeagueMatchScoreboard';
import { LeagueMatchTimeline } from '../components/leagues/LeagueMatchTimeline';
import { LeagueMatchLineups } from '../components/leagues/LeagueMatchLineups';
import { LeagueMatchStats } from '../components/leagues/LeagueMatchStats';
import { BeaumarketProbabilityBar } from '../components/leagues/BeaumarketProbabilityBar';
import { matchDisplayName } from '../components/leagues/TeamCrest';
import { beaumarketService, BeaumarketMarket } from '../services/beaumarketService';
import { EntityCommentBox } from '../components/EntityCommentBox';
import { PostCard } from '../components/PostCard';
import { leagueService } from '../services/leagueService';
import { MatchStatement } from '../types/league';

type Props = NativeStackScreenProps<RootStackParamList, 'LeagueMatchDetail'>;

const DAY_LABELS_FULL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function matchBlockLabel(code: string): string {
  if (!code || code.length < 13) return code || 'Por definir';
  const hour = Number(code.slice(-2));
  const [y, m, d] = code.slice(0, -3).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayLabel = DAY_LABELS_FULL[(date.getDay() + 6) % 7];
  return `${dayLabel} ${d} ${MONTH_LABELS[m - 1]} · ${hourLabel(hour)}`;
}

export const LeagueMatchDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { matchId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [match, setMatch] = useState<any>(null);
  const [approvedReport, setApprovedReport] = useState<any>(null);
  const [approvedEvents, setApprovedEvents] = useState<MatchEvent[]>([]);
  const [reportEvents, setReportEvents] = useState<MatchEvent[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [beaumarketMarket, setBeaumarketMarket] = useState<BeaumarketMarket | null>(null);
  const [now, setNow] = useState(Date.now());
  const [myStatement, setMyStatement] = useState<MatchStatement | null>(null);
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [statementDraft, setStatementDraft] = useState('');
  const [wantsMention, setWantsMention] = useState(false);
  const [savingStatement, setSavingStatement] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  const fetchData = useCallback(
    async (hideLoading = false) => {
      try {
        if (!hideLoading) setLoading(true);

        await withMinimumDelay(async () => {
          const [matchRes, commentsRes, statementRes] = await Promise.allSettled([
            pb.collection('league_matches').getOne(matchId, {
              expand: 'teamA,teamB,stage,league',
            }),
            pb.collection('posts').getList(1, 50, {
              filter: `targetType = "league_match" && targetId = "${matchId}" && actionType = "comment" && deleted = false`,
              sort: '+created',
              expand: 'author',
            }),
            user ? leagueService.getMyStatement(matchId, user.id) : Promise.resolve(null),
          ]);

          setMyStatement(statementRes.status === 'fulfilled' ? statementRes.value : null);

          let matchRecord: any = null;
          if (matchRes.status === 'fulfilled') {
            matchRecord = matchRes.value;
            setMatch(matchRecord);
            // Si la liga tiene el mercado automático habilitado (ver
            // POST /api/liga/matches/accept en league.pb.js), el partido ya trae el id
            // del mercado enlazado — se pide aparte porque vive en una colección con
            // sus propias reglas de acceso (GET /api/beaumarket/markets).
            if (matchRecord.beaumarketMarket) {
              beaumarketService
                .getMarketDetail(matchRecord.beaumarketMarket)
                .then(setBeaumarketMarket)
                .catch((err) => console.error('Error cargando mercado de Beaumarket del partido:', err));
            } else {
              setBeaumarketMarket(null);
            }
          } else {
            console.error('Error cargando partido de liga:', matchRes.reason);
          }

          if (commentsRes.status === 'fulfilled') {
            setComments(commentsRes.value.items);
          }

          if (matchRecord) {
            // Se pide el informe sin filtrar por status (a diferencia de antes, que solo
            // buscaba el aprobado): mientras el partido está 'confirmed' y siendo
            // arbitrado, el informe existe pero todavía no está aprobado, y es la única
            // fuente para el marcador/minuto en vivo (mismo criterio que LeagueDetailScreen).
            try {
              const report = await pb.collection('match_reports').getFirstListItem(
                `match = "${matchId}" && deleted = false`
              );
              setReportEvents(report.events || []);
              if (matchRecord.status === 'played' && report.status === 'approved') {
                setApprovedReport(report);
                setApprovedEvents(report.events || []);
              } else {
                setApprovedReport(null);
                setApprovedEvents([]);
              }
            } catch (err) {
              setReportEvents([]);
              setApprovedReport(null);
              setApprovedEvents([]);
            }
          }
        }, 400);
      } catch (err) {
        console.error('Error general en LeagueMatchDetailScreen:', err);
      } finally {
        if (!hideLoading) setLoading(false);
      }
    },
    [matchId, user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Solo para refrescar el minuto en vivo mostrado — no dispara ningún fetch (mismo
  // criterio que LeagueDetailScreen).
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(interval);
  }, []);

  // Estado en vivo, derivado siempre de los eventos del informe (nunca de un campo
  // guardado suelto) — mismo criterio que `liveInfoByMatch` en LeagueDetailScreen, pero
  // para un solo partido.
  const liveInfo = useMemo(() => {
    if (!match || match.status !== 'confirmed' || reportEvents.length === 0) return null;
    const summary = summarizeEvents(reportEvents);
    if (!summary.halfStarted[1]) return null;

    const { elapsedMs, running } = computeLiveElapsedMs(reportEvents, now);
    const { minuteLabel, isHalftime } = computeLiveStatus(summary, elapsedMs, running);
    return { scoreA: summary.scoreA, scoreB: summary.scoreB, running, isHalftime, minuteLabel };
  }, [match, reportEvents, now]);

  useEffect(() => {
    const subScroll = DeviceEventEmitter.addListener('onScrollToTop', () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
    const subRefresh = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await fetchData(true);
      setLoading(false);
    });
    return () => {
      subScroll.remove();
      subRefresh.remove();
    };
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  const handleShareMatchToFeed = () => {
    if (!match) return;
    if (!user) {
      Toast.show({ type: 'info', text1: 'Inicia sesión', text2: 'Debes iniciar sesión para citar.' });
      return;
    }

    const teamAName = match.expand?.teamA?.name || match.expand?.teamA?.username || 'Equipo A';
    const teamBName = match.expand?.teamB?.name || match.expand?.teamB?.username || 'Equipo B';
    const stageName = match.expand?.stage?.name || 'Etapa';
    const leagueName = match.expand?.league?.name || 'Liga';

    navigation.navigate('Home', {
      quoteTargetType: 'league_match',
      quoteTargetId: match.id,
      quoteTargetMeta: {
        stageName,
        leagueName,
        teamAName,
        teamBName,
        scoreA: match.scoreA ?? 0,
        scoreB: match.scoreB ?? 0,
        status: match.status,
        blockCode: match.blockCode,
      },
    });
  };

  const handleSendComment = async (content: string, photo: File | null, pollOptions: string[] | null) => {
    if (!user || !match) return;
    try {
      const postData: any = {
        author: user.id,
        actionType: 'comment',
        targetType: 'league_match',
        targetId: match.id,
        content: content.trim() || ' ',
        targetMeta: {
          teamAName: match.expand?.teamA?.name || 'Equipo A',
          teamBName: match.expand?.teamB?.name || 'Equipo B',
          scoreA: match.scoreA ?? 0,
          scoreB: match.scoreB ?? 0,
          stageName: match.expand?.stage?.name || '',
          leagueName: match.expand?.league?.name || '',
        },
      };
      if (photo) postData.photo = photo;
      if (pollOptions && pollOptions.length >= 2) postData.pollOptions = pollOptions;

      const created = await pb.collection('posts').create(postData, { expand: 'author' });
      setComments((prev) => [...prev, created]);
      Toast.show({ type: 'success', text1: 'Comentario publicado' });
    } catch (err) {
      console.error('Error enviando comentario:', err);
      Toast.show({ type: 'error', text1: 'Error al enviar comentario' });
      throw err;
    }
  };

  const toggleCommentLike = async (post: any) => {
    if (!user) return;
    try {
      const likes = post.likes || [];
      const hasLiked = likes.includes(user.id);
      const updatedLikes = hasLiked ? likes.filter((id: string) => id !== user.id) : [...likes, user.id];
      setComments((prev) => prev.map((c) => (c.id === post.id ? { ...c, likes: updatedLikes } : c)));
      await pb.collection('posts').update(post.id, { likes: updatedLikes });
    } catch (err) {
      console.error('Error actualizando like:', err);
      fetchData(true);
    }
  };

  const handleDeleteComment = async (postId: string) => {
    try {
      setComments((prev) => prev.filter((c) => c.id !== postId));
      await pb.collection('posts').update(postId, { deleted: true });
      Toast.show({ type: 'success', text1: 'Comentario eliminado' });
    } catch (err) {
      console.error('Error eliminando comentario:', err);
      fetchData(true);
    }
  };

  const openDeclareModal = () => {
    setStatementDraft(myStatement?.content || '');
    setWantsMention(myStatement?.wantsMention || false);
    setShowDeclareModal(true);
  };

  const handleSubmitStatement = async () => {
    if (!user || !statementDraft.trim() || savingStatement) return;
    setSavingStatement(true);
    try {
      const saved = await leagueService.submitStatement(matchId, user.id, statementDraft.trim(), wantsMention);
      setMyStatement(saved);
      setShowDeclareModal(false);
      Toast.show({ type: 'success', text1: myStatement ? 'Declaración actualizada' : 'Declaración enviada' });
    } catch (err) {
      console.error('Error enviando declaración:', err);
      Toast.show({ type: 'error', text1: 'Error al enviar la declaración' });
    } finally {
      setSavingStatement(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Partido no encontrado</Text>
        <Text style={styles.emptySub}>No fue posible cargar la información del encuentro.</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('LeaguesList'))}
        >
          <Text style={styles.backBtnText}>Volver a Ligas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const teamA = match.expand?.teamA;
  const teamB = match.expand?.teamB;
  const teamAName = matchDisplayName(teamA, 'Equipo A');
  const teamBName = matchDisplayName(teamB, 'Equipo B');
  const formattedDate = matchBlockLabel(match.blockCode);

  const isPlayed = match.status === 'played';
  const isLive = !!liveInfo;
  // Mientras el partido está en vivo, los eventos vienen del informe en progreso
  // (todavía no aprobado) — es la misma fuente que ya se usa para el marcador en vivo,
  // así que mostrar la cronología acá no es más que reusar `reportEvents` en vez de
  // esperar a que el informe quede aprobado.
  const displayEvents = isPlayed ? approvedEvents : isLive ? reportEvents : [];
  const summary = summarizeEvents(displayEvents);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* Marcador Principal */}
      <LeagueMatchScoreboard
        match={match}
        formattedDate={formattedDate}
        live={liveInfo || undefined}
        onPressTeamA={teamA ? () => navigation.push('TeamProfile', { teamId: teamA.id }) : undefined}
        onPressTeamB={teamB ? () => navigation.push('TeamProfile', { teamId: teamB.id }) : undefined}
        onPressLeague={
          match.expand?.league ? () => navigation.push('LeagueDetail', { leagueId: match.expand.league.id }) : undefined
        }
        onPressArbitrate={() => navigation.push('LeagueMatchArbitrator', { matchId })}
      />

      {beaumarketMarket && (
        <BeaumarketProbabilityBar
          prices={beaumarketMarket.prices}
          winningOutcomeIndex={beaumarketMarket.winningOutcomeIndex}
          status={beaumarketMarket.status}
          onPress={
            beaumarketMarket.status !== 'cancelled'
              ? () => navigation.push('BeaumarketDetail', { marketId: beaumarketMarket.id, title: beaumarketMarket.title })
              : undefined
          }
        />
      )}

      {/* Si el partido ya se jugó (o está en vivo, con los eventos que lleve hasta
          ahora): Estadísticas, Cronología y Planteles en la misma vista */}
      {(isPlayed || isLive) && (
        <View style={styles.playedDetailsSection}>
          {/* Estadísticas — sin encabezado: la tabla ya se explica sola */}
          <LeagueMatchStats summary={summary} teamAName={teamAName} teamBName={teamBName} />

          {/* Cronología */}
          <Text style={styles.sectionHeader}>Cronología</Text>
          <LeagueMatchTimeline events={displayEvents} teamAName={teamAName} teamBName={teamBName} />

          {/* Planteles */}
          <Text style={styles.sectionHeader}>Convocatoria</Text>
          <LeagueMatchLineups
            lineupA={summary.lineupA}
            lineupB={summary.lineupB}
            teamAName={teamAName}
            teamBName={teamBName}
            events={displayEvents}
          />

          {isPlayed && !!approvedReport?.notes && (
            <>
              <Text style={styles.sectionHeader}>Informe del árbitro</Text>
              <Text style={styles.refereeNotesText}>{approvedReport.notes}</Text>
            </>
          )}
        </View>
      )}

      {/* Declarar — privado, nunca se publica: solo lo usa el medio para escribir
          noticias (ver /admin/noticias). Solo tiene sentido una vez jugado el partido. */}
      {isPlayed && user && (
        <TouchableOpacity style={styles.declareBtn} activeOpacity={0.8} onPress={openDeclareModal}>
          <Feather name="mic" size={16} color={theme.colors.primary} />
          <Text style={styles.declareBtnText}>{myStatement ? 'Editar tu declaración' : 'Declarar sobre este partido'}</Text>
        </TouchableOpacity>
      )}

      {/* Sección de Comentarios al final */}
      <View style={styles.commentsSection}>
        <CommentsHeader count={comments.length} onQuote={handleShareMatchToFeed} />

        {/* Caja para publicar comentarios */}
        {user && (
          <EntityCommentBox
            placeholder="Comenta sobre este partido..."
            style={{ marginHorizontal: -theme.spacing.md }}
            onSendComment={handleSendComment}
          />
        )}

        {/* Listado de comentarios */}
        {comments.length === 0 ? (
          <View style={styles.emptyCommentsContainer}>
            <Feather name="message-square" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>Aún no hay comentarios</Text>
            <Text style={styles.emptySub}>Sé la primera persona en comentar sobre este encuentro.</Text>
          </View>
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={{ marginHorizontal: -theme.spacing.md }}>
              <PostCard
                post={comment}
                currentUser={user}
                hideTargetContext={true}
                onPress={() => navigation.push('PostDetail', { postId: comment.id })}
                onLikePress={() => toggleCommentLike(comment)}
                onDeletePress={() => handleDeleteComment(comment.id)}
                onAuthorPress={() => navigation.push('UserProfile', { userId: comment.author })}
              />
            </View>
          ))
        )}
      </View>

      <Modal visible={showDeclareModal} transparent animationType="fade" onRequestClose={() => setShowDeclareModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Declarar sobre este partido</Text>
            <Text style={styles.modalHint}>
              Es privado: solo la usa el medio de noticias para escribir sus artículos, no se publica tal cual.
            </Text>
            <TextInput
              style={styles.modalInput}
              multiline
              placeholder="¿Qué pasó en este partido?"
              placeholderTextColor={theme.colors.textMuted}
              value={statementDraft}
              onChangeText={setStatementDraft}
              maxLength={2000}
            />
            <TouchableOpacity style={styles.mentionRow} activeOpacity={0.75} onPress={() => setWantsMention((v) => !v)}>
              <Feather name={wantsMention ? 'check-square' : 'square'} size={18} color={wantsMention ? theme.colors.primary : theme.colors.textMuted} />
              <Text style={styles.mentionText}>
                Quiero que, si se usa mi declaración, la noticia me pueda mencionar por mi nombre
              </Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDeclareModal(false)} disabled={savingStatement}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (!statementDraft.trim() || savingStatement) && styles.modalSubmitBtnDisabled]}
                onPress={handleSubmitStatement}
                disabled={!statementDraft.trim() || savingStatement}
              >
                {savingStatement ? (
                  <ActivityIndicator color="#000000" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>{myStatement ? 'Actualizar' : 'Enviar'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  backBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  backBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 13,
  },
  playedDetailsSection: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
    textAlign: 'center',
  },
  refereeNotesText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  commentsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyCommentsContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginVertical: theme.spacing.sm,
  },
  declareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  declareBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 14,
    lineHeight: 17,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 12,
    minHeight: 120,
    color: theme.colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  mentionText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalCancelText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});
