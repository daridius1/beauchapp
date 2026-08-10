import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Platform, ScrollView, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { Feather } from '@expo/vector-icons';
import { compressImage } from '../utils/imageCompressor';
import Toast from 'react-native-toast-message';
import { OrgChip } from '../components/OrgChip';
import { UserChipsRow, YEARS_LIST, DEPARTMENTS_LIST } from '../components/UserChipsRow';
import { SocialInput } from '../components/SocialInput';
import { SportIcon } from '../components/SportIcon';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Configuración de Chip para Organizaciones
  const [chipText, setChipText] = useState(user?.chip_text || '');
  const [chipColor, setChipColor] = useState(user?.chip_color || '#38bdf8');

  // Insignias / Pins para Estudiantes
  const [entryYear, setEntryYear] = useState(user?.entry_year || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [showKarmaOnProfile, setShowKarmaOnProfile] = useState(Boolean(user?.show_karma_on_profile));
  const [showBeautokensOnProfile, setShowBeautokensOnProfile] = useState(Boolean(user?.show_beautokens_on_profile));
  const [showBeaudleStreakOnProfile, setShowBeaudleStreakOnProfile] = useState(Boolean(user?.show_beaudle_streak_on_profile));

  // Biografía / Descripción del Perfil Principal
  const [description, setDescription] = useState(user?.description || '');

  // Redes Sociales y Sitio Web
  const [instagram, setInstagram] = useState(user?.instagram || '');
  const [telegram, setTelegram] = useState(user?.telegram || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [signal, setSignal] = useState(user?.signal || '');
  const [website, setWebsite] = useState(user?.website || '');

  // Ladder Ranks individuales con toggle por deporte
  const [myLadderRanks, setMyLadderRanks] = useState<any[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id) {
      loadMyLadderRanks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadMyLadderRanks = async () => {
    if (!user) return;
    try {
      const res = await pb.collection('ladder_ranks').getList(1, 20, {
        filter: `user = "${user.id}"`,
        expand: 'ladder'
      });
      setMyLadderRanks(res.items.map(item => ({
        ...item,
        show_on_profile: Boolean(item.show_on_profile)
      })));
    } catch (e) {
      console.warn('Error cargando ranks de ladders en edición de perfil:', e);
    }
  };

  const toggleLadderVisibility = (rankId: string) => {
    setMyLadderRanks(prev => prev.map(r => {
      if (r.id === rankId) {
        return { ...r, show_on_profile: !r.show_on_profile };
      }
      return r;
    }));
  };

  if (!user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Toast.show({
        type: 'error',
        text1: 'Archivo inválido',
        text2: 'Solo se permiten archivos de imagen.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const compressedBlob = await compressImage(file, true, 'image/jpeg');
      const compressedFile = new File(
        [compressedBlob],
        file.name.replace(/\.[^/.]+$/, "") + ".jpg",
        { type: 'image/jpeg' }
      );

      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(URL.createObjectURL(compressedFile));
      setAvatarFile(compressedFile);
    } catch (err) {
      console.error('Error procesando la imagen:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo procesar la imagen seleccionada.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Campo requerido',
        text2: 'El nombre no puede estar vacío.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());

      if (user.type === 'organization') {
        formData.append('chip_text', chipText.trim());
        formData.append('chip_color', chipColor.trim());
      } else {
        formData.append('entry_year', entryYear.trim());
        formData.append('department', department.trim());
        formData.append('show_karma_on_profile', String(showKarmaOnProfile));
        formData.append('show_beautokens_on_profile', String(showBeautokensOnProfile));
        formData.append('show_beaudle_streak_on_profile', String(showBeaudleStreakOnProfile));
      }

      formData.append('description', description.trim());
      formData.append('instagram', instagram.replace(/^@+/, '').trim());
      formData.append('telegram', telegram.replace(/^@+/, '').trim());
      formData.append('whatsapp', whatsapp.trim());
      formData.append('signal', signal.replace(/^@+/, '').trim());
      formData.append('website', website.trim());

      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      await pb.collection('users').update(user.id, formData);

      // Actualizar visibilidad individual de cada ladder rank (en paralelo, son independientes entre sí)
      const rankUpdates = await Promise.allSettled(
        myLadderRanks.map((rank) =>
          pb.collection('ladder_ranks').update(rank.id, {
            show_on_profile: Boolean(rank.show_on_profile)
          })
        )
      );
      rankUpdates.forEach((res, i) => {
        if (res.status === 'rejected') {
          console.error('Error guardando visibilidad de ladder rank:', myLadderRanks[i].id, res.reason);
        }
      });

      await pb.collection('users').authRefresh();

      Toast.show({
        type: 'success',
        text1: 'Perfil actualizado',
        text2: 'Tus cambios han sido guardados exitosamente.',
      });

      navigation.goBack();
    } catch (err: any) {
      console.error('Error al guardar el perfil:', err);
      Toast.show({
        type: 'error',
        text1: 'Error al guardar',
        text2: err.message || 'No se pudieron guardar los cambios.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const triggerFileSelect = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Picker de Avatar */}
      <View style={styles.avatarPickerContainer}>
        <TouchableOpacity
          style={styles.avatarPickerTouch}
          onPress={triggerFileSelect}
          disabled={isSaving}
        >
          <View style={styles.avatarContainer}>
            {avatarPreview ? (
              <Image source={{ uri: avatarPreview }} style={{ width: 100, height: 100, borderRadius: 50 }} />
            ) : (
              <Avatar user={user} size={100} />
            )}
          </View>
          <View style={styles.cameraOverlay}>
            <Feather name="camera" size={15} color="#000000" />
          </View>
        </TouchableOpacity>

        {Platform.OS === 'web' && (
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        )}
      </View>

      {/* Inputs */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Nombre público</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ingresa tu nombre..."
          placeholderTextColor={theme.colors.textMuted}
          maxLength={40}
          editable={!isSaving}
        />
      </View>

      {/* Configuración de Chip / Badge personalizada para organizaciones */}
      {user.type === 'organization' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Texto de la Insignia (Chip)</Text>
            <TextInput
              style={styles.input}
              value={chipText}
              onChangeText={setChipText}
              placeholder={`Por defecto: ${name || user.username}`}
              placeholderTextColor={theme.colors.textMuted}
              maxLength={25}
              editable={!isSaving}
            />
            <Text style={styles.helpText}>Texto corto que aparecerá en los perfiles de tus integrantes</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Color de la Insignia</Text>
            <View style={styles.colorPaletteRow}>
              {['#38bdf8', '#ff4444', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#ffffff'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    chipColor === color && styles.colorCircleSelected,
                  ]}
                  onPress={() => setChipColor(color)}
                />
              ))}
            </View>
          </View>

          {/* Previsualización del Chip */}
          <View style={styles.previewBox}>
            <Text style={styles.inputLabel}>Vista Previa:</Text>
            <OrgChip
              organization={{
                ...user,
                chip_text: chipText,
                chip_color: chipColor,
              }}
            />
          </View>
        </>
      )}

      {/* Selección de Insignias / Pins para Estudiantes */}
      {user.type === 'student' && (
        <>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: theme.spacing.md }}>
            {/* Pin 1: Generación - Dropdown */}
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Generación</Text>
              <select
                style={{
                  backgroundColor: theme.colors.background,
                  borderRadius: 8,
                  padding: 10,
                  color: theme.colors.text,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  fontSize: 14,
                  marginTop: 6,
                  width: '100%',
                  outline: 'none',
                  cursor: 'pointer',
                } as any}
                value={entryYear}
                onChange={(e: any) => setEntryYear(e.target.value)}
              >
                <option value="" style={{ backgroundColor: '#0c0c0c', color: theme.colors.textMuted }}>
                  -- Sin generación --
                </option>
                {YEARS_LIST.map((yr) => (
                  <option key={yr} value={yr} style={{ backgroundColor: '#0c0c0c', color: '#ffffff' }}>
                    Gen {yr}
                  </option>
                ))}
              </select>
            </View>

            {/* Pin 2: Especialidad - Dropdown */}
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Especialidad</Text>
              <select
                style={{
                  backgroundColor: theme.colors.background,
                  borderRadius: 8,
                  padding: 10,
                  color: theme.colors.text,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  fontSize: 14,
                  marginTop: 6,
                  width: '100%',
                  outline: 'none',
                  cursor: 'pointer',
                } as any}
                value={department}
                onChange={(e: any) => setDepartment(e.target.value)}
              >
                <option value="" style={{ backgroundColor: '#0c0c0c', color: theme.colors.textMuted }}>
                  -- Sin especialidad --
                </option>
                {DEPARTMENTS_LIST.map((dept) => (
                  <option key={dept.code} value={dept.code} style={{ backgroundColor: '#0c0c0c', color: '#ffffff' }}>
                    {dept.code} - {dept.label}
                  </option>
                ))}
              </select>
            </View>
          </View>

          {/* Ladders: Karma, BeauTokens y Racha de Beaudle son "ladders" para efectos de
              la insignia de perfil, igual que cada deporte — todos viven juntos acá con
              su propio toggle de visibilidad. */}
          <View style={[styles.section, { marginTop: theme.spacing.md }]}>
            <Text style={[styles.inputLabel, { fontSize: 14, color: theme.colors.text, marginBottom: 2 }]}>
              Ladders
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 10 }}>
              Elige qué insignias de ladder quieres mostrar en tu perfil.
            </Text>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
              onPress={() => setShowKarmaOnProfile(!showKarmaOnProfile)}
              activeOpacity={0.7}
            >
              <Feather name={showKarmaOnProfile ? "check-square" : "square"} size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                Karma
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
              onPress={() => setShowBeautokensOnProfile(!showBeautokensOnProfile)}
              activeOpacity={0.7}
            >
              <Feather name={showBeautokensOnProfile ? "check-square" : "square"} size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                BeauTokens
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
              onPress={() => setShowBeaudleStreakOnProfile(!showBeaudleStreakOnProfile)}
              activeOpacity={0.7}
            >
              <Feather name={showBeaudleStreakOnProfile ? "check-square" : "square"} size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                Racha de Beaudle
              </Text>
            </TouchableOpacity>

            {myLadderRanks.map((rank) => {
              const sportName = rank.expand?.ladder?.name || rank.expand?.sport?.name || rank.sportKey || '';
              const sportSlug = rank.expand?.ladder?.slug || rank.sportKey || '';
              const mode = rank.mode || '1v1';
              const is2v2 = mode.includes('2v2');
              const eloVal = Math.round(rank.ordinal_rating || rank.rating || rank.points || 1200);
              return (
                <TouchableOpacity
                  key={rank.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
                  onPress={() => toggleLadderVisibility(rank.id)}
                  activeOpacity={0.7}
                >
                  <Feather name={rank.show_on_profile ? "check-square" : "square"} size={18} color={theme.colors.primary} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <SportIcon name={sportName} slug={sportSlug} size={15} color={theme.colors.text} />
                    {is2v2 && <Feather name="users" size={13} color={theme.colors.textMuted} />}
                  </View>
                  <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                    {sportName ? `${sportName} ${mode}` : 'Ladder'} ({eloVal})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Previsualización de Pins */}
          <View style={styles.previewBox}>
            <Text style={styles.inputLabel}>Insignias en tu perfil:</Text>
            <UserChipsRow
              user={{
                ...user,
                entry_year: entryYear,
                department: department,
                show_karma_on_profile: showKarmaOnProfile,
                show_beautokens_on_profile: showBeautokensOnProfile,
                show_beaudle_streak_on_profile: showBeaudleStreakOnProfile,
                instagram,
                telegram,
                whatsapp,
                signal,
              }}
              ladderRanks={myLadderRanks}
            />
          </View>
        </>
      )}

      {/* Biografía / Descripción del Perfil */}
      <View style={styles.section}>
        <Text style={[styles.inputLabel, { fontSize: 14, color: theme.colors.text, marginBottom: 2 }]}>
          Biografía / Descripción
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 8 }}>
          Una breve presentación sobre ti para mostrar en tu perfil principal.
        </Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Escribe una pequeña descripción o frase sobre ti..."
          placeholderTextColor={theme.colors.textMuted}
          multiline
          numberOfLines={3}
          maxLength={300}
        />
      </View>

      {/* Redes Sociales (Aparecen automáticamente en el perfil si no están vacías) */}
      <View style={styles.section}>
        <Text style={[styles.inputLabel, { fontSize: 14, color: theme.colors.text, marginBottom: 2 }]}>
          Redes Sociales
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 12 }}>
          Las redes que ingreses aparecerán automáticamente como chips en tu perfil.
        </Text>

        <SocialInput
          label="Instagram"
          type="instagram"
          value={instagram}
          onChangeText={setInstagram}
          placeholder="tu_usuario"
        />
        <SocialInput
          label="WhatsApp"
          type="whatsapp"
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="+56912345678"
          showAtPrefix={false}
          keyboardType="phone-pad"
        />
        <SocialInput
          label="Telegram"
          type="telegram"
          value={telegram}
          onChangeText={setTelegram}
          placeholder="tu_usuario"
        />
        <SocialInput
          label="Signal"
          type="signal"
          value={signal}
          onChangeText={setSignal}
          placeholder="tu_usuario"
          showAtPrefix={true}
        />
        <SocialInput
          label="Página Web"
          type="website"
          value={website}
          onChangeText={setWebsite}
          placeholder="https://tuweb.cl"
          showAtPrefix={false}
          keyboardType="url"
        />
      </View>

      {/* Acciones */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnCancel]}
          onPress={handleCancel}
          disabled={isSaving}
        >
          <Text style={styles.btnCancelText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnSave]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={styles.btnSaveText}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>
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
  avatarPickerContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  avatarPickerTouch: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0c0c0c',
    zIndex: 10,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  helpText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: theme.spacing.sm,
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
  section: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  // Caja liviana solo para las previsualizaciones (chip/insignias) — no es una "card" de
  // navegación, es más bien un recuadro de referencia, se mantiene sutil a propósito.
  previewBox: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  btnCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  btnCancelText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  btnSave: {
    backgroundColor: theme.colors.primary,
  },
  btnSaveText: {
    color: '#000000',
    fontWeight: '700',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
    transform: [{ scale: 1.15 }],
  },
});
