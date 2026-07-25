import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
} from 'react-native';
import { theme } from '../../theme/theme';
import { Feather } from '@expo/vector-icons';
import { marketplaceService, CATEGORIES, MarketplaceItemRecord } from '../../services/marketplaceService';
import { compressImage } from '../../utils/imageCompressor';
import Toast from 'react-native-toast-message';

interface Props {
  visible: boolean;
  onSuccess: (newItem: MarketplaceItemRecord) => void;
  onClose: () => void;
}

export const MarketplaceItemEditorModal: React.FC<Props> = ({
  visible,
  onSuccess,
  onClose,
}) => {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('comida');
  const [description, setDescription] = useState('');

  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setPrice('');
      setCategory('comida');
      setDescription('');
      setTagInput('');
      setTags([]);
      setSelectedFiles([]);
      setPreviews([]);
    }
  }, [visible]);

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

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
        text2: `${newItem.title} ya está disponible en el Marketplace.`,
      });

      onSuccess(newItem);
      onClose();
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
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Publicar Producto / Servicio</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 24 }}>
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
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Categoría *</Text>
                  <select
                    style={{
                      backgroundColor: theme.colors.background,
                      borderRadius: 8,
                      padding: 10,
                      color: theme.colors.text,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      fontSize: 13,
                      marginTop: 4,
                      width: '100%',
                      outline: 'none',
                      cursor: 'pointer',
                    } as any}
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                      <option key={c.id} value={c.id} style={{ backgroundColor: '#0c0c0c', color: '#ffffff' }}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </View>

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

              {/* Sub-tags manuales */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Sub-tags manuales (opcional)</Text>
                <Text style={styles.helpText}>Escribe etiquetas para facilitar la búsqueda (ej: vegano, apuntes)</Text>
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={tagInput}
                    onChangeText={setTagInput}
                    placeholder="Ej: vegano"
                    placeholderTextColor={theme.colors.textMuted}
                    onSubmitEditing={handleAddTag}
                  />
                  <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
                    <Text style={styles.addTagBtnText}>+ Agregar</Text>
                  </TouchableOpacity>
                </View>

                {tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {tags.map((t) => (
                      <View key={t} style={styles.tagBadge}>
                        <Text style={styles.tagBadgeText}>#{t}</Text>
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
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.publishBtnText}>Publicar Producto</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  keyboardView: {
    width: '100%',
  },
  content: {
    backgroundColor: '#0c0c0c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#222222',
    maxHeight: '90%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  formScroll: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 14,
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
