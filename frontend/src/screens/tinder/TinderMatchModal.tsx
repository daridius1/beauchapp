import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { getFileUrl } from '../../services/pocketbase';
import { Avatar } from '../../components/Avatar';
import { UserChipsRow } from '../../components/UserChipsRow';
import { theme } from '../../theme/theme';
import { SIGNAL_LOGO_BASE64 } from '../../assets/signalLogo';
import { styles } from './TinderScreen.styles';
import { CARD_WIDTH } from './constants';

interface TinderMatchModalProps {
  currentUser: any;
  matchUser: any;
  matchProfile: any;
  matchPhotoIndex: number;
  setMatchPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  userLadderRanksMap: Record<string, any[]>;
  userSellerProfilesMap: Record<string, any>;
  userMembershipsMap: Record<string, any[]>;
  onOpenSocialLink: (type: string, value: string) => void;
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
  onOpenSocialLink,
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
                  {matchProfile.photos.length > 1 && (
                    <View style={styles.photoDotsRow}>
                      {matchProfile.photos.map((_: any, dotIdx: number) => (
                        <View
                          key={dotIdx}
                          style={[
                            styles.photoDot,
                            dotIdx === (matchPhotoIndex % matchProfile.photos.length) && styles.photoDotActive
                          ]}
                        />
                      ))}
                    </View>
                  )}
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
            {!!matchProfile?.instagram && (
              <TouchableOpacity
                style={[styles.unlockedContactItem, { borderColor: '#E1306C' }]}
                onPress={() => onOpenSocialLink('instagram', matchProfile.instagram)}
              >
                <FontAwesome name="instagram" size={22} color="#E1306C" style={{ marginRight: 10 }} />
                <Text style={styles.unlockedContactText}>@{matchProfile.instagram}</Text>
                <Feather name="external-link" size={14} color="#E1306C" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}

            {!!matchProfile?.whatsapp && (
              <TouchableOpacity
                style={[styles.unlockedContactItem, { borderColor: '#25D366' }]}
                onPress={() => onOpenSocialLink('whatsapp', matchProfile.whatsapp)}
              >
                <FontAwesome name="whatsapp" size={22} color="#25D366" style={{ marginRight: 10 }} />
                <Text style={styles.unlockedContactText}>{matchProfile.whatsapp}</Text>
                <Feather name="external-link" size={14} color="#25D366" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}

            {!!matchProfile?.telegram && (
              <TouchableOpacity
                style={[styles.unlockedContactItem, { borderColor: '#0088cc' }]}
                onPress={() => onOpenSocialLink('telegram', matchProfile.telegram)}
              >
                <FontAwesome name="paper-plane" size={20} color="#0088cc" style={{ marginRight: 10 }} />
                <Text style={styles.unlockedContactText}>Telegram</Text>
                <Feather name="external-link" size={14} color="#0088cc" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}

            {!!matchProfile?.signal && (
              <TouchableOpacity
                style={[styles.unlockedContactItem, { borderColor: '#3a76f0' }]}
                onPress={() => onOpenSocialLink('signal', matchProfile.signal)}
              >
                <Image source={{ uri: SIGNAL_LOGO_BASE64 }} style={{ width: 22, height: 22, borderRadius: 11, marginRight: 10 }} />
                <Text style={styles.unlockedContactText}>Signal: {matchProfile.signal}</Text>
                <Feather name="external-link" size={14} color="#3a76f0" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.closeMatchBtn} onPress={onClose}>
            <Text style={styles.closeMatchBtnText}>Seguir Deslizando</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
};
