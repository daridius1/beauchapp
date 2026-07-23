import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Image, 
  Alert, 
  Platform,
  Dimensions,
  Linking
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { pb, getFileUrl } from '../services/pocketbase';
import { tinderService } from '../services/tinder';
import { theme } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { Feather, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 450);

type Props = NativeStackScreenProps<RootStackParamList, 'Tinder'>;

export const TinderScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user } = useAuth();
  
  // Tabs: discover, matches, profile
  const [activeTab, setActiveTab] = useState<'discover' | 'matches' | 'profile'>('discover');

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);
  
  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [description, setDescription] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [telegram, setTelegram] = useState('');
  const [signal, setSignal] = useState('');
  
  // Photo management state
  const [photosList, setPhotosList] = useState<any[]>([]);
  const [deletedPhotos, setDeletedPhotos] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // Discover state (Looping carousel)
  const [discoverProfiles, setDiscoverProfiles] = useState<any[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  
  // Track likes given by this user
  const [likedUserIds, setLikedUserIds] = useState<Set<string>>(new Set());
  const [likeRecordIds, setLikeRecordIds] = useState<Map<string, string>>(new Map());

  // Matches state
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [showMatchDetailModal, setShowMatchDetailModal] = useState(false);

  // Match alert modal (from swipe)
  const [matchUser, setMatchUser] = useState<any>(null);
  const [matchProfile, setMatchProfile] = useState<any>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  // Time Lockout State
  const [lockoutHoursLeft, setLockoutHoursLeft] = useState<number | null>(null);

  // Live preview active photo index in editor tab
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0);

  // Photo carousels active indexes for matches modals
  const [matchPhotoIndex, setMatchPhotoIndex] = useState(0);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);

  // Custom unmatch confirmation modal states
  const [showUnmatchConfirmModal, setShowUnmatchConfirmModal] = useState(false);
  const [unmatchMatchId, setUnmatchMatchId] = useState<string>('');

  // Fetch current user tinder profile (or auto-create if missing)
  const fetchProfile = async () => {
    if (!user) return;
    try {
      setLoadingProfile(true);
      let res = await tinderService.getProfileByUserId(user.id);
      if (!res) {
        // Auto-create a base tinder profile if they don't have one
        res = await tinderService.createProfile({
          user: user.id,
          isActive: false,
          description: '',
        });
      }

      setProfile(res as any);
      setDescription(res.description || '');
      setInstagram(res.instagram || '');
      setWhatsapp(res.whatsapp || '');
      setTelegram(res.telegram || '');
      setSignal(res.signal || '');

      // Load existing photos
      if (res.photos && Array.isArray(res.photos)) {
        const existing = res.photos.map((ph: string) => ({
          uri: getFileUrl(res, ph),
          isLocal: false,
          name: ph
        }));
        setPhotosList(existing);
      } else {
        setPhotosList([]);
      }

      // Check 24h lockout
      if (res.isActive && res.activatedAt) {
        const activatedTime = new Date(res.activatedAt.replace(' ', 'T'));
        const diffMs = new Date().getTime() - activatedTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours < 24) {
          setLockoutHoursLeft(parseFloat((24 - diffHours).toFixed(1)));
        } else {
          setLockoutHoursLeft(null);
        }
      }
    } catch (err: any) {
      console.error('Error fetching tinder profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch Discover stack (looping loop)
  const fetchDiscover = async () => {
    if (!user) return;
    try {
      setLoadingDiscover(true);
      
      // Get all active profiles except self
      const res = await tinderService.getFullActiveProfiles(user.id);

      // Get all matches we have (to exclude from Discover)
      const matchesRes = await tinderService.getMatchesList(user.id);
      const matchedUserIds = new Set(matchesRes.map(m => m.userA === user.id ? m.userB : m.userA));

      // Get all likes we have sent (so we can check who we already liked)
      const likesRes = await tinderService.getLikesList(user.id);

      const likedIds = new Set<string>();
      const likeIdsMap = new Map<string, string>();
      likesRes.forEach(l => {
        likedIds.add(l.toUser);
        likeIdsMap.set(l.toUser, l.id);
      });

      // Filter out matches from discover list
      const filtered = res.filter(p => !matchedUserIds.has(p.user));

      setDiscoverProfiles(filtered);
      setLikedUserIds(likedIds);
      setLikeRecordIds(likeIdsMap);
      setCurrentIndex(0);
      setActivePhotoIndex(0);
    } catch (err) {
      console.error('Error fetching tinder discover stack:', err);
    } finally {
      setLoadingDiscover(false);
    }
  };

  // Fetch Matches list
  const fetchMatches = async () => {
    if (!user) return;
    try {
      setLoadingMatches(true);
      const matchesRes = await tinderService.getMatchesList(user.id);

      const matchedUserIds = matchesRes.map(m => m.userA === user.id ? m.userB : m.userA);
      
      if (matchedUserIds.length === 0) {
        setMatches([]);
        return;
      }

      // Query tinder_profiles for matches to get descriptions & verified contact handles
      let profileFilter = matchedUserIds.map(id => `user = "${id}"`).join(' || ');
      const profilesRes = await pb.collection('tinder_profiles').getFullList({
        filter: `(${profileFilter})`,
        expand: 'user'
      });

      // Map profiles with their user details
      const matchedData = profilesRes.map(p => {
        const matchedUserObj = p.expand?.user;
        return {
          profile: p,
          user: matchedUserObj,
          matchId: matchesRes.find(m => m.userA === matchedUserObj.id || m.userB === matchedUserObj.id)?.id
        };
      });

      setMatches(matchedData);
    } catch (err) {
      console.error('Error fetching tinder matches:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  // Load screen data on focus
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [user])
  );

  // Fetch Discover or Matches depending on active tab
  useEffect(() => {
    if (profile?.isActive) {
      if (activeTab === 'discover') {
        fetchDiscover();
      } else if (activeTab === 'matches') {
        fetchMatches();
      }
    }
  }, [activeTab, profile?.isActive]);

  // Toggle Like Status (Like or Unlike)
  const handleToggleLike = async () => {
    const targetProfile = discoverProfiles[currentIndex % discoverProfiles.length];
    if (!targetProfile || !user) return;

    const targetUserId = targetProfile.user;
    const isLiked = likedUserIds.has(targetUserId);

    try {
      if (isLiked) {
        // UNLIKE: Remove from database
        const likeId = likeRecordIds.get(targetUserId);
        if (likeId) {
          await tinderService.deleteLike(likeId);
          
          // Delete match in database if matched (lexicographically ordered userA and userB)
          const idA = user.id < targetUserId ? user.id : targetUserId;
          const idB = user.id > targetUserId ? user.id : targetUserId;
          try {
            const match = await tinderService.getMatchBetweenUsers(idA, idB);
            if (match) {
              await tinderService.deleteMatch(match.id);
            }
          } catch (_) {
            // Match didn't exist or already removed
          }

          // Update state locally
          setLikedUserIds(prev => {
            const next = new Set(prev);
            next.delete(targetUserId);
            return next;
          });
          setLikeRecordIds(prev => {
            const next = new Map(prev);
            next.delete(targetUserId);
            return next;
          });
        }
      } else {
        // LIKE: Add to database
        const newLike = await tinderService.createLike(user.id, targetUserId, true);

        // Update state locally
        setLikedUserIds(prev => {
          const next = new Set(prev);
          next.add(targetUserId);
          return next;
        });
        setLikeRecordIds(prev => {
          const next = new Map(prev);
          next.set(targetUserId, newLike.id);
          return next;
        });

        // Query if a mutual match record was created by the backend hook
        const idA = user.id < targetUserId ? user.id : targetUserId;
        const idB = user.id > targetUserId ? user.id : targetUserId;
        let matchedRecord = null;
        try {
          matchedRecord = await tinderService.getMatchBetweenUsers(idA, idB);
        } catch (_) {}

        if (matchedRecord) {
          // MUTUAL MATCH! Show overlay alert
          setMatchUser(targetProfile.expand?.user);
          
          // Refetch profile to get the contact info (now authorized by match hook)
          try {
            const unlockedProfile = await tinderService.getProfileByUserId(targetUserId);
            setMatchProfile(unlockedProfile);
          } catch (_) {
            setMatchProfile(targetProfile);
          }
          setShowMatchModal(true);
        }
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo procesar la acción.'
      });
    }
  };

  // Toggle active/inactive state of Tinder Beauchef
  const handleToggleActive = async (targetActive: boolean) => {
    if (!user || !profile) return;

    if (!targetActive && lockoutHoursLeft !== null) {
      Alert.alert(
        'Bloqueo Activo',
        `No puedes desactivar Tinder Beauchef hasta que pasen 24 horas. Te quedan ${lockoutHoursLeft} horas.`
      );
      return;
    }

    try {
      setSavingProfile(true);
      const res = await tinderService.updateProfile(profile.id, {
        isActive: targetActive
      });
      setProfile(res as any);
      
      Toast.show({
        type: 'success',
        text1: targetActive ? 'Tinder Beauchef Activado' : 'Tinder Beauchef Desactivado',
        text2: targetActive ? 'Tu perfil ya es visible para otros.' : 'Tu perfil ya no es visible.'
      });
      fetchProfile();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cambiar el estado del perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Image Picking
  const handleAddPhoto = async () => {
    if (photosList.length >= 5) {
      Alert.alert('Límite de fotos', 'Puedes subir un máximo de 5 fotos.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({
        type: 'error',
        text1: 'Permisos requeridos',
        text2: 'Se necesitan permisos de galería para añadir fotos.'
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    const newPhotoItem = {
      uri: asset.uri,
      isLocal: true,
      file: asset
    };
    setPhotosList(prev => [...prev, newPhotoItem]);
  };

  const handleRemovePhoto = (index: number) => {
    const target = photosList[index];
    if (!target) return;

    if (!target.isLocal) {
      setDeletedPhotos(prev => [...prev, target.name]);
    }

    setPhotosList(prev => prev.filter((_, i) => i !== index));
  };

  // Profile Save
  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    try {
      setSavingProfile(true);
      const formData = new FormData();
      formData.append('description', description.trim());
      formData.append('instagram', instagram.trim());
      formData.append('whatsapp', whatsapp.trim());
      formData.append('telegram', telegram.trim());
      formData.append('signal', signal.trim());

      // Send files in order (both existing files to keep and new files to upload)
      for (const ph of photosList) {
        if (ph.isLocal) {
          if (Platform.OS === 'web') {
            const response = await fetch(ph.uri);
            const blob = await response.blob();
            formData.append('photos', blob, ph.file.fileName || 'profile_tinder.jpg');
          } else {
            formData.append('photos', {
              uri: ph.uri,
              name: ph.file.fileName || 'profile_tinder.jpg',
              type: ph.file.mimeType || 'image/jpeg',
            } as any);
          }
        } else {
          // Keep existing photo by appending its name as string
          formData.append('photos', ph.name);
        }
      }

      const res = await tinderService.updateProfile(profile.id, formData);
      setProfile(res as any);
      setDeletedPhotos([]);
      
      Toast.show({
        type: 'success',
        text1: 'Perfil guardado',
        text2: 'Tu perfil de Tinder Beauchef ha sido actualizado con éxito.'
      });

      fetchProfile();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Social Links helper
  const openSocialLink = (type: string, value: string) => {
    let url = '';
    const cleanValue = value.replace('@', '').trim();
    
    if (type === 'instagram') {
      url = `https://instagram.com/${cleanValue}`;
    } else if (type === 'whatsapp') {
      const phone = cleanValue.replace(/[^0-9+]/g, '');
      url = `https://wa.me/${phone}`;
    } else if (type === 'telegram') {
      url = `https://t.me/${cleanValue}`;
    } else if (type === 'signal') {
      url = `https://signal.me/#p/${cleanValue}`;
    }

    if (url) {
      Linking.openURL(url).catch(() => {
        Toast.show({
          type: 'error',
          text1: 'Error al abrir link',
          text2: 'No se pudo abrir la aplicación seleccionada.'
        });
      });
    }
  };

  const performUnmatch = async (matchId: string) => {
    if (!selectedMatch || !user) return;
    const targetUserId = selectedMatch.user.id;
    try {
      // 1. Delete match record
      await tinderService.deleteMatch(matchId);
      
      // 2. Delete tinder_likes record from current user to target user
      try {
        const like = await tinderService.getLikeBetweenUsers(user.id, targetUserId);
        if (like) {
          await tinderService.deleteLike(like.id);
        }
      } catch (_) {
        // Like not found or already deleted
      }

      Toast.show({
        type: 'success',
        text1: 'Match deshecho',
        text2: 'El match ha sido eliminado.'
      });

      // Close modals
      setShowUnmatchConfirmModal(false);
      setShowMatchDetailModal(false);
      
      // Switch tab to discover and reload
      setActiveTab('discover');
      fetchDiscover();
      fetchMatches();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo deshacer el match.'
      });
    }
  };

  const handleUnmatch = (matchId: string) => {
    setUnmatchMatchId(matchId);
    setShowUnmatchConfirmModal(true);
  };

  // Block organization users from participating in Tinder
  if (user?.type === 'organization') {
    return (
      <View style={styles.loadingContainer}>
        <View style={[styles.emptyDiscoverBox, { marginTop: 0 }]}>
          <FontAwesome name="ban" size={48} color={theme.colors.error} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyDiscoverText, { color: theme.colors.error }]}>Acceso Denegado</Text>
          <Text style={styles.emptyDiscoverSub}>
            Tinder Beauchef es un feature exclusivo para estudiantes. Las cuentas de organizaciones no están autorizadas para ingresar a esta sección.
          </Text>
        </View>
      </View>
    );
  }

  // Render Loader
  if (loadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Active Discover Profile in looping stack
  const activeDiscoverProfile = discoverProfiles.length > 0 ? discoverProfiles[currentIndex % discoverProfiles.length] : null;
  const activeDiscoverUser = activeDiscoverProfile?.expand?.user;
  const activePhotos = activeDiscoverProfile?.photos || [];
  const isCurrentlyLiked = activeDiscoverProfile ? likedUserIds.has(activeDiscoverProfile.user) : false;

  return (
    <View style={styles.container}>
      {/* Top Selector Tabs */}
      <View style={styles.tabHeader}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'discover' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('discover')}
        >
          <Feather name="search" size={18} color={activeTab === 'discover' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'discover' && styles.tabBtnTextActive]}>Descubrir</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'matches' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('matches')}
        >
          <Feather name="heart" size={18} color={activeTab === 'matches' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'matches' && styles.tabBtnTextActive]}>
            Matches {matches.length > 0 && `(${matches.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'profile' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('profile')}
        >
          <Feather name="user" size={18} color={activeTab === 'profile' ? theme.colors.primary : '#a3a3a3'} />
          <Text style={[styles.tabBtnText, activeTab === 'profile' && styles.tabBtnTextActive]}>Mi Perfil</Text>
        </TouchableOpacity>
      </View>

      {/* --- TAB 1: DISCOVER (CAROUSEL LOOP VIEW) --- */}
      {activeTab === 'discover' && (
        <View style={{ flex: 1 }}>
          {!profile?.isActive ? (
            // If inactive: show simple activation notice
            <View style={styles.emptyDiscoverBox}>
              <FontAwesome name="heart-o" size={44} color="#525252" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyDiscoverText}>Tinder Beauchef está desactivado</Text>
              <Text style={styles.emptyDiscoverSub}>
                Activa tu cuenta en la pestaña "Mi Perfil" para empezar a ver personas de la facultad.
              </Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={() => setActiveTab('profile')}>
                <Text style={styles.refreshBtnText}>Configurar Mi Perfil</Text>
              </TouchableOpacity>
            </View>
          ) : loadingDiscover ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : discoverProfiles.length > 0 && activeDiscoverProfile ? (
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
                          source={{ uri: getFileUrl(activeDiscoverProfile, activePhotos[activePhotoIndex]) }} 
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={styles.cardName}>{activeDiscoverUser?.name || 'Usuario'}</Text>
                    </View>
                    
                    {!!activeDiscoverUser?.username && <Text style={styles.cardUsername}>@{activeDiscoverUser.username}</Text>}
                    
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
                      setCurrentIndex(prev => (prev - 1 + discoverProfiles.length) % discoverProfiles.length);
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
                    onPress={handleToggleLike}
                  >
                    <FontAwesome 
                      name={isCurrentlyLiked ? "heart" : "heart-o"} 
                      size={26} 
                      color={isCurrentlyLiked ? "#ffffff" : "#10B981"} 
                    />
                  </TouchableOpacity>

                  {/* Next Profile (loops forward) */}
                  <TouchableOpacity 
                    style={[styles.swipeBtn, styles.swipeBtnControl]} 
                    onPress={() => {
                      setCurrentIndex(prev => (prev + 1) % discoverProfiles.length);
                      setActivePhotoIndex(0);
                    }}
                  >
                    <Feather name="arrow-right" size={24} color="#a3a3a3" />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyDiscoverBox}>
              <FontAwesome name="search" size={44} color="#525252" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyDiscoverText}>No hay más perfiles por ahora</Text>
              <Text style={styles.emptyDiscoverSub}>¡Vuelve más tarde para descubrir nuevas personas!</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={fetchDiscover}>
                <Text style={styles.refreshBtnText}>Refrescar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* --- TAB 2: MATCHES LIST --- */}
      {activeTab === 'matches' && (
        <View style={{ flex: 1 }}>
          {!profile?.isActive ? (
            <View style={styles.emptyDiscoverBox}>
              <FontAwesome name="heart-o" size={44} color="#525252" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyDiscoverText}>Tinder Beauchef está desactivado</Text>
              <Text style={styles.emptyDiscoverSub}>Activa tu cuenta en la pestaña "Mi Perfil" para ver tus matches.</Text>
            </View>
          ) : loadingMatches ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : matches.length > 0 ? (
            <ScrollView contentContainerStyle={styles.matchesScroll} showsVerticalScrollIndicator={false}>
              {matches.map((item, idx) => (
                <TouchableOpacity 
                  key={idx}
                  style={styles.matchCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedMatch(item);
                    setShowMatchDetailModal(true);
                  }}
                >
                  <Avatar user={item.user} size={50} />
                  <View style={styles.matchCardBody}>
                    <Text style={styles.matchCardName}>{item.user?.name || 'Usuario'}</Text>
                    {!!item.user?.username && <Text style={styles.matchCardUsername}>@{item.user.username}</Text>}
                    <Text style={styles.matchCardDesc} numberOfLines={1}>
                      {item.profile.description || 'Sin descripción'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyDiscoverBox}>
              <FontAwesome name="heart-o" size={44} color="#525252" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyDiscoverText}>Aún no tienes matches</Text>
              <Text style={styles.emptyDiscoverSub}>Sigue descubriendo perfiles y dando likes para encontrar una coincidencia.</Text>
            </View>
          )}
        </View>
      )}

      {/* --- TAB 3: INLINE PROFILE EDITOR ("MI PERFIL") --- */}
      {activeTab === 'profile' && profile && (
        <ScrollView style={styles.profileTabContainer} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

          {/* Guidelines box when inactive */}
          {!profile.isActive && (
            <View style={styles.inlineRuleBox}>
              <Text style={styles.ruleTitle}>❤️ Reglas de Tinder Beauchef</Text>
              <View style={styles.ruleItem}>
                <Feather name="shield" size={14} color={theme.colors.primary} />
                <Text style={styles.ruleItemText}>Tus datos de contacto estarán 100% ocultos hasta hacer match mutuo.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Feather name="clock" size={14} color={theme.colors.primary} />
                <Text style={styles.ruleItemText}>Una vez que lo actives, no podrás desactivarlo por 24 horas.</Text>
              </View>
            </View>
          )}

          <View style={[styles.cardWrapper, { marginBottom: theme.spacing.lg, alignSelf: 'center' }]}>
            <View style={styles.profileCard}>
              <View style={styles.cardImageWrapper}>
                {photosList.length > 0 ? (
                  <>
                    <Image 
                      source={{ uri: photosList[previewPhotoIndex % photosList.length]?.uri }} 
                      style={styles.cardImage} 
                    />
                    
                    {/* Tap left/right to browse images overlay */}
                    <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'box-none' }]}>
                      <TouchableOpacity
                        style={[styles.imageNavArea, { left: 0 }]}
                        onPress={() => setPreviewPhotoIndex(prev => Math.max(0, prev - 1))}
                      />
                      <TouchableOpacity
                        style={[styles.imageNavArea, { right: 0 }]}
                        onPress={() => setPreviewPhotoIndex(prev => Math.min(photosList.length - 1, prev + 1))}
                      />
                    </View>

                    {/* Photo Dots Indicators */}
                    {photosList.length > 1 && (
                      <View style={styles.photoDotsRow}>
                        {photosList.map((_: any, dotIdx: number) => (
                          <View 
                            key={dotIdx} 
                            style={[
                              styles.photoDot, 
                              dotIdx === (previewPhotoIndex % photosList.length) && styles.photoDotActive
                            ]} 
                          />
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyCardImage}>
                    <Feather name="image" size={48} color="#404040" />
                    <Text style={styles.emptyCardImageText}>Sin fotos seleccionadas aún</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardDetails}>
                <Text style={styles.cardName}>{user?.name || 'Tu Nombre'}</Text>
                {!!user?.username && <Text style={styles.cardUsername}>@{user.username}</Text>}
                
                {description.trim() ? (
                  <Text style={styles.cardDesc}>{description}</Text>
                ) : (
                  <Text style={[styles.cardDesc, { fontStyle: 'italic', color: '#606060' }]}>
                    Escribe una descripción abajo para ver cómo se verá...
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Form details */}
          <View style={styles.editorForm}>
            {/* Photos grid */}
            <Text style={styles.fieldLabel}>Tus Fotos (Máx 5)</Text>
            <View style={styles.photosGrid}>
              {photosList.map((ph, photoIdx) => (
                <View key={photoIdx} style={styles.photoSlot}>
                  <Image source={{ uri: ph.uri }} style={styles.slotImage} />
                  <TouchableOpacity 
                    style={styles.removePhotoBtn} 
                    onPress={() => handleRemovePhoto(photoIdx)}
                  >
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              
              {photosList.length < 5 && (
                <TouchableOpacity style={styles.addPhotoSlot} onPress={handleAddPhoto}>
                  <Feather name="plus" size={24} color="#a3a3a3" />
                  <Text style={{ fontSize: 10, color: '#a3a3a3', marginTop: 4 }}>Subir</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Description */}
            <Text style={styles.fieldLabel}>Descripción</Text>
            <TextInput
              style={[styles.inputField, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Escribe algo sobre ti, tus hobbies o lo que buscas..."
              placeholderTextColor={theme.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              maxLength={450}
              multiline
            />

            {/* Redes de contacto */}
            <Text style={styles.fieldLabel}>Redes de Contacto (Solo visibles al hacer Match)</Text>
            
            <View style={styles.contactRow}>
              <FontAwesome name="instagram" size={20} color="#E1306C" style={styles.contactIcon} />
              <TextInput
                style={[styles.inputField, { flex: 1, marginBottom: 0 }]}
                placeholder="Instagram (ej. @tu_usuario)"
                placeholderTextColor={theme.colors.textMuted}
                value={instagram}
                onChangeText={setInstagram}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.contactRow}>
              <FontAwesome name="whatsapp" size={20} color="#25D366" style={styles.contactIcon} />
              <TextInput
                style={[styles.inputField, { flex: 1, marginBottom: 0 }]}
                placeholder="WhatsApp (ej. +56912345678)"
                placeholderTextColor={theme.colors.textMuted}
                value={whatsapp}
                onChangeText={setWhatsapp}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.contactRow}>
              <FontAwesome name="paper-plane" size={18} color="#0088cc" style={styles.contactIcon} />
              <TextInput
                style={[styles.inputField, { flex: 1, marginBottom: 0 }]}
                placeholder="Telegram Username"
                placeholderTextColor={theme.colors.textMuted}
                value={telegram}
                onChangeText={setTelegram}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.contactRow}>
              <Feather name="message-square" size={20} color="#3a76f0" style={styles.contactIcon} />
              <TextInput
                style={[styles.inputField, { flex: 1, marginBottom: 0 }]}
                placeholder="Signal Username"
                placeholderTextColor={theme.colors.textMuted}
                value={signal}
                onChangeText={setSignal}
                autoCapitalize="none"
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity 
              style={[styles.saveBtn, { marginTop: 24 }]} 
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.saveBtnText}>Guardar Cambios</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Activation switch box at the bottom */}
          <View style={[styles.activationStatusBox, profile.isActive && styles.activationStatusBoxActive, { marginTop: theme.spacing.lg }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.activationStatusTitle}>
                {profile.isActive ? '🟢 Tinder Beauchef Activo' : '🔴 Tinder Beauchef Desactivado'}
              </Text>
              <Text style={styles.activationStatusDesc}>
                {profile.isActive 
                  ? 'Tu perfil es visible para otros estudiantes de la facultad en la sección Descubrir.'
                  : 'Tu perfil está completamente oculto. Actívalo para participar en Tinder Beauchef.'}
              </Text>
            </View>

            {profile.isActive ? (
              <TouchableOpacity
                style={[styles.statusToggleBtn, styles.statusToggleBtnDeactivate, lockoutHoursLeft !== null && { opacity: 0.5 }]}
                onPress={() => handleToggleActive(false)}
                disabled={savingProfile || lockoutHoursLeft !== null}
              >
                <Text style={styles.statusToggleBtnText}>
                  {lockoutHoursLeft !== null ? `Bloqueado (${lockoutHoursLeft}h)` : 'Desactivar'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.statusToggleBtn, styles.statusToggleBtnActivate]}
                onPress={() => handleToggleActive(true)}
                disabled={savingProfile}
              >
                <Text style={styles.statusToggleBtnText}>Activar</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* --- RECIPIENT MATCH SWIPE MODAL (OVERLAY POPUP) --- */}
      {showMatchModal && (
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
                <Avatar user={user} size={84} />
                <View style={styles.matchAvatarsHeart}>
                  <FontAwesome name="heart" size={24} color="#EF4444" />
                </View>
                <Avatar user={matchUser} size={84} />
              </View>

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
                    onPress={() => openSocialLink('instagram', matchProfile.instagram)}
                  >
                    <FontAwesome name="instagram" size={22} color="#E1306C" style={{ marginRight: 10 }} />
                    <Text style={styles.unlockedContactText}>@{matchProfile.instagram}</Text>
                    <Feather name="external-link" size={14} color="#E1306C" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                {!!matchProfile?.whatsapp && (
                  <TouchableOpacity 
                    style={[styles.unlockedContactItem, { borderColor: '#25D366' }]}
                    onPress={() => openSocialLink('whatsapp', matchProfile.whatsapp)}
                  >
                    <FontAwesome name="whatsapp" size={22} color="#25D366" style={{ marginRight: 10 }} />
                    <Text style={styles.unlockedContactText}>{matchProfile.whatsapp}</Text>
                    <Feather name="external-link" size={14} color="#25D366" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                {!!matchProfile?.telegram && (
                  <TouchableOpacity 
                    style={[styles.unlockedContactItem, { borderColor: '#0088cc' }]}
                    onPress={() => openSocialLink('telegram', matchProfile.telegram)}
                  >
                    <FontAwesome name="paper-plane" size={20} color="#0088cc" style={{ marginRight: 10 }} />
                    <Text style={styles.unlockedContactText}>Telegram</Text>
                    <Feather name="external-link" size={14} color="#0088cc" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                {!!matchProfile?.signal && (
                  <TouchableOpacity 
                    style={[styles.unlockedContactItem, { borderColor: '#3a76f0' }]}
                    onPress={() => openSocialLink('signal', matchProfile.signal)}
                  >
                    <Feather name="message-square" size={22} color="#3a76f0" style={{ marginRight: 10 }} />
                    <Text style={styles.unlockedContactText}>Signal: {matchProfile.signal}</Text>
                    <Feather name="external-link" size={14} color="#3a76f0" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={styles.closeMatchBtn}
                onPress={() => {
                  setShowMatchModal(false);
                  setMatchUser(null);
                  setMatchProfile(null);
                  // Also trigger a matches reload so they see it in the other tab
                  fetchMatches();
                }}
              >
                <Text style={styles.closeMatchBtnText}>Seguir Deslizando</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* --- MATCH DETAIL MODAL (LIST POPUP) --- */}
      {showMatchDetailModal && selectedMatch && (
        <View style={styles.modalOverlay}>
          <View style={styles.matchDetailCard}>
            <View style={styles.matchDetailHeader}>
              <View style={styles.matchDetailHeaderTitleRow}>
                <Avatar user={selectedMatch.user} size={44} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.matchDetailName}>{selectedMatch.user?.name}</Text>
                  {!!selectedMatch.user?.username && <Text style={styles.matchDetailUsername}>@{selectedMatch.user.username}</Text>}
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowMatchDetailModal(false)}>
                <Feather name="x" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: theme.spacing.md }} showsVerticalScrollIndicator={false}>
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
                      {selectedMatch.profile.photos.length > 1 && (
                        <View style={styles.photoDotsRow}>
                          {selectedMatch.profile.photos.map((_: any, dotIdx: number) => (
                            <View 
                              key={dotIdx} 
                              style={[
                                styles.photoDot, 
                                dotIdx === (detailPhotoIndex % selectedMatch.profile.photos.length) && styles.photoDotActive
                              ]} 
                            />
                          ))}
                        </View>
                      )}
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
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                {!!selectedMatch.profile.instagram && (
                  <TouchableOpacity 
                    style={[styles.unlockedContactItem, { borderColor: '#E1306C' }]}
                    onPress={() => openSocialLink('instagram', selectedMatch.profile.instagram)}
                  >
                    <FontAwesome name="instagram" size={20} color="#E1306C" style={{ marginRight: 10 }} />
                    <Text style={styles.unlockedContactText}>@{selectedMatch.profile.instagram}</Text>
                    <Feather name="external-link" size={12} color="#E1306C" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                {!!selectedMatch.profile.whatsapp && (
                  <TouchableOpacity 
                    style={[styles.unlockedContactItem, { borderColor: '#25D366' }]}
                    onPress={() => openSocialLink('whatsapp', selectedMatch.profile.whatsapp)}
                  >
                    <FontAwesome name="whatsapp" size={20} color="#25D366" style={{ marginRight: 10 }} />
                    <Text style={styles.unlockedContactText}>{selectedMatch.profile.whatsapp}</Text>
                    <Feather name="external-link" size={12} color="#25D366" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                {!!selectedMatch.profile.telegram && (
                  <TouchableOpacity 
                    style={[styles.unlockedContactItem, { borderColor: '#0088cc' }]}
                    onPress={() => openSocialLink('telegram', selectedMatch.profile.telegram)}
                  >
                    <FontAwesome name="paper-plane" size={18} color="#0088cc" style={{ marginRight: 10 }} />
                    <Text style={styles.unlockedContactText}>Telegram</Text>
                    <Feather name="external-link" size={12} color="#0088cc" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                {!!selectedMatch.profile.signal && (
                  <TouchableOpacity 
                    style={[styles.unlockedContactItem, { borderColor: '#3a76f0' }]}
                    onPress={() => openSocialLink('signal', selectedMatch.profile.signal)}
                  >
                    <Feather name="message-square" size={20} color="#3a76f0" style={{ marginRight: 10 }} />
                    <Text style={styles.unlockedContactText}>Signal: {selectedMatch.profile.signal}</Text>
                    <Feather name="external-link" size={12} color="#3a76f0" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                {!selectedMatch.profile.instagram && !selectedMatch.profile.whatsapp && !selectedMatch.profile.telegram && !selectedMatch.profile.signal && (
                  <Text style={{ fontStyle: 'italic', color: '#606060', fontSize: 13 }}>
                    No especificó datos de contacto.
                  </Text>
                )}
              </View>

              <View style={{ height: 20 }} />
              
              <TouchableOpacity
                style={styles.unmatchBtn}
                onPress={() => handleUnmatch(selectedMatch.matchId)}
              >
                <Feather name="trash-2" size={16} color={theme.colors.error} style={{ marginRight: 8 }} />
                <Text style={styles.unmatchBtnText}>Deshacer Match</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      )}

      {/* --- CUSTOM UNMATCH CONFIRMATION MODAL --- */}
      {showUnmatchConfirmModal && selectedMatch && (
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalHeader}>
              <Feather name="alert-triangle" size={22} color={theme.colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.confirmModalTitle}>Deshacer Match</Text>
            </View>

            <Text style={styles.confirmModalDesc}>
              ¿Estás seguro de que deseas deshacer tu match con <Text style={{ fontWeight: '700', color: theme.colors.text }}>{selectedMatch.user?.name}</Text>?
              {"\n\n"}
              Ambos dejarán de ver sus datos de contacto en redes sociales de inmediato.
            </Text>

            <View style={styles.confirmModalActions}>
              <TouchableOpacity 
                style={[styles.confirmModalBtn, styles.confirmModalBtnCancel]} 
                onPress={() => setShowUnmatchConfirmModal(false)}
              >
                <Text style={styles.confirmModalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.confirmModalBtn, styles.confirmModalBtnConfirm]} 
                onPress={() => performUnmatch(unmatchMatchId)}
              >
                <Text style={styles.confirmModalBtnTextConfirm}>Deshacer Match</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.cardBg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabBtnTextActive: {
    color: theme.colors.text,
  },
  discoverContainer: {
    flex: 1,
  },
  discoverScroll: {
    padding: theme.spacing.md,
    alignItems: 'center',
    paddingBottom: 40,
  },
  cardWrapper: {
    alignItems: 'center',
    width: '100%',
    maxWidth: CARD_WIDTH,
  },
  profileCard: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  cardImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0a0a0a',
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageNavArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
  },
  photoDotsRow: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  photoDotActive: {
    backgroundColor: '#ffffff',
    width: 8,
  },
  emptyCardImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardImageText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  cardDetails: {
    paddingVertical: theme.spacing.md,
  },
  cardName: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  cardUsername: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  cardDesc: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 18,
    marginTop: theme.spacing.sm,
  },
  swipeButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
    width: '100%',
  },
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
  swipeBtnControl: {
    borderColor: '#404040',
  },
  swipeBtnPass: {
    borderColor: '#EF4444',
  },
  swipeBtnLike: {
    borderColor: '#10B981',
  },
  likedBadge: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  likedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyDiscoverBox: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyDiscoverText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDiscoverSub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    lineHeight: 18,
    maxWidth: 280,
  },
  refreshBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  refreshBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  matchesScroll: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  matchCardBody: {
    flex: 1,
    marginLeft: 12,
  },
  matchCardName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  matchCardUsername: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  matchCardDesc: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  profileTabContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  activationStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: theme.spacing.md,
  },
  activationStatusBoxActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  activationStatusTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  activationStatusDesc: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  statusToggleBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  statusToggleBtnActivate: {
    backgroundColor: theme.colors.primary,
  },
  statusToggleBtnDeactivate: {
    backgroundColor: theme.colors.error,
  },
  statusToggleBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineRuleBox: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 10,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 10,
  },
  ruleTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleItemText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginLeft: 8,
    flex: 1,
    lineHeight: 15,
  },
  editorForm: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  fieldLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  photoSlot: {
    position: 'relative',
    width: 65,
    height: 65,
    borderRadius: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoSlot: {
    width: 65,
    height: 65,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#333',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputField: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 10,
    color: theme.colors.text,
    fontSize: 13,
    marginBottom: theme.spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  contactIcon: {
    width: 30,
    textAlign: 'center',
    marginRight: 6,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  matchPopup: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: theme.colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    overflow: 'hidden',
  },
  sparkleHeart: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  matchPopupTitle: {
    color: '#10B981',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: theme.spacing.xs,
  },
  matchPopupSub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  matchAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginVertical: theme.spacing.sm,
    gap: 16,
  },
  matchAvatarsHeart: {
    position: 'absolute',
    left: '50%',
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  unlockedContactsContainer: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  unlockedContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  unlockedContactText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  closeMatchBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  closeMatchBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  matchDetailCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '90%',
    height: '75%',
    maxWidth: 450,
    overflow: 'hidden',
  },
  matchDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  matchDetailHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchDetailName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  matchDetailUsername: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  matchDetailPhotosScroll: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  matchDetailPhoto: {
    width: CARD_WIDTH - 64,
    height: 250,
  },
  emptyDetailPhotoBox: {
    width: '100%',
    height: 150,
    backgroundColor: '#111',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchSectionLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  matchDetailDescText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  unmatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 24,
  },
  unmatchBtnText: {
    color: theme.colors.error,
    fontSize: 13,
    fontWeight: '700',
  },
  previewSectionHeader: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  confirmModalCard: {
    width: '85%',
    maxWidth: 350,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  confirmModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  confirmModalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  confirmModalDesc: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  confirmModalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  confirmModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalBtnCancel: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  confirmModalBtnConfirm: {
    backgroundColor: theme.colors.error,
  },
  confirmModalBtnTextCancel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmModalBtnTextConfirm: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
