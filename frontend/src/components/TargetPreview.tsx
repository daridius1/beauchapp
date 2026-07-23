import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { Avatar } from './Avatar';
import { pb, getFileUrl } from '../services/pocketbase';

export interface TargetPreviewProps {
  targetType?: string;
  targetId?: string;
  targetMeta?: any;
  expandedTarget?: any;
  onPress?: () => void;
}

export const TargetPreview: React.FC<TargetPreviewProps> = ({
  targetType,
  targetId,
  targetMeta,
  expandedTarget,
  onPress,
}) => {
  const [fetchedTarget, setFetchedTarget] = useState<any>(null);

  // Fetch on-demand si no tenemos el objeto record expandido
  useEffect(() => {
    if (!targetType || !targetId) return;
    if (expandedTarget) return; // ya expandido por el query

    let isMounted = true;
    const fetchTarget = async () => {
      try {
        if (targetType === 'post') {
          const record = await pb.collection('posts').getOne(targetId, { expand: 'author' });
          if (isMounted) setFetchedTarget(record);
        } else if (targetType === 'problem') {
          const record = await pb.collection('problems').getOne(targetId);
          if (isMounted) setFetchedTarget(record);
        } else if (targetType === 'match') {
          const record = await pb.collection('ladder_matches').getOne(targetId, { expand: 'ladder,team_red,team_blue' });
          if (isMounted) setFetchedTarget(record);
        }
      } catch (err) {
        // Target no encontrado o eliminado
      }
    };
    fetchTarget();
    return () => { isMounted = false; };
  }, [targetType, targetId, expandedTarget]);

  if (!targetType || !targetId) {
    return null;
  }

  // Usar expandedTarget (del query expand), luego fetchedTarget (on-demand), luego targetMeta (snapshot)
  const resolved = expandedTarget || fetchedTarget;

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { activeOpacity: 0.8, onPress: (e: any) => { e.stopPropagation(); onPress(); } } : {};

  // 1. RENDERIZADO DE POST CITADO
  if (targetType === 'post') {
    const liveAuthor = resolved?.expand?.author;
    const authorName = liveAuthor?.name || targetMeta?.authorName || 'Usuario';
    const authorUsername = liveAuthor?.username || targetMeta?.authorUsername || '';
    const contentText = resolved ? resolved.content : (targetMeta?.content || '');
    const photoUrl = resolved?.photo 
      ? getFileUrl(resolved, resolved.photo)
      : null;
    const isDeleted = resolved?.deleted === true;

    if (isDeleted) {
      return (
        <View style={styles.fallbackBox}>
          <Feather name="alert-circle" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.fallbackText}>Esta publicación ha sido eliminada por su autor.</Text>
        </View>
      );
    }

    return (
      <Wrapper {...wrapperProps} style={styles.previewCard}>
        <View style={styles.headerRow}>
          <Avatar user={liveAuthor || { name: authorName, username: authorUsername }} size={24} />
          <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
          {!!authorUsername && <Text style={styles.authorUsername} numberOfLines={1}>@{authorUsername}</Text>}
        </View>
        {!!contentText && contentText.trim() !== '' && (
          <Text style={styles.contentText} numberOfLines={3}>{contentText}</Text>
        )}
        {!!photoUrl && (
          <Image source={{ uri: photoUrl }} style={styles.previewPhoto} resizeMode="cover" />
        )}
      </Wrapper>
    );
  }

  // 2. RENDERIZADO DE PROBLEMA CITADO
  if (targetType === 'problem') {
    const title = targetMeta?.title || resolved?.title || 'Problema Académico';
    const subtitle = targetMeta?.subtitle || (resolved?.parent ? 'Pauta' : 'Enunciado');
    const ramo = targetMeta?.ramo || resolved?.ramo;
    const instancia = targetMeta?.instancia || resolved?.instancia;

    return (
      <Wrapper {...wrapperProps} style={styles.previewCardProblem}>
        <View style={styles.iconBox}>
          <Text style={{ fontSize: 18 }}>{subtitle === 'Pauta' ? '✍️' : '📄'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.problemSubtitle}>{subtitle}{ramo ? ` · ${ramo}` : ''}{instancia ? ` (${instancia})` : ''}</Text>
          <Text style={styles.problemTitle} numberOfLines={2}>{title}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      </Wrapper>
    );
  }

  // 3. RENDERIZADO DE PARTIDO CITADO
  if (targetType === 'match') {
    const sportName = targetMeta?.sportName || resolved?.expand?.ladder?.name || 'Partido';
    const mode = targetMeta?.mode || resolved?.mode || '1v1';
    const scoreRed = targetMeta?.scoreRed ?? resolved?.score_red ?? 0;
    const scoreBlue = targetMeta?.scoreBlue ?? resolved?.score_blue ?? 0;
    const teamRedNames = targetMeta?.teamRed?.join(' & ') 
      || resolved?.expand?.team_red?.map((u: any) => u.name).join(' & ')
      || 'Equipo Rojo';
    const teamBlueNames = targetMeta?.teamBlue?.join(' & ')
      || resolved?.expand?.team_blue?.map((u: any) => u.name).join(' & ')
      || 'Equipo Azul';

    const redWon = scoreRed > scoreBlue;
    const blueWon = scoreBlue > scoreRed;

    return (
      <Wrapper {...wrapperProps} style={styles.previewCardMatch}>
        <Text style={styles.matchHeaderCategory}>{sportName} · {mode}</Text>
        
        <View style={styles.matchBodyRow}>
          {/* Columna de Equipos y Marcadores */}
          <View style={{ flex: 1, gap: 6 }}>
            {/* Fila Equipo Rojo */}
            <View style={styles.teamRow}>
              <View style={[styles.teamDot, { backgroundColor: '#ef4444' }]} />
              <Text style={[styles.teamNameText, redWon && styles.teamNameWinner]} numberOfLines={1}>
                {teamRedNames}
              </Text>
              <Text style={[styles.teamScoreText, redWon && styles.teamScoreWinner]}>
                {scoreRed}
              </Text>
            </View>

            {/* Fila Equipo Azul */}
            <View style={styles.teamRow}>
              <View style={[styles.teamDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={[styles.teamNameText, blueWon && styles.teamNameWinner]} numberOfLines={1}>
                {teamBlueNames}
              </Text>
              <Text style={[styles.teamScoreText, blueWon && styles.teamScoreWinner]}>
                {scoreBlue}
              </Text>
            </View>
          </View>
        </View>
      </Wrapper>
    );
  }

  // FALLBACK POR DEFECTO
  return (
    <View style={styles.fallbackBox}>
      <Feather name="info" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
      <Text style={styles.fallbackText}>Contenido adjunto ({targetType})</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  previewCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  authorUsername: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  contentText: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.text,
  },
  previewPhoto: {
    width: '100%',
    height: 140,
    borderRadius: 6,
    marginTop: 6,
  },
  previewCardProblem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
    gap: 10,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  problemSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  problemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  previewCardMatch: {
    backgroundColor: '#111111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  matchHeaderCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  teamNameText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#a3a3a3',
  },
  teamNameWinner: {
    fontWeight: '700',
    color: '#ffffff',
  },
  teamScoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a3a3a3',
    minWidth: 20,
    textAlign: 'right',
  },
  teamScoreWinner: {
    fontWeight: '800',
    color: '#ffffff',
  },
  winnerTriangle: {
    fontSize: 8,
    color: '#ffffff',
    marginLeft: 4,
  },
  matchStatusCol: {
    borderLeftWidth: 1,
    borderLeftColor: '#262626',
    paddingLeft: 12,
    paddingRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusFinText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  fallbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  fallbackText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.colors.textMuted,
  },
});
