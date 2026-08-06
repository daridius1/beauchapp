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
  Linking,
  DeviceEventEmitter
} from 'react-native';
import { withMinimumDelay } from '../utils/refresh';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { pb, getFileUrl } from '../services/pocketbase';
import { tinderService } from '../services/tinder';
import { theme } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { UserChipsRow } from '../components/UserChipsRow';
import { Feather, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { compressImage } from '../utils/imageCompressor';
import { styles } from './tinder/TinderScreen.styles';
import { TinderExtraDetails } from './tinder/TinderExtraDetails';
import { TinderRulesPanel } from './tinder/TinderRulesPanel';
import { TinderDiscoverCard } from './tinder/TinderDiscoverCard';
import { TinderMatchModal } from './tinder/TinderMatchModal';
import { TinderMatchDetailModal } from './tinder/TinderMatchDetailModal';
import { TinderUnmatchConfirmModal } from './tinder/TinderUnmatchConfirmModal';

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
  
  // Extra optional fields
  const [favoriteSong, setFavoriteSong] = useState('');
  const [favoriteBook, setFavoriteBook] = useState('');
  const [zodiacSign, setZodiacSign] = useState('');
  const [favoriteDrink, setFavoriteDrink] = useState('');
  const [favoriteFood, setFavoriteFood] = useState('');
  const [favoriteSubject, setFavoriteSubject] = useState('');
  const [hobbies, setHobbies] = useState('');
  
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

  // Ladder ranks, seller profiles and organization memberships cache for candidate users
  const [userLadderRanksMap, setUserLadderRanksMap] = useState<Record<string, any[]>>({});
  const [userSellerProfilesMap, setUserSellerProfilesMap] = useState<Record<string, any>>({});
  const [userMembershipsMap, setUserMembershipsMap] = useState<Record<string, any[]>>({});

  // Helper to fetch ladder ranks & seller profiles for a list of user IDs
  const loadUserChipsData = async (targetUserIds: string[]) => {
    if (!targetUserIds || targetUserIds.length === 0) return;
    const uniqueIds = Array.from(new Set(targetUserIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const filterStr = uniqueIds.map((id) => `user = "${id}"`).join(' || ');

    try {
      const ranksRes = await pb.collection('ladder_ranks').getFullList({
        filter: `(${filterStr})`,
        expand: 'ladder',
      });
      setUserLadderRanksMap((prev) => {
        const next = { ...prev };
        ranksRes.forEach((r: any) => {
          if (!next[r.user]) {
            next[r.user] = [r];
          } else if (!next[r.user].some((existing: any) => existing.id === r.id)) {
            next[r.user] = [...next[r.user], r];
          }
        });
        return next;
      });
    } catch (_) {}

    try {
      const sellerRes = await pb.collection('seller_profiles').getFullList({
        filter: `(${filterStr})`,
      });
      setUserSellerProfilesMap((prev) => {
        const next = { ...prev };
        sellerRes.forEach((s: any) => {
          next[s.user] = s;
        });
        return next;
      });
    } catch (_) {}

    try {
      const membershipsRes = await pb.collection('organization_members').getFullList({
        filter: `(${filterStr}) && status = "active"`,
        expand: 'organization',
      });
      setUserMembershipsMap((prev) => {
        const next = { ...prev };
        membershipsRes.forEach((m: any) => {
          if (!next[m.user]) {
            next[m.user] = [m];
          } else if (!next[m.user].some((existing: any) => existing.id === m.id)) {
            next[m.user] = [...next[m.user], m];
          }
        });
        return next;
      });
    } catch (_) {}
  };

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

      setFavoriteSong((res as any).favorite_song || '');
      setFavoriteBook((res as any).favorite_book || '');
      setZodiacSign((res as any).zodiac_sign || '');
      setFavoriteDrink((res as any).favorite_drink || '');
      setFavoriteFood((res as any).favorite_food || '');
      setFavoriteSubject((res as any).favorite_subject || '');
      setHobbies((res as any).hobbies || '');

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
      if (res.isActive && res.activatedAt && typeof res.activatedAt === 'string') {
        const dateStr = res.activatedAt.includes('T') ? res.activatedAt : res.activatedAt.replace(' ', 'T');
        const activatedTime = new Date(dateStr);
        if (!isNaN(activatedTime.getTime())) {
          const diffMs = new Date().getTime() - activatedTime.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours < 24) {
            setLockoutHoursLeft(parseFloat((24 - diffHours).toFixed(1)));
          } else {
            setLockoutHoursLeft(null);
          }
        }
      }
      loadUserChipsData([user.id]);
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

      // Load chips data (ladders & seller profiles)
      const discoverUserIds = filtered.map((p) => p.user);
      loadUserChipsData(discoverUserIds);
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
      let profilesRes: any[] = [];
      try {
        profilesRes = await pb.collection('tinder_profiles').getFullList({
          filter: `(${profileFilter})`,
          expand: 'user'
        });
      } catch (pErr) {}

      // Map matches with their profile & status details
      const matchedData = matchesRes.map(m => {
        const otherUserId = m.userA === user.id ? m.userB : m.userA;
        const profile = profilesRes.find(p => p.user === otherUserId);
        const matchedUserObj = profile?.expand?.user || (m.userA === user.id ? m.expand?.userB : m.expand?.userA);
        return {
          profile: profile || {},
          user: matchedUserObj,
          matchId: m.id,
          status: m.status || 'active',
          unmatchedBy: m.unmatchedBy,
        };
      });

      // Sort: active matches first, unmatched matches at the bottom
      matchedData.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return 0;
      });

      setMatches(matchedData);

      // Load chips data for matches
      loadUserChipsData(matchedUserIds);
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

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoadingProfile(true);
      await withMinimumDelay(async () => {
        await fetchProfile();
        if (activeTab === 'discover') await fetchDiscover();
        if (activeTab === 'matches') await fetchMatches();
      }, 400);
      setLoadingProfile(false);
    });
    return () => sub.remove();
  }, [user, activeTab, fetchProfile, fetchDiscover, fetchMatches]);

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

      formData.append('favorite_song', favoriteSong.trim());
      formData.append('favorite_book', favoriteBook.trim());
      formData.append('zodiac_sign', zodiacSign.trim());
      formData.append('favorite_drink', favoriteDrink.trim());
      formData.append('favorite_food', favoriteFood.trim());
      formData.append('favorite_subject', favoriteSubject.trim());
      formData.append('hobbies', hobbies.trim());

      // Send files in order (both existing files to keep and new files to upload)
      for (const ph of photosList) {
        if (ph.isLocal) {
          if (Platform.OS === 'web') {
            const response = await fetch(ph.uri);
            const rawBlob = await response.blob();
            const mime = rawBlob.type || 'image/jpeg';
            const rawFile = ph.file && ph.file instanceof File 
              ? ph.file 
              : new File([rawBlob], ph.file?.fileName || 'photo.jpg', { type: mime });
            
            try {
              const compressedBlob = await compressImage(rawFile, false, 'image/webp');
              formData.append('photos', compressedBlob, 'tinder_photo.webp');
            } catch (compressErr) {
              formData.append('photos', rawBlob, ph.file?.fileName || 'profile_tinder.jpg');
            }
          } else {
            formData.append('photos', {
              uri: ph.uri,
              name: ph.file?.fileName || 'profile_tinder.jpg',
              type: ph.file?.mimeType || 'image/jpeg',
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
    try {
      // 1. Mark match as unmatched (triggers backend hook to delete reciprocal likes)
      await tinderService.unmatch(matchId, user.id);

      Toast.show({
        type: 'success',
        text1: 'Match deshecho',
        text2: 'Se han eliminado los likes recíprocos de ambos usuarios.'
      });

      // Close modals
      setShowUnmatchConfirmModal(false);
      setShowMatchDetailModal(false);
      
      // Reload matches list so it displays as 'Match deshecho'
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
            // If inactive: show notice with button to configure profile tab
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
            <TinderDiscoverCard
              navigation={navigation}
              activeDiscoverProfile={activeDiscoverProfile}
              activeDiscoverUser={activeDiscoverUser}
              activePhotos={activePhotos}
              activePhotoIndex={activePhotoIndex}
              setActivePhotoIndex={setActivePhotoIndex}
              isCurrentlyLiked={isCurrentlyLiked}
              userLadderRanksMap={userLadderRanksMap}
              userSellerProfilesMap={userSellerProfilesMap}
              userMembershipsMap={userMembershipsMap}
              discoverCount={discoverProfiles.length}
              setCurrentIndex={setCurrentIndex}
              onToggleLike={handleToggleLike}
            />
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
              {matches.map((item, idx) => {
                const isUnmatched = item.status === 'unmatched';
                return (
                  <TouchableOpacity 
                    key={idx}
                    style={[styles.matchCard, isUnmatched && { opacity: 0.6, borderColor: 'rgba(255,255,255,0.05)' }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedMatch(item);
                      setShowMatchDetailModal(true);
                    }}
                  >
                    <Avatar user={item.user} size={50} />
                    <View style={styles.matchCardBody}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.matchCardName, isUnmatched && { color: theme.colors.textMuted }]}>
                          {item.user?.name || 'Usuario'}
                        </Text>
                        {isUnmatched && (
                          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ color: '#f87171', fontSize: 10, fontWeight: '700' }}>Match deshecho</Text>
                          </View>
                        )}
                      </View>
                      {!!item.user?.username && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (item.user?.id) {
                              navigation.navigate('UserProfile', { userId: item.user.id });
                            }
                          }}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          <Text style={styles.matchCardUsername}>@{item.user.username}</Text>
                        </TouchableOpacity>
                      )}
                      <Text style={styles.matchCardDesc} numberOfLines={1}>
                        {isUnmatched ? 'Este match fue deshecho' : (item.profile?.description || 'Sin descripción')}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
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
      {activeTab === 'profile' && !profile && !loadingProfile && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Feather name="alert-circle" size={48} color={theme.colors.error} />
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
            No se pudo cargar tu perfil de Tinder Beauchef
          </Text>
          <TouchableOpacity style={[styles.refreshBtn, { marginTop: 16 }]} onPress={fetchProfile}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'profile' && profile && (
        <ScrollView style={styles.profileTabContainer} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

          {/* Guidelines box when inactive */}
          {!profile.isActive && (
            <TinderRulesPanel savingProfile={savingProfile} onActivate={() => handleToggleActive(true)} />
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
                
                {user && (
                  <View style={{ marginVertical: 6, alignItems: 'flex-start' }}>
                    <UserChipsRow
                      user={user}
                      memberships={userMembershipsMap[user.id] || []}
                      ladderRanks={userLadderRanksMap[user.id] || []}
                      sellerProfile={userSellerProfilesMap[user.id]}
                      align="left"
                    />
                  </View>
                )}

                {/* Previsualización de detalles opcionales */}
                <TinderExtraDetails
                  profile={{
                    favorite_song: favoriteSong,
                    favorite_book: favoriteBook,
                    zodiac_sign: zodiacSign,
                    favorite_drink: favoriteDrink,
                    favorite_food: favoriteFood,
                    favorite_subject: favoriteSubject,
                    hobbies,
                  }}
                />

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

            {/* Contacto */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Contacto</Text>
            
            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Instagram</Text>
              <View style={styles.contactInputWrapper}>
                <FontAwesome name="instagram" size={18} color="#E1306C" style={styles.contactIconInside} />
                <Text style={styles.atBadgeText}>@</Text>
                <TextInput
                  style={styles.contactInputInside}
                  placeholder="tu_usuario"
                  placeholderTextColor={theme.colors.textMuted}
                  value={instagram.replace(/^@+/, '')}
                  onChangeText={(text) => setInstagram(text.replace(/^@+/, ''))}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>WhatsApp</Text>
              <View style={styles.contactInputWrapper}>
                <FontAwesome name="whatsapp" size={18} color="#25D366" style={styles.contactIconInside} />
                <TextInput
                  style={styles.contactInputInside}
                  placeholder="+56912345678"
                  placeholderTextColor={theme.colors.textMuted}
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Telegram</Text>
              <View style={styles.contactInputWrapper}>
                <FontAwesome name="paper-plane" size={16} color="#0088cc" style={styles.contactIconInside} />
                <Text style={styles.atBadgeText}>@</Text>
                <TextInput
                  style={styles.contactInputInside}
                  placeholder="tu_usuario"
                  placeholderTextColor={theme.colors.textMuted}
                  value={telegram.replace(/^@+/, '')}
                  onChangeText={(text) => setTelegram(text.replace(/^@+/, ''))}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Signal</Text>
              <View style={styles.contactInputWrapper}>
                <Feather name="message-square" size={18} color="#3a76f0" style={styles.contactIconInside} />
                <Text style={styles.atBadgeText}>@</Text>
                <TextInput
                  style={styles.contactInputInside}
                  placeholder="tu_usuario"
                  placeholderTextColor={theme.colors.textMuted}
                  value={signal.replace(/^@+/, '')}
                  onChangeText={(text) => setSignal(text.replace(/^@+/, ''))}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Gustos Personales */}
            <Text style={[styles.fieldLabel, { marginTop: 24 }]}>Gustos Personales</Text>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Canción Favorita</Text>
              <View style={styles.contactInputWrapper}>
                <TextInput
                  style={styles.contactInputInside}
                  placeholder=""
                  placeholderTextColor={theme.colors.textMuted}
                  value={favoriteSong}
                  onChangeText={setFavoriteSong}
                />
              </View>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Libro Favorito</Text>
              <View style={styles.contactInputWrapper}>
                <TextInput
                  style={styles.contactInputInside}
                  placeholder=""
                  placeholderTextColor={theme.colors.textMuted}
                  value={favoriteBook}
                  onChangeText={setFavoriteBook}
                />
              </View>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Signo Zodiacal</Text>
              <View style={styles.contactInputWrapper}>
                <select
                  value={zodiacSign}
                  onChange={(e) => setZodiacSign(e.target.value)}
                  style={{
                    flex: 1,
                    width: '100%',
                    padding: '10px 0',
                    backgroundColor: 'transparent',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Selecciona tu signo...</option>
                  <option value="Aries">Aries</option>
                  <option value="Tauro">Tauro</option>
                  <option value="Géminis">Géminis</option>
                  <option value="Cáncer">Cáncer</option>
                  <option value="Leo">Leo</option>
                  <option value="Virgo">Virgo</option>
                  <option value="Libra">Libra</option>
                  <option value="Escorpio">Escorpio</option>
                  <option value="Sagitario">Sagitario</option>
                  <option value="Capricornio">Capricornio</option>
                  <option value="Acuario">Acuario</option>
                  <option value="Piscis">Piscis</option>
                </select>
              </View>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Bebida Favorita</Text>
              <View style={styles.contactInputWrapper}>
                <TextInput
                  style={styles.contactInputInside}
                  placeholder=""
                  placeholderTextColor={theme.colors.textMuted}
                  value={favoriteDrink}
                  onChangeText={setFavoriteDrink}
                />
              </View>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Comida Favorita</Text>
              <View style={styles.contactInputWrapper}>
                <TextInput
                  style={styles.contactInputInside}
                  placeholder=""
                  placeholderTextColor={theme.colors.textMuted}
                  value={favoriteFood}
                  onChangeText={setFavoriteFood}
                />
              </View>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Ramo Favorito</Text>
              <View style={styles.contactInputWrapper}>
                <TextInput
                  style={styles.contactInputInside}
                  placeholder=""
                  placeholderTextColor={theme.colors.textMuted}
                  value={favoriteSubject}
                  onChangeText={setFavoriteSubject}
                />
              </View>
            </View>

            <View style={styles.contactRow}>
              <Text style={styles.contactLabelText}>Pasatiempos</Text>
              <View style={styles.contactInputWrapper}>
                <TextInput
                  style={styles.contactInputInside}
                  placeholder=""
                  placeholderTextColor={theme.colors.textMuted}
                  value={hobbies}
                  onChangeText={setHobbies}
                />
              </View>
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

          {/* Activation switch box at the bottom (shows deactivate button when active) */}
          {profile.isActive && (
            <View style={[styles.activationStatusBox, styles.activationStatusBoxActive, { marginTop: theme.spacing.lg }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activationStatusTitle}>🟢 Tinder Beauchef Activo</Text>
                <Text style={styles.activationStatusDesc}>
                  Tu perfil es visible para otros estudiantes de la facultad en la sección Descubrir.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.statusToggleBtn, styles.statusToggleBtnDeactivate, lockoutHoursLeft !== null && { opacity: 0.5 }]}
                onPress={() => handleToggleActive(false)}
                disabled={savingProfile || lockoutHoursLeft !== null}
              >
                <Text style={styles.statusToggleBtnText}>
                  {lockoutHoursLeft !== null ? `Bloqueado (${lockoutHoursLeft}h)` : 'Desactivar'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* --- RECIPIENT MATCH SWIPE MODAL (OVERLAY POPUP) --- */}
      {showMatchModal && (
        <TinderMatchModal
          currentUser={user}
          matchUser={matchUser}
          matchProfile={matchProfile}
          matchPhotoIndex={matchPhotoIndex}
          setMatchPhotoIndex={setMatchPhotoIndex}
          userLadderRanksMap={userLadderRanksMap}
          userSellerProfilesMap={userSellerProfilesMap}
          userMembershipsMap={userMembershipsMap}
          onOpenSocialLink={openSocialLink}
          onNavigateToUser={(userId) => {
            setShowMatchModal(false);
            navigation.navigate('UserProfile', { userId });
          }}
          onClose={() => {
            setShowMatchModal(false);
            setMatchUser(null);
            setMatchProfile(null);
            // Also trigger a matches reload so they see it in the other tab
            fetchMatches();
          }}
        />
      )}

      {/* --- MATCH DETAIL MODAL (LIST POPUP) --- */}
      {showMatchDetailModal && selectedMatch && (
        <TinderMatchDetailModal
          selectedMatch={selectedMatch}
          detailPhotoIndex={detailPhotoIndex}
          setDetailPhotoIndex={setDetailPhotoIndex}
          userLadderRanksMap={userLadderRanksMap}
          userSellerProfilesMap={userSellerProfilesMap}
          userMembershipsMap={userMembershipsMap}
          onOpenSocialLink={openSocialLink}
          onNavigateToUser={(userId) => {
            setShowMatchDetailModal(false);
            navigation.navigate('UserProfile', { userId });
          }}
          onClose={() => setShowMatchDetailModal(false)}
          onUnmatch={handleUnmatch}
        />
      )}

      {/* --- CUSTOM UNMATCH CONFIRMATION MODAL --- */}
      {showUnmatchConfirmModal && selectedMatch && (
        <TinderUnmatchConfirmModal
          selectedMatch={selectedMatch}
          onCancel={() => setShowUnmatchConfirmModal(false)}
          onConfirm={() => performUnmatch(unmatchMatchId)}
        />
      )}
    </View>
  );
};
