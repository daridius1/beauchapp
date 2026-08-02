import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { activityService } from '../services/activityService';
import { ImagePicker } from '../components/ImagePicker';
import { DateTimePickerModal } from '../components/DateTimePickerModal';

const CATEGORIES = [
  'Académico',
  'Deportes',
  'Social',
  'Charla',
  'Asamblea',
  'Taller',
  'Cultura',
  'Otro',
];

export const ActivityEditorScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [category, setCategory] = useState('Académico');
  const [price, setPrice] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [banner, setBanner] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Modales de Selección de Fecha y Hora (Blanco y Negro Minimalista)
  const [pickerModal, setPickerModal] = useState<{
    visible: boolean;
    mode: 'date' | 'time';
    field: 'date' | 'startTime' | 'endTime';
    title: string;
  }>({
    visible: false,
    mode: 'date',
    field: 'date',
    title: '',
  });

  useEffect(() => {
    if (banner) {
      const url = URL.createObjectURL(banner);
      setBannerPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBannerPreview(null);
    }
  }, [banner]);

  const handleSave = async () => {
    if (!title.trim()) {
      Toast.show({ type: 'error', text1: 'Campo Requerido', text2: 'Ingresa el título de la actividad.' });
      return;
    }
    if (!location.trim()) {
      Toast.show({ type: 'error', text1: 'Campo Requerido', text2: 'Ingresa el lugar de la actividad.' });
      return;
    }
    if (!date.trim() || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Toast.show({ type: 'error', text1: 'Fecha Inválida', text2: 'Formato de fecha requerido: AAAA-MM-DD' });
      return;
    }
    if (!startTime.trim() || !endTime.trim()) {
      Toast.show({ type: 'error', text1: 'Horario Requerido', text2: 'Ingresa la hora de inicio y término.' });
      return;
    }

    if (!user || user.type !== 'organization') {
      Toast.show({ type: 'error', text1: 'Acceso Denegado', text2: 'Solo cuentas de organización pueden publicar actividades.' });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('organization', user.id);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('location', location.trim());
      formData.append('date', date.trim());
      formData.append('start_time', startTime.trim());
      formData.append('end_time', endTime.trim());
      formData.append('category', category);
      formData.append('price', price.trim());
      formData.append('external_link', externalLink.trim());

      if (banner) {
        formData.append('banner', banner);
      }

      const created = await activityService.createActivity(formData);

      Toast.show({
        type: 'success',
        text1: '¡Actividad Publicada!',
        text2: 'Tu actividad se ha agregado al calendario.',
      });

      navigation.replace('ActivityDetail', { activityId: created.id });
    } catch (err: any) {
      console.error('Error al crear actividad:', err);
      Toast.show({
        type: 'error',
        text1: 'Error al Guardar',
        text2: err.message || 'No se pudo crear la actividad.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openPicker = (field: 'date' | 'startTime' | 'endTime') => {
    if (field === 'date') {
      setPickerModal({
        visible: true,
        mode: 'date',
        field: 'date',
        title: 'Seleccionar Fecha',
      });
    } else if (field === 'startTime') {
      setPickerModal({
        visible: true,
        mode: 'time',
        field: 'startTime',
        title: 'Hora de Inicio',
      });
    } else {
      setPickerModal({
        visible: true,
        mode: 'time',
        field: 'endTime',
        title: 'Hora de Término',
      });
    }
  };

  const handlePickerConfirm = (selectedVal: string) => {
    if (pickerModal.field === 'date') {
      setDate(selectedVal);
    } else if (pickerModal.field === 'startTime') {
      setStartTime(selectedVal);
    } else if (pickerModal.field === 'endTime') {
      setEndTime(selectedVal);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={styles.screenTitle}>Nueva Actividad</Text>
      <Text style={styles.screenSubtitle}>Publica un evento en el calendario oficial de Beauchapp</Text>

      {/* Título */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Título de la Actividad *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ej. Torneo de Tenis de Mesa CEI"
          placeholderTextColor="#666666"
        />
      </View>

      {/* Ubicación */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Ubicación *</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Ej. Hall Sur CEI, Zócalo FEI..."
          placeholderTextColor="#666666"
        />
      </View>

      {/* Fecha (Selector Modal Blanco y Negro) */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Fecha *</Text>
        <TouchableOpacity
          style={styles.pickerSelectorBtn}
          activeOpacity={0.8}
          onPress={() => openPicker('date')}
        >
          <Feather name="calendar" size={16} color={theme.colors.primary} />
          <Text style={styles.pickerSelectorText}>{date || 'Seleccionar Fecha'}</Text>
          <Feather name="chevron-down" size={16} color={theme.colors.textMuted} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      </View>

      {/* Horario (Inicio y Término) */}
      <View style={styles.rowTwoCols}>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Hora Inicio *</Text>
          <TouchableOpacity
            style={styles.pickerSelectorBtn}
            activeOpacity={0.8}
            onPress={() => openPicker('startTime')}
          >
            <Feather name="clock" size={16} color={theme.colors.primary} />
            <Text style={styles.pickerSelectorText}>{startTime || 'Seleccionar'}</Text>
            <Feather name="chevron-down" size={16} color={theme.colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Hora Término *</Text>
          <TouchableOpacity
            style={styles.pickerSelectorBtn}
            activeOpacity={0.8}
            onPress={() => openPicker('endTime')}
          >
            <Feather name="clock" size={16} color={theme.colors.primary} />
            <Text style={styles.pickerSelectorText}>{endTime || 'Seleccionar'}</Text>
            <Feather name="chevron-down" size={16} color={theme.colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Categoría */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Categoría</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextSelected]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Precio / Entrada */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Precio / Entrada (Opcional)</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="Ej. Gratis, $1.000, Adhesión voluntaria"
          placeholderTextColor="#666666"
        />
      </View>

      {/* Enlace Externo */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Enlace Externo / Formulario (Opcional)</Text>
        <TextInput
          style={styles.input}
          value={externalLink}
          onChangeText={setExternalLink}
          placeholder="https://forms.gle/..."
          placeholderTextColor="#666666"
          autoCapitalize="none"
        />
      </View>

      {/* Afiche / Imagen de Portada */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Imagen de Portada / Afiche (Opcional)</Text>
        
        {bannerPreview ? (
          <View style={styles.bannerPreviewWrapper}>
            <Image source={{ uri: bannerPreview }} style={styles.bannerPreviewImage} resizeMode="contain" />
            <TouchableOpacity
              style={styles.removeBannerBtn}
              onPress={() => setBanner(null)}
            >
              <Feather name="x" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          <ImagePicker value={banner} onImageReady={(img) => setBanner(img)} />
        )}
      </View>

      {/* Descripción en Texto Plano */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Descripción / Detalles</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe la actividad, requisitos, temáticas..."
          placeholderTextColor="#666666"
          multiline
        />
      </View>

      {/* Botón Publicar */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
        onPress={handleSave}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <>
            <Feather name="check" size={18} color="#000000" />
            <Text style={styles.submitBtnText}>Publicar Actividad</Text>
          </>
        )}
      </TouchableOpacity>

      {/* DateTimePickerModal Personalizado */}
      <DateTimePickerModal
        visible={pickerModal.visible}
        mode={pickerModal.mode}
        title={pickerModal.title}
        value={
          pickerModal.field === 'date'
            ? date
            : pickerModal.field === 'startTime'
            ? startTime
            : endTime
        }
        onConfirm={handlePickerConfirm}
        onClose={() => setPickerModal(prev => ({ ...prev, visible: false }))}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a3a3a3',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  pickerSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  pickerSelectorText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
  },
  categoryChipSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  categoryChipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  bannerPreviewWrapper: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: '#000000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  bannerPreviewImage: {
    width: '100%',
    height: '100%',
  },
  removeBannerBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  submitBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
});
