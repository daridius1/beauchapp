import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { getFileUrl } from '../../services/pocketbase';
import { Avatar } from '../../components/Avatar';
import { UserChipsRow } from '../../components/UserChipsRow';
import { ContactLinksList } from '../../components/ContactLinksList';
import { CarouselDots } from '../../components/CarouselDots';
import { theme } from '../../theme/theme';
import { styles } from './TinderScreen.styles';
import { CARD_WIDTH } from './constants';
import { ConoceContact } from '../../services/conoceContactService';

interface TinderMatchModalProps {
  currentUser: any;
  matchUser: any;
  matchProfile: any;
  matchPhotoIndex: number;
  setMatchPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  userLadderRanksMap: Record<string, any[]>;
  userSellerProfilesMap: Record<string, any>;
  userMembershipsMap: Record<string, any[]>;
  contact: ConoceContact | null;
  onNavigateToUser: (userId: string) => void;
  onClose: () => void;
}

export const TinderMatchModal: React.FC<TinderMatchModalProps> = ({
  currentUser,
  matchUser,
  matchProfile,
  matchPhotoIndex,
  setMatchPhotoIndex,
  userLadderRanksMap,
  userSellerProfilesMap,
  userMembershipsMap,
  contact,
  onNavigateToUser,
  onClose,
}) => {
  return (
    <View style={[styles.modalOverlay, { backgroundColor: 'rgba(15, 23, 42, 0.95)' }]}>
      <View style={styles.matchPopup}>
        <ScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{ alignItems: 'center', paddingBottom: theme.spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sparkleHeart}>
            <FontAwesome name="heart" size={60} color="#10B981" />
          </View>

          <Text style={styles.matchPopupTitle}>¡Es un Match!</Text>
          <Text style={styles.matchPopupSub}>
            Tú y {matchUser?.name} se gustan mutuamente. Aquí tienes sus datos de contacto para conectarse:
          </Text>

          {/* Avatar circle link visualization */}
          <View style={styles.matchAvatarsRow}>
            <Avatar user={currentUser} size={84} />
            <View style={styles.matchAvatarsHeart}>
              <FontAwesome name="heart" size={24} color="#EF4444" />
            </View>
            <TouchableOpacity activeOpacity={0.7} onPress={() => matchUser?.id && onNavigateToUser(matchUser.id)}>
              <Avatar user={matchUser} size={84} />
            </TouchableOpacity>
          </View>

          {/* User Chips Row */}
          {matchUser && (
            <View style={{ marginVertical: 8 }}>
              <UserChipsRow
                user={matchUser}
                memberships={userMembershipsMap[matchUser.id] || []}
                ladderRanks={userLadderRanksMap[matchUser.id] || []}
                sellerProfile={userSellerProfilesMap[matchUser.id]}
                onOrgPress={onNavigateToUser}
              />
            </View>
          )}

          {/* Match profile photo carousel */}
          {matchProfile?.photos && matchProfile.photos.length > 0 ? (
            <View style={[styles.cardWrapper, { width: CARD_WIDTH - 64, height: 260, marginTop: theme.spacing.md, marginBottom: theme.spacing.md, alignSelf: 'center' }]}>
              <View style={[styles.profileCard, { height: '100%' }]}>
                <View style={[styles.cardImageWrapper, { height: '100%' }]}>
                  <Image
                    source={{ uri: getFileUrl(matchProfile, matchProfile.photos[matchPhotoIndex % matchProfile.photos.length]) }}
                    style={styles.cardImage}
                  />

                  {/* Tap left/right to browse images overlay */}
                  <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'box-none' }]}>
                    <TouchableOpacity
                      style={[styles.imageNavArea, { left: 0 }]}
                      onPress={() => setMatchPhotoIndex(prev => Math.max(0, prev - 1))}
                    />
                    <TouchableOpacity
                      style={[styles.imageNavArea, { right: 0 }]}
                      onPress={() => setMatchPhotoIndex(prev => Math.min(matchProfile.photos.length - 1, prev + 1))}
                    />
                  </View>

                  {/* Photo Dots Indicators */}
                  <CarouselDots count={matchProfile.photos.length} activeIndex={matchPhotoIndex % matchProfile.photos.length} />
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.emptyCardImage, { width: CARD_WIDTH - 64, height: 180, alignSelf: 'center', marginTop: theme.spacing.md, marginBottom: theme.spacing.md }]}>
              <Feather name="image" size={36} color="#404040" />
              <Text style={styles.emptyCardImageText}>Sin fotos de perfil</Text>
            </View>
          )}

          {/* Contact cards */}
          <View style={styles.unlockedContactsContainer}>
            <ContactLinksList contact={contact} />
          </View>

          <TouchableOpacity style={styles.closeMatchBtn} onPress={onClose}>
            <Text style={styles.closeMatchBtnText}>Seguir Deslizando</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
};
