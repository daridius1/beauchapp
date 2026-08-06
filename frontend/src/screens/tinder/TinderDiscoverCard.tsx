import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { getFileUrl } from '../../services/pocketbase';
import { UserChipsRow } from '../../components/UserChipsRow';
import { styles } from './TinderScreen.styles';
import { TinderExtraDetails } from './TinderExtraDetails';

interface TinderDiscoverCardProps {
  navigation: any;
  activeDiscoverProfile: any;
  activeDiscoverUser: any;
  activePhotos: any[];
  activePhotoIndex: number;
  setActivePhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  isCurrentlyLiked: boolean;
  userLadderRanksMap: Record<string, any[]>;
  userSellerProfilesMap: Record<string, any>;
  userMembershipsMap: Record<string, any[]>;
  discoverCount: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  onToggleLike: () => void;
}

export const TinderDiscoverCard: React.FC<TinderDiscoverCardProps> = ({
  navigation,
  activeDiscoverProfile,
  activeDiscoverUser,
  activePhotos,
  activePhotoIndex,
  setActivePhotoIndex,
  isCurrentlyLiked,
  userLadderRanksMap,
  userSellerProfilesMap,
  userMembershipsMap,
  discoverCount,
  setCurrentIndex,
  onToggleLike,
}) => {
  return (
    <ScrollView
      style={styles.discoverContainer}
      contentContainerStyle={styles.discoverScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.cardWrapper}>
        {/* Profile presentation */}
        <View style={styles.profileCard}>
          {/* Photo Viewer Carousel */}
          <View style={styles.cardImageWrapper}>
            {activePhotos.length > 0 ? (
              <>
                <Image
                  source={{ uri: getFileUrl(activeDiscoverProfile, activePhotos[activePhotoIndex], '800x0') }}
                  style={styles.cardImage}
                />

                {/* Tap left/right to browse images overlay */}
                <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'box-none' }]}>
                  <TouchableOpacity
                    style={[styles.imageNavArea, { left: 0 }]}
                    onPress={() => setActivePhotoIndex(prev => Math.max(0, prev - 1))}
                  />
                  <TouchableOpacity
                    style={[styles.imageNavArea, { right: 0 }]}
                    onPress={() => setActivePhotoIndex(prev => Math.min(activePhotos.length - 1, prev + 1))}
                  />
                </View>

                {/* Photo Dots Indicators */}
                {activePhotos.length > 1 && (
                  <View style={styles.photoDotsRow}>
                    {activePhotos.map((_: any, dotIdx: number) => (
                      <View
                        key={dotIdx}
                        style={[
                          styles.photoDot,
                          dotIdx === activePhotoIndex && styles.photoDotActive
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyCardImage}>
                <Feather name="image" size={48} color="#404040" />
                <Text style={styles.emptyCardImageText}>Sin fotos subidas</Text>
              </View>
            )}
          </View>

          {/* Profile Card details */}
          <View style={styles.cardDetails}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => activeDiscoverUser?.id && navigation.navigate('UserProfile', { userId: activeDiscoverUser.id })}
              style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
            >
              <Text style={styles.cardName}>{activeDiscoverUser?.name || 'Usuario'}</Text>
            </TouchableOpacity>

            {!!activeDiscoverUser?.username && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => activeDiscoverUser?.id && navigation.navigate('UserProfile', { userId: activeDiscoverUser.id })}
                style={{ alignSelf: 'flex-start', marginVertical: 2 }}
              >
                <Text style={styles.cardUsername}>@{activeDiscoverUser.username}</Text>
              </TouchableOpacity>
            )}

            {/* Chips del perfil del usuario (los mismos que en su perfil) */}
            {activeDiscoverUser && (
              <View style={{ marginVertical: 6, alignItems: 'flex-start' }}>
                <UserChipsRow
                  user={activeDiscoverUser}
                  memberships={userMembershipsMap[activeDiscoverUser.id] || []}
                  ladderRanks={userLadderRanksMap[activeDiscoverUser.id] || []}
                  sellerProfile={userSellerProfilesMap[activeDiscoverUser.id]}
                  align="left"
                  onOrgPress={(orgId) => navigation.navigate('UserProfile', { userId: orgId })}
                />
              </View>
            )}

            {/* Detalles opcionales (canción, libro, signo, bebida, comida, ramo, pasatiempos) */}
            <TinderExtraDetails profile={activeDiscoverProfile} />

            {activeDiscoverProfile.description ? (
              <Text style={styles.cardDesc}>{activeDiscoverProfile.description}</Text>
            ) : (
              <Text style={[styles.cardDesc, { fontStyle: 'italic', color: '#606060' }]}>
                Sin descripción
              </Text>
            )}
          </View>
        </View>

        {/* Looping Swipe controls */}
        <View style={styles.swipeButtonsRow}>
          {/* Previous Profile (loops back) */}
          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeBtnControl]}
            onPress={() => {
              setCurrentIndex(prev => (prev - 1 + discoverCount) % discoverCount);
              setActivePhotoIndex(0);
            }}
          >
            <Feather name="arrow-left" size={24} color="#a3a3a3" />
          </TouchableOpacity>

          {/* Like/Unlike Toggle (Middle) */}
          <TouchableOpacity
            style={[
              styles.swipeBtn,
              styles.swipeBtnLike,
              isCurrentlyLiked && { backgroundColor: '#10B981', borderColor: '#10B981' }
            ]}
            onPress={onToggleLike}
          >
            <FontAwesome
              name={isCurrentlyLiked ? 'heart' : 'heart-o'}
              size={26}
              color={isCurrentlyLiked ? '#ffffff' : '#10B981'}
            />
          </TouchableOpacity>

          {/* Next Profile (loops forward) */}
          <TouchableOpacity
            style={[styles.swipeBtn, styles.swipeBtnControl]}
            onPress={() => {
              setCurrentIndex(prev => (prev + 1) % discoverCount);
              setActivePhotoIndex(0);
            }}
          >
            <Feather name="arrow-right" size={24} color="#a3a3a3" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};
