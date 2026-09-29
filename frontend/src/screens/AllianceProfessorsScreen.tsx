import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  DeviceEventEmitter,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { AllianceNameText } from '../components/AllianceNameText';
import { ALLIANCES, AllianceId } from '../constants/alliances';
import {
  AllianceProfessor,
  allianceService,
  ProfessorClaimFilter,
  ProfessorGalleryItem,
  ProfessorGameState,
} from '../services/allianceService';
import { getFileUrl } from '../services/pocketbase';
import { compressImage, compressImageNative } from '../utils/imageCompressor';
import { withMinimumDelay } from '../utils/refresh';
import { theme } from '../theme/theme';

const ALLIANCE_COLORS: Record<AllianceId, string> = {
  urbana: '#f59e0b',
  pop: '#ec4899',
  gotico: '#a78bfa',
  hiphop: '#22c55e',
  punk: '#ef4444',
  rock: '#38bdf8',
};

const allianceLabel = (id: AllianceId) => ALLIANCES.find((item) => item.id === id)?.label || id;

const errorMessage = (error: any, fallback: string) => (
  error?.response?.error || error?.message || fallback
);

export const AllianceProfessorsScreen: React.FC = () => {
  const { height: windowHeight } = useWindowDimensions();
  const [state, setState] = useState<ProfessorGameState | null>(null);
  const [items, setItems] = useState<AllianceProfessor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProfessorClaimFilter>('available');
  const [pending, setPending] = useState<{ professor: AllianceProfessor; asset: ExpoImagePicker.ImagePickerAsset } | null>(null);
  const [viewingClaim, setViewingClaim] = useState<ProfessorGalleryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (showLoader = true, nextPage = 1) => {
    if (showLoader) setLoading(true);
    try {
      const result = await withMinimumDelay(
        () => allianceService.getProfessorGame(nextPage, query, filter),
        showLoader ? 400 : 0,
      );
      setState(result);
      setItems((current) => nextPage === 1 ? result.items : [...current, ...result.items]);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No se pudo cargar Cazaprofes', text2: errorMessage(error, '') });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => { load(true, 1); }, [load]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('onGlobalRefresh', () => load(true, 1));
    return () => subscription.remove();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(false, 1);
    setRefreshing(false);
  };

  const pickPhoto = async (professor: AllianceProfessor) => {
    if (Platform.OS !== 'web') {
      const permission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Toast.show({ type: 'error', text1: 'Permiso requerido', text2: 'Se necesita acceso a tus fotos para subir la evidencia.' });
        return;
      }
    }
    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) setPending({ professor, asset: result.assets[0] });
  };

  const submitClaim = async () => {
    if (!pending || submitting) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      const asset = pending.asset;
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const source = asset.file instanceof File
          ? asset.file
          : new File([blob], asset.fileName || 'profesor.jpg', { type: blob.type || 'image/jpeg' });
        const compressed = await compressImage(source, false, 'image/jpeg');
        formData.append('photo', compressed, 'profesor.jpg');
      } else {
        const compressed = await compressImageNative(asset.uri, asset.width, asset.height, false, 'image/jpeg');
        formData.append('photo', { uri: compressed.uri, name: 'profesor.jpg', type: 'image/jpeg' } as any);
      }
      await allianceService.claimProfessor(pending.professor.id, formData);
      setPending(null);
      Toast.show({ type: 'success', text1: '¡Profesor adjudicado!', text2: `La foto suma un punto para ${allianceLabel(state!.myAlliance!)}.` });
      await load(false, 1);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No se pudo adjudicar', text2: errorMessage(error, 'Intenta nuevamente.') });
      await load(false, 1);
    } finally {
      setSubmitting(false);
    }
  };

  const loadMore = async () => {
    if (!state || state.page >= state.totalPages || loadingMore) return;
    setLoadingMore(true);
    await load(false, state.page + 1);
    setLoadingMore(false);
  };

  const topCount = useMemo(() => state?.scoreboard[0]?.professors || 0, [state]);

  if (loading && !state) {
    return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (!state) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No se pudo cargar el juego.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => load(true, 1)}><Text style={styles.primaryButtonText}>Reintentar</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
      >
        {!state.myAlliance ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Primero elige tu alianza</Text>
            <Text style={styles.muted}>La elección se hace en la pantalla principal de Alianzas y se usa en todos sus juegos.</Text>
          </View>
        ) : (
          <View style={styles.myAllianceRow}>
            <Text style={styles.muted}>Estás jugando por</Text>
            <AllianceNameText alliance={state.myAlliance} style={[styles.myAlliance, { color: ALLIANCE_COLORS[state.myAlliance] }]} />
          </View>
        )}

        {state.gallery.length > 0 && (
          <View style={styles.gallerySection}>
            <Text style={styles.sectionTitle}>Últimos profes adjudicados</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={144}
              decelerationRate="fast"
              contentContainerStyle={styles.galleryContent}
            >
              {state.gallery.map((item) => (
                <View key={item.claim.id} style={styles.galleryCard}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setViewingClaim(item)}
                    accessibilityLabel={`Ampliar foto de ${item.name}`}
                  >
                    <Image
                      source={{
                        uri: getFileUrl(
                          { collectionId: state.claimCollectionId, id: item.claim.id },
                          item.claim.photo,
                          '100x100',
                        ),
                      }}
                      style={styles.galleryPhoto}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  <Text style={styles.galleryName} numberOfLines={2}>{item.name}</Text>
                  <AllianceNameText
                    alliance={item.claim.alliance}
                    style={[styles.galleryAlliance, { color: ALLIANCE_COLORS[item.claim.alliance] }]}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Marcador</Text>
          {state.scoreboard.map((row, index) => (
            <View key={row.alliance} style={styles.scoreRow}>
              <Text style={styles.position}>{index + 1}</Text>
              <View style={[styles.colorMark, { backgroundColor: ALLIANCE_COLORS[row.alliance] }]} />
              <AllianceNameText alliance={row.alliance} style={styles.scoreName} />
              <Text style={[styles.scoreValue, row.professors === topCount && topCount > 0 && { color: ALLIANCE_COLORS[row.alliance] }]}>
                {row.professors} {row.professors === 1 ? 'profe' : 'profes'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.searchRow}>
          <Feather name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={queryInput}
            onChangeText={setQueryInput}
            onSubmitEditing={() => setQuery(queryInput)}
            placeholder="Buscar profesor o profesora"
            placeholderTextColor={theme.colors.textMuted}
            returnKeyType="search"
          />
          {!!queryInput && (
            <TouchableOpacity onPress={() => { setQueryInput(''); setQuery(''); }}>
              <Feather name="x" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filters}>
          {([
            ['available', 'Disponibles'],
            ['claimed', 'Adjudicados'],
            ['all', 'Todos'],
          ] as [ProfessorClaimFilter, string][]).map(([value, label]) => (
            <TouchableOpacity key={value} style={[styles.filter, filter === value && styles.filterActive]} onPress={() => setFilter(value)}>
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.resultCount}>{state.total} {state.total === 1 ? 'resultado' : 'resultados'}</Text>
        {items.map((professor) => (
          <View key={professor.id} style={styles.professorRow}>
            <View style={styles.professorCopy}>
              <Text style={styles.professorName}>{professor.name}</Text>
              <Text style={styles.departments}>{professor.departments.join(' · ') || 'FCFM'}</Text>
              {professor.claim && (
                <Text style={[styles.claimedBy, { color: ALLIANCE_COLORS[professor.claim.alliance] }]}>Adjudicado por {allianceLabel(professor.claim.alliance)}</Text>
              )}
            </View>
            {!professor.claim && state.myAlliance && (
              <TouchableOpacity style={styles.cameraButton} onPress={() => pickPhoto(professor)} accessibilityLabel={`Subir foto con ${professor.name}`}>
                <Feather name="camera" size={19} color={theme.colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {items.length === 0 && <Text style={styles.empty}>No hay profesores para este filtro.</Text>}
        {state.page < state.totalPages && (
          <TouchableOpacity style={styles.loadMore} onPress={loadMore} disabled={loadingMore}>
            {loadingMore ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.loadMoreText}>Cargar más</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => !submitting && setPending(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar adjudicación</Text>
            <Text style={styles.modalCopy}>
              {pending?.professor.name}. Al confirmar, quedará bloqueado para las demás alianzas.
            </Text>
            {!!pending && <Image source={{ uri: pending.asset.uri }} style={styles.preview} resizeMode="contain" />}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} disabled={submitting} onPress={() => setPending(null)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} disabled={submitting} onPress={submitClaim}>
                {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Confirmar foto</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewingClaim} transparent animationType="fade" onRequestClose={() => setViewingClaim(null)}>
        <View style={styles.photoModalBackdrop}>
          <View style={styles.photoModalCard}>
            <TouchableOpacity
              style={styles.photoModalClose}
              onPress={() => setViewingClaim(null)}
              accessibilityLabel="Cerrar foto ampliada"
            >
              <Feather name="x" size={24} color="#ffffff" />
            </TouchableOpacity>
            {!!viewingClaim && (
              <>
                <Image
                  source={{
                    uri: getFileUrl(
                      { collectionId: state.claimCollectionId, id: viewingClaim.claim.id },
                      viewingClaim.claim.photo,
                    ),
                  }}
                  style={[styles.expandedPhoto, { height: Math.min(560, windowHeight * 0.68) }]}
                  resizeMode="contain"
                />
                <Text style={styles.expandedPhotoName}>{viewingClaim.name}</Text>
                <AllianceNameText
                  alliance={viewingClaim.claim.alliance}
                  style={[styles.expandedPhotoAlliance, { color: ALLIANCE_COLORS[viewingClaim.claim.alliance] }]}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  muted: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  section: { borderTopWidth: 1, borderColor: theme.colors.border, paddingVertical: theme.spacing.lg },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  gallerySection: { borderTopWidth: 1, borderColor: theme.colors.border, paddingVertical: theme.spacing.lg },
  galleryContent: { gap: 12, paddingRight: theme.spacing.lg },
  galleryCard: { width: 132 },
  galleryPhoto: { width: 132, height: 112, borderRadius: 4, backgroundColor: theme.colors.cardBg },
  galleryName: { color: theme.colors.text, fontSize: 12, fontWeight: '700', lineHeight: 16, marginTop: 7 },
  galleryAlliance: { fontSize: 12, marginTop: 3 },
  myAllianceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: theme.colors.border, paddingVertical: theme.spacing.md },
  myAlliance: { fontSize: 16, fontWeight: '800' },
  scoreRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.colors.border },
  position: { color: theme.colors.textMuted, width: 24, fontSize: 12 },
  colorMark: { width: 4, height: 20, marginRight: 10, borderRadius: 2 },
  scoreName: { flex: 1, color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  scoreValue: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 12, marginTop: theme.spacing.md },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 14, paddingVertical: 11, outlineStyle: 'none' } as any,
  filters: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  filter: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  filterActive: { backgroundColor: theme.colors.text, borderColor: theme.colors.text },
  filterText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: theme.colors.background },
  resultCount: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 4 },
  professorRow: { flexDirection: 'row', alignItems: 'center', minHeight: 74, borderBottomWidth: 1, borderColor: theme.colors.border, paddingVertical: 9 },
  professorCopy: { flex: 1, paddingRight: 12 },
  professorName: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  departments: { color: theme.colors.textMuted, fontSize: 11, marginTop: 3 },
  claimedBy: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  cameraButton: { width: 40, height: 40, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 32 },
  loadMore: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, alignItems: 'center', paddingVertical: 11, marginTop: 16 },
  loadMoreText: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 480, backgroundColor: theme.colors.cardBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, padding: 18 },
  modalTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  modalCopy: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  preview: { width: '100%', height: 300, backgroundColor: theme.colors.background, marginTop: 14, borderRadius: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 16 },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  photoModalCard: { width: '100%', maxWidth: 760, alignItems: 'center' },
  photoModalClose: {
    alignSelf: 'flex-end',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  expandedPhoto: { width: '100%' },
  expandedPhotoName: { color: '#ffffff', fontSize: 17, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  expandedPhotoAlliance: { fontSize: 15, marginTop: 5 },
  primaryButton: { minHeight: 42, minWidth: 120, backgroundColor: theme.colors.primary, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  primaryButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 42, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  secondaryButtonText: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
});
