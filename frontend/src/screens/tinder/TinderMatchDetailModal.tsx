import React, { useEffect } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getFileUrl } from '../../services/pocketbase';
import { Avatar } from '../../components/Avatar';
import { UserChipsRow } from '../../components/UserChipsRow';
import { ContactLinksList } from '../../components/ContactLinksList';
import { CarouselDots } from '../../components/CarouselDots';
import { theme } from '../../theme/theme';
import { styles } from './TinderScreen.styles';
import { CARD_WIDTH } from './constants';
import { TinderExtraDetails } from './TinderExtraDetails';
import { ConoceContact } from '../../services/conoceContactService';

interface TinderMatchDetailModalProps {
  selectedMatch: any;
  detailPhotoIndex: number;
  setDetailPhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  userLadderRanksMap: Record<string, any[]>;
  userSellerProfilesMap: Record<string, any>;
  userMembershipsMap: Record<string, any[]>;
  contact: ConoceContact | null;
  loadingContact?: boolean;
  onNavigateToUser: (userId: string) => void;
  onClose: () => void;
  onUnmatch: (matchId: string) => void;
}

export const TinderMatchDetailModal: React.FC<TinderMatchDetailModalProps> = ({
  selectedMatch,
  detailPhotoIndex,
  setDetailPhotoIndex,
  userLadderRanksMap,
  userSellerProfilesMap,
  userMembershipsMap,
  contact,
  loadingContact,
  onNavigateToUser,
  onClose,
  onUnmatch,
}) => {
  // Mismo motivo que en TinderDiscoverCard: solo se pinta la foto activa, el resto se
  // precargan apenas se abre el perfil para que cambiar de foto no tenga que esperar la carga.
  useEffect(() => {
    (selectedMatch.profile?.photos || []).forEach((photo: any) => {
      Image.prefetch(getFileUrl(selectedMatch.profile, photo));
    });
  }, [selectedMatch.profile?.id]);

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.matchDetailCard}>
        <View style={styles.matchDetailHeader}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => selectedMatch.user?.id && onNavigateToUser(selectedMatch.user.id)}
            style={styles.matchDetailHeaderTitleRow}
          >
            <Avatar user={selectedMatch.user} size={44} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.matchDetailName}>{selectedMatch.user?.name}</Text>
              {!!selectedMatch.user?.username && <Text style={styles.matchDetailUsername}>@{selectedMatch.user.username}</Text>}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, padding: theme.spacing.md }} showsVerticalScrollIndicator={false}>
          {/* User Profile Chips */}
          {selectedMatch.user && (
            <View style={{ marginBottom: theme.spacing.md }}>
              <UserChipsRow
                user={selectedMatch.user}
                memberships={userMembershipsMap[selectedMatch.user.id] || []}
                ladderRanks={userLadderRanksMap[selectedMatch.user.id] || []}
                sellerProfile={userSellerProfilesMap[selectedMatch.user.id]}
                onOrgPress={onNavigateToUser}
              />
            </View>
          )}

          {/* Detalles opcionales */}
          <TinderExtraDetails profile={selectedMatch.profile} />

          {/* Photos Grid/List */}
          {selectedMatch.profile?.photos && selectedMatch.profile.photos.length > 0 ? (
            <View style={[styles.cardWrapper, { width: CARD_WIDTH - 32, height: 280, alignSelf: 'center', marginBottom: theme.spacing.md }]}>
              <View style={[styles.profileCard, { height: '100%' }]}>
                <View style={[styles.cardImageWrapper, { height: '100%' }]}>
                  <Image
                    source={{ uri: getFileUrl(selectedMatch.profile, selectedMatch.profile.photos[detailPhotoIndex % selectedMatch.profile.photos.length]) }}
                    style={styles.cardImage}
                  />

                  {/* Tap left/right to browse images overlay */}
                  <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'box-none' }]}>
                    <TouchableOpacity
                      style={[styles.imageNavArea, { left: 0 }]}
                      onPress={() => setDetailPhotoIndex(prev => Math.max(0, prev - 1))}
                    />
                    <TouchableOpacity
                      style={[styles.imageNavArea, { right: 0 }]}
                      onPress={() => setDetailPhotoIndex(prev => Math.min(selectedMatch.profile.photos.length - 1, prev + 1))}
                    />
                  </View>

                  {/* Photo Dots Indicators */}
                  <CarouselDots count={selectedMatch.profile.photos.length} activeIndex={detailPhotoIndex % selectedMatch.profile.photos.length} />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyDetailPhotoBox}>
              <Feather name="image" size={32} color="#404040" />
              <Text style={{ color: '#606060', fontSize: 12, marginTop: 4 }}>Sin fotos</Text>
            </View>
          )}

          {/* Description */}
          <Text style={styles.matchSectionLabel}>Descripción</Text>
          <Text style={styles.matchDetailDescText}>
            {selectedMatch.profile.description || 'Sin descripción.'}
          </Text>

          {/* Contact Networks */}
          <Text style={styles.matchSectionLabel}>Contacto</Text>
          {selectedMatch.status === 'unmatched' ? (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 10, padding: 14, marginTop: 8 }}>
              <Text style={{ color: '#f87171', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>Match deshecho</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                Este match ha sido deshecho. Se eliminaron los likes recíprocos y los datos de contacto ya no están disponibles.
              </Text>
            </View>
          ) : (
            <>
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                <ContactLinksList contact={contact} loading={loadingContact} />
              </View>

              <View style={{ height: 20 }} />

              <TouchableOpacity
                style={styles.unmatchBtn}
                onPress={() => onUnmatch(selectedMatch.matchId)}
              >
                <Feather name="trash-2" size={16} color={theme.colors.error} style={{ marginRight: 8 }} />
                <Text style={styles.unmatchBtnText}>Deshacer Match</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
};
