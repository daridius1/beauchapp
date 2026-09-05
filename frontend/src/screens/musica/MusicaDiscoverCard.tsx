import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { getFileUrl } from '../../services/pocketbase';
import { theme } from '../../theme/theme';
import { DiscoverSongProfile } from '../../services/songsService';
import { SpotifyEmbed } from '../../components/SpotifyEmbed';
import { CarouselDots } from '../../components/CarouselDots';

interface Props {
  profile: DiscoverSongProfile;
  onPrevProfile?: () => void;
  onNextProfile?: () => void;
  positionLabel?: string;
  onToggleLike: () => void;
  onNavigateToUser: (userId: string) => void;
  isFocused: boolean;
}

// Carrusel de las películas de la persona (imagen + título/año superpuestos) + su
// descripción + like/pase — mismo layout que TinderDiscoverCard, pero mostrando el
// perfil de películas de alguien en vez de sus fotos.
export const MusicaDiscoverCard: React.FC<Props> = ({
  profile,
  onPrevProfile,
  onNextProfile,
  positionLabel,
  onToggleLike,
  onNavigateToUser,
  isFocused,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const items = profile.items || [];
  const activeItem = items[activeIndex % Math.max(items.length, 1)];
  const user = profile.expand?.user;

  useEffect(() => {
    setActiveIndex(0);
  }, [profile.user]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.cardWrapper}>
        <View style={styles.profileCard}>
          <View style={styles.cardImageWrapper}>
            {items.length > 0 ? (
              <>
                <Image
                  source={{ uri: activeItem.spotifyImageUrl || getFileUrl(activeItem, activeItem.cover) }}
                  style={styles.cardImage}
                />

                <View style={styles.itemOverlay} pointerEvents="none">
                  <Text style={styles.itemTitle}>{activeItem.title}</Text>
                  {(!!activeItem.author || !!activeItem.year) && (
                    <Text style={styles.itemYear}>
                      {[activeItem.author, activeItem.year].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>

                <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'box-none' }]}>
                  <TouchableOpacity
                    style={[styles.imageNavArea, { left: 0 }]}
                    onPress={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
                  />
                  <TouchableOpacity
                    style={[styles.imageNavArea, { right: 0 }]}
                    onPress={() => setActiveIndex((prev) => Math.min(items.length - 1, prev + 1))}
                  />
                </View>

                <CarouselDots count={items.length} activeIndex={activeIndex % items.length} />
              </>
            ) : (
              <View style={styles.emptyImage}>
                <Feather name="music" size={48} color="#404040" />
                <Text style={styles.emptyImageText}>Sin canciones subidas</Text>
              </View>
            )}
          </View>

          {!!activeItem?.spotifyTrackId && isFocused && (
            <View style={{ marginTop: theme.spacing.sm }}>
              <SpotifyEmbed key={activeItem.spotifyTrackId} trackId={activeItem.spotifyTrackId} compact />
            </View>
          )}

          <View style={styles.cardDetails}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => user?.id && onNavigateToUser(user.id)}>
              <Text style={styles.cardName}>{user?.name || 'Usuario'}</Text>
              {!!user?.username && <Text style={styles.cardUsername}>@{user.username}</Text>}
            </TouchableOpacity>

            {profile.description ? (
              <Text style={styles.cardDesc}>{profile.description}</Text>
            ) : (
              <Text style={[styles.cardDesc, styles.cardDescEmpty]}>Sin descripción</Text>
            )}
          </View>
        </View>

        <View style={styles.swipeButtonsRow}>
          {onPrevProfile && (
            <TouchableOpacity style={[styles.swipeBtn, styles.swipeBtnControl]} onPress={onPrevProfile}>
              <Feather name="arrow-left" size={24} color="#a3a3a3" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeBtnLike, profile.isLiked && styles.swipeBtnLikeActive]}
            onPress={onToggleLike}
          >
            <FontAwesome name={profile.isLiked ? 'heart' : 'heart-o'} size={26} color={profile.isLiked ? '#ffffff' : '#10B981'} />
          </TouchableOpacity>

          {onNextProfile && (
            <TouchableOpacity style={[styles.swipeBtn, styles.swipeBtnControl]} onPress={onNextProfile}>
              <Feather name="arrow-right" size={24} color="#a3a3a3" />
            </TouchableOpacity>
          )}
        </View>

        {!!positionLabel && <Text style={styles.positionLabel}>{positionLabel}</Text>}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingTop: theme.spacing.lg, paddingBottom: 40 },
  cardWrapper: { alignItems: 'center', width: '100%', maxWidth: 450, paddingHorizontal: theme.spacing.md },
  profileCard: { width: '100%' },
  cardImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  itemOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  itemTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  itemYear: { color: '#d4d4d4', fontSize: 13, marginTop: 2 },
  imageNavArea: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
  emptyImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyImageText: { color: theme.colors.textMuted, fontSize: 12, marginTop: 8 },
  cardDetails: { paddingVertical: theme.spacing.sm },
  cardName: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  cardUsername: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  cardDesc: { color: theme.colors.text, fontSize: 14, lineHeight: 18, marginTop: theme.spacing.sm },
  cardDescEmpty: { fontStyle: 'italic', color: '#606060' },
  swipeButtonsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10, width: '100%' },
  swipeBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  swipeBtnControl: { borderColor: '#404040' },
  swipeBtnLike: { borderColor: '#10B981' },
  swipeBtnLikeActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  positionLabel: { marginTop: 10, fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
});
