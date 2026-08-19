import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { pb, getFileUrl } from '../services/pocketbase';
import { teamPlayersService, TeamPlayerRecord } from '../services/teamPlayersService';
import { TeamCrest, matchDisplayName } from '../components/leagues/TeamCrest';
import { ImagePicker } from '../components/ImagePicker';
import { ContentActionsMenu } from '../components/ContentActionsMenu';
import { ConfirmExitModal } from '../components/ConfirmExitModal';
import { Avatar } from '../components/Avatar';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { EXAMPLE_PLAYER_PHOTO } from '../assets/examplePlayerPhoto';
import { EXAMPLE_TEAM_CREST } from '../assets/exampleTeamCrest';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'EditTeam'>;

export const EditTeamScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  // Escudo/nombre — misma lógica que tenía el bloque removido de EditProfileScreen:
  // webp (no jpeg) porque un escudo suele necesitar fondo transparente.
  const [matchAlias, setMatchAlias] = useState(user?.matchAlias || '');
  const [crestFile, setCrestFile] = useState<File | null>(null);
  const [crestPreview, setCrestPreview] = useState<string | null>(null);
  const [savingCrest, setSavingCrest] = useState(false);
  const [showCrestModal, setShowCrestModal] = useState(false);

  // Roster
  const [players, setPlayers] = useState<TeamPlayerRecord[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [linkableMembers, setLinkableMembers] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState<TeamPlayerRecord | null>(null);

  // Crear jugador — modal chico, solo pide el nombre. Agregar foto/vincular cuenta se
  // hace después, editando (evita pedir todo de una en el momento menos oportuno,
  // cuando lo único que hace falta para convocar a alguien es su nombre).
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creatingPlayer, setCreatingPlayer] = useState(false);

  // Editar jugador — acá sí se puede tocar todo (nombre, foto, cuenta vinculada).
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<TeamPlayerRecord | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [formUserId, setFormUserId] = useState<string | null>(null);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [showMemberSelector, setShowMemberSelector] = useState(false);

  const loadRoster = useCallback(async () => {
    if (!user) return;
    setLoadingPlayers(true);
    try {
      const [playersRes, linkableRes] = await Promise.all([
        teamPlayersService.listTeamPlayers(user.id),
        teamPlayersService.listLinkableMembers(user.id),
      ]);
      setPlayers(playersRes);
      setLinkableMembers(linkableRes);
    } finally {
      setLoadingPlayers(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadRoster();
    }, [loadRoster])
  );

  // El escudo no se recorta a cuadrado: a diferencia de una cara, un escudo puede venir
  // en cualquier proporción (más alto que ancho, o al revés) y sigue siendo válido — se
  // guarda y se muestra tal cual, con "contain" (fit), nunca recortado.
  const handleCrestPhotoReady = (file: File | null) => {
    setCrestFile(file);
    if (crestPreview) URL.revokeObjectURL(crestPreview);
    setCrestPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSaveCrest = async () => {
    if (!user) return;
    setSavingCrest(true);
    try {
      const formData = new FormData();
      formData.append('matchAlias', matchAlias.trim());
      if (crestFile) formData.append('matchPhoto', crestFile);
      await pb.collection('users').update(user.id, formData);
      await pb.collection('users').authRefresh();
      Toast.show({ type: 'success', text1: 'Escudo y nombre actualizados' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error al guardar', text2: err.message || 'No se pudo guardar.' });
    } finally {
      setSavingCrest(false);
    }
  };

  // Al elegir una foto nueva, se guarda tanto el File (para mandar al servidor) como
  // una preview local (object URL) — sin esto el picker no mostraba nada, solo el ícono
  // de adjuntar quedaba atenuado.
  const handleFormPhotoReady = (file: File | null) => {
    setFormPhoto(file);
    if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview);
    setFormPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const openCreatePlayer = () => {
    setCreateName('');
    setShowCreateModal(true);
  };
  const closeCreateModal = () => {
    setShowCreateModal(false);
  };
  const handleCreatePlayer = async () => {
    if (!user || !createName.trim()) return;
    setCreatingPlayer(true);
    try {
      await teamPlayersService.createTeamPlayer(user.id, { name: createName });
      setShowCreateModal(false);
      await loadRoster();
      Toast.show({ type: 'success', text1: 'Jugador agregado' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'No se pudo agregar al jugador.' });
    } finally {
      setCreatingPlayer(false);
    }
  };

  const openEditPlayer = (p: TeamPlayerRecord) => {
    setEditingPlayer(p);
    setFormName(p.name);
    setFormPhoto(null);
    setFormPhotoPreview(null);
    setFormUserId(p.user || null);
    setShowEditModal(true);
  };
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingPlayer(null);
  };

  const handleSavePlayer = async () => {
    if (!editingPlayer || !formName.trim()) return;
    setSavingPlayer(true);
    try {
      await teamPlayersService.updateTeamPlayer(editingPlayer.id, {
        name: formName,
        photo: formPhoto,
        userId: formUserId,
      });
      Toast.show({ type: 'success', text1: 'Jugador actualizado' });
      closeEditModal();
      await loadRoster();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'No se pudo guardar el jugador.' });
    } finally {
      setSavingPlayer(false);
    }
  };

  const confirmDeletePlayerAction = async () => {
    if (!confirmDeletePlayer) return;
    const id = confirmDeletePlayer.id;
    setConfirmDeletePlayer(null);
    setDeletingId(id);
    try {
      await teamPlayersService.softDeleteTeamPlayer(id);
      await loadRoster();
      Toast.show({ type: 'info', text1: 'Jugador eliminado' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message || 'No se pudo eliminar al jugador.' });
    } finally {
      setDeletingId(null);
    }
  };

  // Candidatos del selector de "vincular cuenta": los integrantes vinculables, más el
  // que ya está vinculado al jugador que se está editando (si no, desaparecería de la
  // lista apenas se abre el selector, porque `listLinkableMembers` excluye a quien ya
  // está vinculado a ALGÚN jugador).
  const currentLinkedMember = editingPlayer?.expand?.user;
  const memberOptions =
    currentLinkedMember && !linkableMembers.some((m) => m.id === currentLinkedMember.id)
      ? [currentLinkedMember, ...linkableMembers]
      : linkableMembers;
  const selectedMember = memberOptions.find((m) => m.id === formUserId) || null;
  const hasAnyPhoto = !!(formPhotoPreview || editingPlayer?.photo);

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Escudo y nombre */}
      <Text style={styles.sectionTitle}>Escudo y nombre</Text>
      <View style={styles.crestRow}>
        <TouchableOpacity onPress={() => setShowCrestModal(true)} style={styles.crestTouch}>
          {crestPreview ? (
            <Image source={{ uri: crestPreview }} style={styles.crestImg} resizeMode="contain" />
          ) : (
            <TeamCrest team={{ ...user, matchAlias }} size={64} />
          )}
          <View style={styles.cameraOverlay}>
            <Feather name="camera" size={12} color="#000000" />
          </View>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={matchAlias}
          onChangeText={setMatchAlias}
          placeholder="Nombre del equipo..."
          placeholderTextColor={theme.colors.textMuted}
          maxLength={40}
        />
        <TouchableOpacity
          style={[styles.btn, styles.btnSave]}
          onPress={handleSaveCrest}
          disabled={savingCrest}
        >
          {savingCrest ? <ActivityIndicator size="small" color="#000000" /> : <Text style={styles.btnSaveText}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      {/* Roster */}
      <View style={styles.rosterHeaderRow}>
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Jugadores</Text>
        <TouchableOpacity style={styles.addPlayerBtn} onPress={openCreatePlayer}>
          <Feather name="plus" size={14} color="#000000" style={{ marginRight: 4 }} />
          <Text style={styles.addPlayerBtnText}>Agregar jugador</Text>
        </TouchableOpacity>
      </View>

      {loadingPlayers ? (
        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />
      ) : players.length === 0 ? (
        <Text style={styles.emptyText}>Todavía no agregaste jugadores.</Text>
      ) : (
        players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <PlayerAvatar player={{ id: p.id, collectionId: 'team_players', photo: p.photo }} size={36} />
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{p.name}</Text>
              {!!p.expand?.user && (
                <Text style={styles.playerLinked}>Vinculado a @{p.expand.user.username}</Text>
              )}
            </View>
            {deletingId === p.id ? (
              <ActivityIndicator size="small" color={theme.colors.danger} style={{ padding: 8 }} />
            ) : (
              <ContentActionsMenu
                actions={[
                  { key: 'edit', icon: 'edit-2', label: 'Editar jugador', onPress: () => openEditPlayer(p) },
                  { key: 'delete', icon: 'trash-2', label: 'Eliminar jugador', destructive: true, onPress: () => setConfirmDeletePlayer(p) },
                ]}
              />
            )}
          </View>
        ))
      )}

      {/* Modal del escudo — a diferencia de la foto de jugador, nunca se recorta a
          cuadrado: un escudo puede ser más alto que ancho (o al revés) y sigue siendo
          válido, se guarda y se muestra tal cual con "contain" (fit), nunca recortado. */}
      <Modal visible={showCrestModal} transparent animationType="fade" onRequestClose={() => setShowCrestModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Escudo del equipo</Text>

            <Text style={[styles.photoStandardText, { marginTop: theme.spacing.sm }]}>
              El escudo debe tener fondo transparente. No hace falta que sea cuadrado — si
              es más alto que ancho (o al revés) se muestra completo igual, nunca se
              recorta. Sí importa el margen: que la figura ocupe casi todo el archivo,
              bien centrada, sin un borde vacío grande alrededor.
            </Text>

            <View style={styles.photoExampleRow}>
              <View style={styles.crestPreviewBox}>
                <Image source={{ uri: EXAMPLE_TEAM_CREST }} style={styles.crestPreviewImg} resizeMode="contain" />
              </View>
              <Text style={styles.photoExampleLabel}>Ejemplo</Text>
            </View>

            <View style={styles.photoPickerRow}>
              <View style={[styles.crestPreviewBox, !crestPreview && !user.matchPhoto && styles.crestPreviewBoxPlaceholder]}>
                {crestPreview ? (
                  <Image source={{ uri: crestPreview }} style={styles.crestPreviewImg} resizeMode="contain" />
                ) : user.matchPhoto ? (
                  <Image source={{ uri: getFileUrl(user, user.matchPhoto, '100x100') }} style={styles.crestPreviewImg} resizeMode="contain" />
                ) : (
                  <Feather name="shield" size={24} color="#8a8a8a" />
                )}
              </View>
              <ImagePicker onImageReady={handleCrestPhotoReady} value={crestFile} format="image/png" />
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave, { flex: 1 }]}
                onPress={() => setShowCrestModal(false)}
              >
                <Text style={styles.btnSaveText}>Listo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de crear jugador — solo el nombre; foto y cuenta vinculada se agregan
          después, editando. */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={closeCreateModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Agregar jugador</Text>

            <Text style={[styles.inputLabel, { marginTop: theme.spacing.sm }]}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={createName}
              onChangeText={setCreateName}
              placeholder="Nombre del jugador..."
              placeholderTextColor={theme.colors.textMuted}
              maxLength={60}
              autoFocus
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeCreateModal} disabled={creatingPlayer}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave, { flex: 1 }, (creatingPlayer || !createName.trim()) && styles.btnDisabled]}
                onPress={handleCreatePlayer}
                disabled={creatingPlayer || !createName.trim()}
              >
                {creatingPlayer ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.btnSaveText}>Agregar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de editar jugador — acá sí se puede tocar todo. */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={closeEditModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Editar jugador</Text>

            <Text style={[styles.inputLabel, { marginTop: theme.spacing.sm }]}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder="Nombre del jugador..."
              placeholderTextColor={theme.colors.textMuted}
              maxLength={60}
            />

            <Text style={[styles.inputLabel, { marginTop: theme.spacing.sm }]}>Foto (opcional)</Text>
            <Text style={styles.photoStandardText}>
              Tiene que ser la cara recortada, con fondo transparente — no cualquier foto de perfil.
            </Text>
            <View style={styles.photoExampleRow}>
              <View style={styles.photoPreviewCircle}>
                <Image source={{ uri: EXAMPLE_PLAYER_PHOTO }} style={styles.photoPreviewImg} resizeMode="cover" />
              </View>
              <Text style={styles.photoExampleLabel}>Ejemplo</Text>
            </View>
            <View style={styles.photoPickerRow}>
              <View style={[styles.photoPreviewCircle, !hasAnyPhoto && styles.photoPreviewCirclePlaceholder]}>
                {formPhotoPreview ? (
                  <Image source={{ uri: formPhotoPreview }} style={styles.photoPreviewImg} />
                ) : editingPlayer?.photo ? (
                  <Image source={{ uri: getFileUrl(editingPlayer, editingPlayer.photo, '100x100') }} style={styles.photoPreviewImg} />
                ) : (
                  <Feather name="user" size={22} color="#8a8a8a" />
                )}
              </View>
              <ImagePicker onImageReady={handleFormPhotoReady} value={formPhoto} format="image/png" cropToSquare />
            </View>
            <TouchableOpacity
              style={styles.recorteFacialBtn}
              activeOpacity={0.8}
              onPress={() => Linking.openURL('https://daridius.cl/aplicaciones/recorte-facial/')}
            >
              <Feather name="scissors" size={14} color="#000000" style={{ marginRight: 8 }} />
              <Text style={styles.recorteFacialBtnText}>Recortar una foto de perfil normal a este estándar</Text>
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { marginTop: theme.spacing.sm }]}>Vincular a un integrante (opcional)</Text>
            <TouchableOpacity style={styles.memberSelectorBtn} onPress={() => setShowMemberSelector(true)}>
              {selectedMember ? (
                <View style={styles.memberSelectorSelected}>
                  <Avatar user={selectedMember} size={24} />
                  <Text style={styles.memberSelectorSelectedText} numberOfLines={1}>
                    {matchDisplayName(selectedMember, selectedMember.username)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.memberSelectorPlaceholder}>Ninguno</Text>
              )}
              <Feather name="chevron-down" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={closeEditModal} disabled={savingPlayer}>
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave, { flex: 1 }, (savingPlayer || !formName.trim()) && styles.btnDisabled]}
                onPress={handleSavePlayer}
                disabled={savingPlayer || !formName.trim()}
              >
                {savingPlayer ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.btnSaveText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Selector de integrante a vincular — bottom sheet, no chips */}
      <Modal visible={showMemberSelector} transparent animationType="slide" onRequestClose={() => setShowMemberSelector(false)}>
        <View style={styles.selectorOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMemberSelector(false)} />
          <View style={styles.selectorSheet}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorHeaderTitle}>Vincular a un integrante</Text>
              <TouchableOpacity onPress={() => setShowMemberSelector(false)}>
                <Feather name="x" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.selectorList}>
              <TouchableOpacity
                style={styles.selectorRow}
                onPress={() => { setFormUserId(null); setShowMemberSelector(false); }}
              >
                <Feather name="minus" size={16} color={theme.colors.textMuted} style={{ marginRight: 10 }} />
                <Text style={styles.selectorRowText}>Ninguno</Text>
              </TouchableOpacity>
              {memberOptions.length === 0 ? (
                <Text style={styles.emptyText}>No hay integrantes disponibles para vincular.</Text>
              ) : (
                memberOptions.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.selectorRow}
                    onPress={() => { setFormUserId(m.id); setShowMemberSelector(false); }}
                  >
                    <Avatar user={m} size={28} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.selectorRowText}>{matchDisplayName(m, m.username)}</Text>
                      {!!m.username && <Text style={styles.selectorRowSub}>@{m.username}</Text>}
                    </View>
                    {formUserId === m.id && <Feather name="check" size={16} color={theme.colors.primary} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Advertencia antes de eliminar (soft-delete) — el jugador desaparece del roster
          pero sus goles/tarjetas ya registrados en partidos siguen existiendo. */}
      <ConfirmExitModal
        visible={!!confirmDeletePlayer}
        title="¿Eliminar jugador?"
        message={
          confirmDeletePlayer
            ? `"${confirmDeletePlayer.name}" ya no se va a poder convocar a partidos nuevos. Sus goles, tarjetas y penales ya registrados no se borran.`
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDeletePlayerAction}
        onCancel={() => setConfirmDeletePlayer(null)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  crestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  crestTouch: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  crestImg: {
    width: 64,
    height: 64,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0c0c0c',
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 15,
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: theme.spacing.md,
  },
  rosterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xl,
  },
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  addPlayerBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  playerLinked: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  btnSave: {
    backgroundColor: theme.colors.primary,
  },
  btnSaveText: {
    color: '#000000',
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.cardBg,
    borderRadius: 14,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  photoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  // Muestra la foto ya recortada en círculo — así se ve exactamente como va a
  // aparecer en el roster/arbitraje, no solo el ícono de "adjuntar".
  photoPreviewCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Sin foto todavía: mismo criterio que <PlayerAvatar> — fondo transparente de
  // verdad (no una caja sólida) y borde punteado, para que se note que es un
  // placeholder y no una foto real con fondo transparente.
  photoPreviewCirclePlaceholder: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  photoPreviewImg: {
    width: '100%',
    height: '100%',
  },
  // A diferencia de photoPreviewCircle (cara, recortada a círculo con "cover"): un
  // escudo nunca se recorta ni se fuerza a círculo — caja cuadrada con "contain" (fit),
  // centrada, para que se vea completo sea cual sea su proporción real.
  crestPreviewBox: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crestPreviewBoxPlaceholder: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  crestPreviewImg: {
    width: '100%',
    height: '100%',
  },
  photoStandardText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: theme.spacing.xs,
  },
  photoExampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  photoExampleLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  recorteFacialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: theme.spacing.sm,
  },
  recorteFacialBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  memberSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
  },
  memberSelectorSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  memberSelectorSelectedText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  memberSelectorPlaceholder: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.lg,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalCancelBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  selectorSheet: {
    backgroundColor: '#0c0c0c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#222222',
    borderBottomWidth: 0,
    maxHeight: '75%',
    minHeight: 200,
    paddingTop: 16,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  selectorHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  selectorList: {
    maxHeight: 380,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  selectorRowText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectorRowSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
});
