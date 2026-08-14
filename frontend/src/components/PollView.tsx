import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';

interface PollViewProps {
  post: any;
  currentUser: any;
}

// Se embebe en PostCard cuando el post tiene pollOptions. Antes de votar solo se ven
// las opciones (sin porcentajes); una vez que el usuario vota, se ven los porcentajes
// agregados y su propia opción resaltada, y sigue pudiendo tocar la barra para cambiar
// el voto (create la primera vez, update del mismo registro después). Los votos no son
// anónimos: cada opción tiene su propio botón (aparte de la barra, para no chocar con
// el gesto de cambiar de voto) que lleva a la vista de lista de usuarios (FollowList,
// la misma que ya usan seguidores/integrantes/etc.) con quién votó por esa opción —
// poll_votes ya es listable por cualquier usuario autenticado, así que no hace falta
// backend nuevo para esto. Las cuentas de organización no pueden votar (ver
// polls.pb.js, que también lo bloquea del lado del servidor) — para ellas se muestran
// los resultados de una vez, como si ya hubieran votado.
export const PollView: React.FC<PollViewProps> = ({ post, currentUser }) => {
  const navigation = useNavigation<any>();
  const options: string[] = post.pollOptions || [];
  const isOrganization = currentUser?.type === 'organization';
  const [counts, setCounts] = useState<number[]>(() => options.map(() => 0));
  const [myVote, setMyVote] = useState<number | null>(null);
  const [myVoteRecordId, setMyVoteRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser || options.length < 2) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const [voteRecord, countLists] = await Promise.all([
          // Las organizaciones nunca votan, así que no hace falta buscar su propio voto.
          isOrganization
            ? Promise.resolve(null)
            : pb.collection('poll_votes')
                .getFirstListItem(`post = "${post.id}" && user = "${currentUser.id}"`)
                .catch(() => null),
          Promise.all(
            options.map((_, i) =>
              pb.collection('poll_votes').getList(1, 1, { filter: `post = "${post.id}" && optionIndex = ${i}` })
            )
          ),
        ]);
        if (cancelled) return;
        setCounts(countLists.map((r: any) => r.totalItems));
        if (voteRecord) {
          setMyVote((voteRecord as any).optionIndex);
          setMyVoteRecordId((voteRecord as any).id);
        }
      } catch (err) {
        console.error('Error cargando encuesta:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, currentUser?.id]);

  const handleVote = async (index: number) => {
    if (!currentUser || isOrganization || index === myVote || loading) return;
    const prevVote = myVote;
    const prevCounts = counts;
    const prevRecordId = myVoteRecordId;

    const nextCounts = counts.slice();
    if (prevVote !== null) nextCounts[prevVote] = Math.max(0, nextCounts[prevVote] - 1);
    nextCounts[index] = nextCounts[index] + 1;
    setCounts(nextCounts);
    setMyVote(index);

    try {
      if (prevRecordId) {
        await pb.collection('poll_votes').update(prevRecordId, { optionIndex: index });
      } else {
        const created = await pb.collection('poll_votes').create({ post: post.id, user: currentUser.id, optionIndex: index });
        setMyVoteRecordId(created.id);
      }
    } catch (err) {
      console.error('Error votando en la encuesta:', err);
      setCounts(prevCounts);
      setMyVote(prevVote);
    }
  };

  const handleOpenVoters = (index: number) => {
    navigation.push('FollowList', {
      userId: post.id,
      type: 'poll_voters',
      optionIndex: index,
      title: `Votos: "${options[index]}"`,
    });
  };

  if (options.length < 2) return null;

  if (!currentUser) {
    return (
      <View style={styles.container}>
        {options.map((opt, i) => (
          <View key={i} style={styles.optionRow}>
            <Text style={styles.optionText}>{opt}</Text>
          </View>
        ))}
        <Text style={styles.hint}>Inicia sesión para votar.</Text>
      </View>
    );
  }

  const totalVotes = counts.reduce((a, b) => a + b, 0);
  const hasVoted = myVote !== null || isOrganization;

  return (
    <View style={styles.container}>
      {options.map((opt, i) => {
        const pct = hasVoted && totalVotes > 0 ? Math.round((counts[i] / totalVotes) * 100) : 0;
        const isMine = i === myVote;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.optionRow, isMine && styles.optionRowSelected]}
            activeOpacity={isOrganization ? 1 : 0.7}
            disabled={isOrganization}
            onPress={(e: any) => { e.stopPropagation && e.stopPropagation(); handleVote(i); }}
          >
            {hasVoted && <View style={[styles.barFill, { width: `${pct}%` }]} />}
            <View style={styles.optionLabelRow}>
              {isMine && <Feather name="check-circle" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />}
              <Text style={styles.optionText}>{opt}</Text>
            </View>
            {hasVoted && (
              <View style={styles.optionRightGroup}>
                <Text style={styles.optionPct}>{pct}%</Text>
                <TouchableOpacity
                  style={styles.votersBtn}
                  onPress={(e: any) => { e.stopPropagation && e.stopPropagation(); handleOpenVoters(i); }}
                >
                  <Feather name="users" size={13} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      {hasVoted && (
        <Text style={styles.totalVotes}>{totalVotes} voto{totalVotes !== 1 ? 's' : ''}</Text>
      )}
      {isOrganization && (
        <Text style={styles.hint}>Las cuentas de organización no pueden votar.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  optionRowSelected: {
    borderColor: theme.colors.primary,
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  optionText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  optionRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionPct: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  votersBtn: {
    padding: 4,
  },
  totalVotes: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
