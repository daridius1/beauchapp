import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Feather } from '@expo/vector-icons';
import { marketplaceService, CATEGORIES, MarketplaceItemRecord } from '../services/marketplaceService';
import { compressImage } from '../utils/imageCompressor';
import { SelectorModal } from '../components/SelectorModal';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'MarketplaceItemEditor'>;

export const MarketplaceItemEditorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user: currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('comida');
  const [description, setDescription] = useState('');

  const [tags, setTags] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>(['vegano', 'apuntes', 'calculo', 'brownies', 'tallaM', 'usado', 'nuevo', 'oficial']);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);



  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedFiles.length + files.length > 5) {
      Toast.show({
        type: 'error',
        text1: 'Límite de fotos',
        text2: 'Puedes subir hasta 5 fotos por producto.',
      });
      return;
    }

    setCompressing(true);
    try {
      const newFiles: File[] = [];
      const newPreviews: string[] = [];

      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const compressedBlob = await compressImage(file);
        const compressedFile = new File(
          [compressedBlob],
          file.name.replace(/\.[^/.]+$/, '') + '.webp',
          { type: 'image/webp' }
        );
        newFiles.push(compressedFile);
        newPreviews.push(URL.createObjectURL(compressedFile));
      }

      setSelectedFiles([...selectedFiles, ...newFiles]);
      setPreviews([...previews, ...newPreviews]);
    } catch (err) {
      console.error('Error compressing item images:', err);
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const updatedFiles = [...selectedFiles];
    const updatedPreviews = [...previews];
    URL.revokeObjectURL(updatedPreviews[index]);
    updatedFiles.splice(index, 1);
    updatedPreviews.splice(index, 1);
    setSelectedFiles(updatedFiles);
    setPreviews(updatedPreviews);
  };

  const handlePublish = async () => {
    if (!currentUser) {
      Toast.show({
        type: 'error',
        text1: 'Autenticación requerida',
        text2: 'Debes iniciar sesión para publicar en el Marketplace.',
      });
      return;
    }

    if (!title.trim()) {
      Toast.show({ type: 'error', text1: 'Título requerido', text2: 'Ingresa un título para tu producto.' });
      return;
    }

    const priceNum = parseInt(price.replace(/[^0-9]/g, ''), 10);
    if (isNaN(priceNum) || priceNum < 0) {
      Toast.show({ type: 'error', text1: 'Precio inválido', text2: 'Ingresa un precio válido en CLP.' });
      return;
    }

    if (!description.trim()) {
      Toast.show({ type: 'error', text1: 'Descripción requerida', text2: 'Ingresa una descripción para tu producto.' });
      return;
    }

    setPublishing(true);
    try {
      const newItem = await marketplaceService.createItem(
        {
          title: title.trim(),
          description: description.trim(),
          price: priceNum,
          category,
          tags,
        },
        selectedFiles
      );

      Toast.show({
        type: 'success',
        text1: '¡Producto Publicado!',
        text2: `${newItem.title} ya está disponible en tu tienda y el Marketplace.`,
      });

      // Redirigir directamente a la vista de la tienda del vendedor
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Marketplace');
      }
    } catch (err: any) {
      console.error('Error creating marketplace item:', err);
      Toast.show({
        type: 'error',
        text1: 'Error al publicar',
        text2: err.message || 'No se pudo publicar el producto.',
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Formulario */}
        <View style={styles.formCard}>
          {/* Fotos del producto */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Fotos del producto (hasta 5)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <View style={styles.imagesRow}>
                {previews.map((uri, idx) => (
                  <View key={idx} style={styles.imagePreviewContainer}>
                    <Image source={{ uri }} style={styles.previewImage} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => handleRemoveImage(idx)}>
                      <Feather name="x" size={12} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ))}

                {previews.length < 5 && (
                  <TouchableOpacity
                    style={styles.addImageBtn}
                    onPress={() => fileInputRef.current?.click()}
                    disabled={compressing}
                  >
                    {compressing ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <>
                        <Feather name="camera" size={20} color={theme.colors.textMuted} />
                        <Text style={styles.addImageText}>+ Foto</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {Platform.OS === 'web' && (
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFilesSelect}
              />
            )}
          </View>

          {/* Título */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Título del Producto *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: Polerón Beauchef Talla M, Brownie Vegano..."
              placeholderTextColor={theme.colors.textMuted}
              maxLength={80}
            />
          </View>

          {/* Categoría Principal & Precio */}
          <View style={styles.rowTwo}>
            <TouchableOpacity
              onPress={() => setShowCategoryModal(true)}
              style={[styles.inputGroup, { flex: 1 }]}
            >
              <Text style={styles.inputLabel}>Categoría *</Text>
              <View style={{ pointerEvents: 'none' }}>
                <TextInput
                  style={styles.input}
                  value={CATEGORIES.find((c) => c.id === category)?.label || 'Comida'}
                  editable={false}
                />
              </View>
            </TouchableOpacity>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Precio (CLP $) *</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="Ej: 5000"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Etiquetas (opcional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Etiquetas (opcional)</Text>
            <Text style={styles.helpText}>Selecciona o escribe etiquetas para facilitar la búsqueda</Text>
            <TouchableOpacity
              style={styles.addTagBtn}
              onPress={() => setShowTagModal(true)}
            >
              <Feather name="plus" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.addTagBtnText}>Agregar Etiqueta</Text>
            </TouchableOpacity>

            {tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {tags.map((t) => (
                  <View key={t} style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>{t}</Text>
                    <TouchableOpacity onPress={() => handleRemoveTag(t)}>
                      <Feather name="x" size={12} color="#888888" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Descripción */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Descripción del producto *</Text>
            <TextInput
              style={[styles.input, { height: 90 }]}
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="Detalla estado del producto, ingredientes, horarios de entrega o modalidad de clase..."
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {/* Botón Publicar */}
          <TouchableOpacity
            style={[styles.publishBtn, publishing && styles.disabled]}
            onPress={handlePublish}
            disabled={publishing}
          >
            {publishing ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text style={styles.publishBtnText}>Publicar Producto</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modales de Selección con Búsqueda de Texto (Estándar de la Plataforma) */}
      <SelectorModal
        visible={showCategoryModal}
        title="Seleccionar Categoría"
        placeholder="Buscar categoría..."
        suggestions={CATEGORIES.filter((c) => c.id !== 'all').map((c) => c.label)}
        allowCustom={false}
        onSelect={(label) => {
          const matched = CATEGORIES.find((c) => c.label.toLowerCase() === label.toLowerCase());
          if (matched) setCategory(matched.id);
        }}
        onClose={() => setShowCategoryModal(false)}
      />

      <SelectorModal
        visible={showTagModal}
        title="Agregar Etiqueta"
        placeholder="Buscar o escribir etiqueta..."
        suggestions={tagSuggestions}
        allowCustom={true}
        onSelect={(tagVal) => {
          const clean = tagVal.trim().replace(/^#/, '');
          if (clean && !tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
            setTags([...tags, clean]);
            if (!tagSuggestions.some((t) => t.toLowerCase() === clean.toLowerCase())) {
              setTagSuggestions([...tagSuggestions, clean]);
            }
          }
        }}
        onClose={() => setShowTagModal(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  formCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: 16,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  helpText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 13,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  imagePreviewContainer: {
    position: 'relative',
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 3,
  },
  addImageBtn: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  addImageText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addTagBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addTagBtnText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagBadgeText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  publishBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  publishBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
});
