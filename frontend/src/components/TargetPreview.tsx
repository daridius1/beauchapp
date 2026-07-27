import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { Avatar } from './Avatar';
import { getFileUrl } from '../services/pocketbase';

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
  if (!targetType || !targetId) {
    return null;
  }

  // El hook del servidor entrega expandedTarget con los datos frescos.
  // Si expandedTarget._notFound es true, el recurso fue hard-deleted.
  const resolved = expandedTarget;
  const notFound = !resolved || resolved._notFound === true;

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { activeOpacity: 0.8, onPress: (e: any) => { e.stopPropagation(); onPress(); } } : {};

  // 1. RENDERIZADO DE POST CITADO
  if (targetType === 'post') {
    const isDeleted = notFound || resolved?.deleted === true;

    if (isDeleted) {
      return (
        <View style={styles.fallbackBox}>
          <Feather name="alert-circle" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.fallbackText}>Esta publicación ha sido eliminada por su autor.</Text>
        </View>
      );
    }

    const liveAuthor = resolved?.expand?.author;
    const authorName = liveAuthor?.name || targetMeta?.authorName || 'Usuario';
    const authorUsername = liveAuthor?.username || targetMeta?.authorUsername || '';
    const contentText = resolved?.content || targetMeta?.content || '';
    const photoUrl = resolved?.photo 
      ? getFileUrl(resolved, resolved.photo)
      : null;

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
    if (notFound || resolved?.deleted) {
      return (
        <View style={styles.fallbackBox}>
          <Feather name="alert-circle" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.fallbackText}>Este problema ha sido eliminado.</Text>
        </View>
      );
    }

    const title = resolved?.title || targetMeta?.title || 'Problema Académico';
    const subtitle = resolved?.parent ? 'Pauta' : (targetMeta?.subtitle || 'Enunciado');
    const ramo = resolved?.ramo || targetMeta?.ramo;
    const instancia = resolved?.instancia || targetMeta?.instancia;

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
    if (notFound || resolved?.deleted) {
      return (
        <View style={styles.fallbackBox}>
          <Feather name="alert-circle" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.fallbackText}>Este partido ya no está disponible.</Text>
        </View>
      );
    }

    const sportName = resolved?.expand?.ladder?.name || targetMeta?.sportName || 'Partido';
    const mode = resolved?.mode || targetMeta?.mode || '1v1';
    const scoreRed = resolved?.score_red ?? targetMeta?.scoreRed ?? 0;
    const scoreBlue = resolved?.score_blue ?? targetMeta?.scoreBlue ?? 0;
    const teamRedNames = resolved?.expand?.team_red?.map((u: any) => u.name).join(' & ')
      || targetMeta?.teamRed?.join(' & ')
      || 'Equipo Rojo';
    const teamBlueNames = resolved?.expand?.team_blue?.map((u: any) => u.name).join(' & ')
      || targetMeta?.teamBlue?.join(' & ')
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

  // 4. RENDERIZADO DE PRODUCTO CITADO (MARKETPLACE)
  if (targetType === 'marketplace_item' || targetType === 'product') {
    if (notFound || resolved?.deleted) {
      return (
        <View style={styles.fallbackBox}>
          <Feather name="alert-circle" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.fallbackText}>Este producto ha sido eliminado por el vendedor.</Text>
        </View>
      );
    }

    const title = resolved?.title || targetMeta?.title || 'Producto de Marketplace';
    const price = resolved?.price ?? targetMeta?.price;
    const category = resolved?.category || targetMeta?.category || '';

    return (
      <Wrapper {...wrapperProps} style={styles.previewCardProblem}>
        <View style={styles.iconBox}>
          <Text style={{ fontSize: 18 }}>📦</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.problemSubtitle}>Marketplace{category ? ` · ${category}` : ''}</Text>
          <Text style={styles.problemTitle} numberOfLines={2}>{title}</Text>
          {price !== undefined && price !== null && (
            <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '800', marginTop: 2 }}>
              ${price.toLocaleString('es-CL')}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      </Wrapper>
    );
  }

  // 5. RENDERIZADO DE VENDEDOR / TIENDA CITADO
  if (targetType === 'seller_profile' || targetType === 'seller') {
    if (notFound || resolved?.deleted) {
      return (
        <View style={styles.fallbackBox}>
          <Feather name="alert-circle" size={14} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.fallbackText}>Esta tienda o perfil de vendedor ya no está disponible.</Text>
        </View>
      );
    }

    const sellerName = resolved?.expand?.user?.name || targetMeta?.sellerName || 'Perfil de Vendedor';
    const sellerUsername = resolved?.expand?.user?.username || targetMeta?.sellerUsername || '';
    const bio = resolved?.bio || targetMeta?.bio || '';

    return (
      <Wrapper {...wrapperProps} style={styles.previewCardProblem}>
        <View style={styles.iconBox}>
          <Text style={{ fontSize: 18 }}>🛍️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.problemSubtitle}>Perfil de Vendedor{sellerUsername ? ` · @${sellerUsername}` : ''}</Text>
          <Text style={styles.problemTitle} numberOfLines={1}>{sellerName}</Text>
          {!!bio && <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>{bio}</Text>}
        </View>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
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
