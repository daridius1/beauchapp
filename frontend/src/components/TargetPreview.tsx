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
          const record = await pb.collection('ladder_matches').getOne(targetId, { expand: 'team_red,team_blue' });
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
    const mode = targetMeta?.mode || resolved?.mode || '1v1';
    const scoreRed = targetMeta?.scoreRed ?? resolved?.score_red ?? 0;
    const scoreBlue = targetMeta?.scoreBlue ?? resolved?.score_blue ?? 0;
    const teamRedNames = targetMeta?.teamRed?.join(' & ') 
      || resolved?.expand?.team_red?.map((u: any) => u.name).join(' & ')
      || 'Equipo Rojo';
    const teamBlueNames = targetMeta?.teamBlue?.join(' & ')
      || resolved?.expand?.team_blue?.map((u: any) => u.name).join(' & ')
      || 'Equipo Azul';

    return (
      <Wrapper {...wrapperProps} style={styles.previewCardMatch}>
        <View style={styles.matchBadge}>
          <Feather name="award" size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.matchBadgeText}>Partido {mode}</Text>
        </View>
        <View style={styles.matchScoreRow}>
          <Text style={styles.matchTeamRed} numberOfLines={1}>{teamRedNames}</Text>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreNumRed}>{scoreRed}</Text>
            <Text style={styles.scoreDash}>-</Text>
            <Text style={styles.scoreNumBlue}>{scoreBlue}</Text>
          </View>
          <Text style={styles.matchTeamBlue} numberOfLines={1}>{teamBlueNames}</Text>
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
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  matchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchTeamRed: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#ff4444',
  },
  matchTeamBlue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    textAlign: 'right',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  scoreNumRed: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ff4444',
  },
  scoreDash: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginHorizontal: 4,
  },
  scoreNumBlue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38bdf8',
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
