import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { getFileUrl } from '../../services/pocketbase';
import { theme } from '../../theme/theme';
import { DiscoverPetProfile } from '../../services/petsService';

interface Props {
  profile: DiscoverPetProfile;
  onPrevProfile?: () => void;
  onNextProfile?: () => void;
  positionLabel?: string;
  onToggleLike: () => void;
  onNavigateToUser: (userId: string) => void;
}

// Carrusel de las mascotas de la persona (foto + nombre superpuesto) + like/pase — mismo
// layout que TinderDiscoverCard. Se muestran dos descripciones distintas: la del perfil
// (qué tipo de mascotas le gustan a la persona) y, si la tiene, la de la mascota activa en
// el carrusel (raza, personalidad, etc. de esa mascota puntual).
export const PetDiscoverCard: React.FC<Props> = ({
  profile,
  onPrevProfile,
  onNextProfile,
  positionLabel,
  onToggleLike,
  onNavigateToUser,
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
                <Image source={{ uri: getFileUrl(activeItem, activeItem.image) }} style={styles.cardImage} />

                <View style={styles.itemOverlay} pointerEvents="none">
                  <Text style={styles.itemTitle}>{activeItem.name}</Text>
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

                {items.length > 1 && (
                  <View style={styles.dotsRow}>
                    {items.map((_, idx) => (
                      <View key={idx} style={[styles.dot, idx === activeIndex && styles.dotActive]} />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyImage}>
                <Feather name="heart" size={48} color="#404040" />
                <Text style={styles.emptyImageText}>Sin mascotas subidas</Text>
              </View>
            )}
          </View>

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

            {!!activeItem?.description && (
              <Text style={styles.itemDescText}>{activeItem.description}</Text>
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
  dotsRow: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#ffffff', width: 8 },
  emptyImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyImageText: { color: theme.colors.textMuted, fontSize: 12, marginTop: 8 },
  cardDetails: { paddingVertical: theme.spacing.sm },
  cardName: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  cardUsername: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  cardDesc: { color: theme.colors.text, fontSize: 14, lineHeight: 18, marginTop: theme.spacing.sm },
  cardDescEmpty: { fontStyle: 'italic', color: '#606060' },
  itemDescText: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 17, marginTop: theme.spacing.sm },
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
