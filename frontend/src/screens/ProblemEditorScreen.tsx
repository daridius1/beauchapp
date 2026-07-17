import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import Toast from 'react-native-toast-message';
import { SelectorModal } from '../components/SelectorModal';
import * as ImagePicker from 'expo-image-picker';

type Props = NativeStackScreenProps<RootStackParamList, 'ProblemEditor'>;

interface EditorBlock {
  id: string;
  type: 'markdown' | 'image';
  value: string;
  uploading?: boolean;
  localUri?: string;
}

export const ProblemEditorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { type, problemId, problemTitle, initialContent } = route.params;
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => {
    const init = initialContent || '';
    if (init.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(init);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((b, i) => ({
            id: `init-${i}`,
            type: b.type,
            value: b.value
          }));
        }
      } catch (e) {}
    }
    return [{ id: 'init-1', type: 'markdown', value: init }];
  });
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [ramo, setRamo] = useState('');
  const [showRamoModal, setShowRamoModal] = useState(false);

  const [semestre, setSemestre] = useState('');
  const [showSemestreModal, setShowSemestreModal] = useState(false);

  const [instancia, setInstancia] = useState('');
  const [showInstanciaModal, setShowInstanciaModal] = useState(false);

  const [ramoSuggestions, setRamoSuggestions] = useState<string[]>([]);
  const [semestreSuggestions, setSemestreSuggestions] = useState<string[]>([]);
  const [instanciaSuggestions, setInstanciaSuggestions] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const records = await pb.collection('problems').getFullList({
          filter: 'parent = null',
          fields: 'ramo,semestre,instancia,tags',
        });
        const uniqueRamos = Array.from(new Set(records.map(r => r.ramo).filter(Boolean))) as string[];
        const uniqueSemestres = Array.from(new Set(records.map(r => r.semestre).filter(Boolean))) as string[];
        const uniqueInstancias = Array.from(new Set(records.map(r => r.instancia).filter(Boolean))) as string[];
        const uniqueTags = Array.from(new Set(records.flatMap(r => r.tags || []).filter(Boolean))) as string[];
        setRamoSuggestions(uniqueRamos);
        setSemestreSuggestions(uniqueSemestres);
        setInstanciaSuggestions(uniqueInstancias);
        setTagSuggestions(uniqueTags);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    };
    if (type === 'problem') {
      fetchSuggestions();
    }
  }, [type]);


  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const addBlock = (blockType: 'markdown' | 'image') => {
    const newBlock: EditorBlock = {
      id: Math.random().toString(36).substring(7),
      type: blockType,
      value: ''
    };
    setBlocks(prev => [...prev, newBlock]);
  };

  const removeBlock = (id: string) => {
    if (blocks.length === 1 && blocks[0].type === 'markdown') {
      updateBlockValue(blocks[0].id, '');
      return;
    }
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const updateBlockValue = (id: string, value: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, value } : b));
  };

  const pickImage = async (blockId: string) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Toast.show({
          type: 'error',
          text1: 'Permiso denegado',
          text2: 'Se necesitan permisos de galería para subir imágenes.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, uploading: true } : b));

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append('file', blob, asset.fileName || 'upload.png');
      } else {
        formData.append('file', {
          uri: asset.uri,
          name: asset.fileName || 'upload.png',
          type: asset.mimeType || 'image/png',
        } as any);
      }
      formData.append('author', user?.id || '');

      const record = await pb.collection('attachments').create(formData);
      const fileUrl = pb.files.getURL(record, record.file);

      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, value: fileUrl, uploading: false } : b));
    } catch (err) {
      console.error('Error uploading image:', err);
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, uploading: false } : b));
      Toast.show({
        type: 'error',
        text1: 'Error al subir',
        text2: 'No se pudo subir la imagen.',
      });
    }
  };

  // Algunos helpers para facilitar escribir Markdown y LaTeX rápidamente en el último bloque de texto enfocado
  const editorHelpers = [
    { label: 'Título', code: '\n# Título\n' },
    { label: 'Fórmula', code: ' $x^2$ ' },
    { label: 'Fracción', code: ' $\\frac{a}{b}$ ' },
    { label: 'Raíz', code: ' $\\sqrt{x}$ ' },
    { label: 'Negrita', code: ' **negrita** ' },
    { label: 'Lista', code: '\n- Elemento 1\n- Elemento 2\n' },
    { label: 'Diagrama', code: '\n\`\`\`mermaid\ngraph TD\n  A --> B\n\`\`\`\n' },
  ];

  const handleInsertHelper = (code: string) => {
    // Insertar en el primer bloque de texto disponible o crear uno
    const textBlocks = blocks.filter(b => b.type === 'markdown');
    if (textBlocks.length > 0) {
      const lastText = textBlocks[textBlocks.length - 1];
      updateBlockValue(lastText.id, lastText.value + code);
    } else {
      const newId = Math.random().toString(36).substring(7);
      setBlocks(prev => [...prev, { id: newId, type: 'markdown', value: code }]);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    
    if (!user) {
      Toast.show({
        type: 'error',
        text1: 'Sesión expirada',
        text2: 'Debes iniciar sesión para guardar.',
      });
      return;
    }

    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Título requerido',
        text2: 'Por favor ingresa un título para la publicación.',
      });
      return;
    }

    const nonCanceledBlocks = blocks.filter(b => b.type === 'markdown' ? b.value.trim() : b.value);
    if (nonCanceledBlocks.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Contenido vacío',
        text2: 'Por favor escribe el enunciado o sube una imagen.',
      });
      return;
    }

    if (blocks.some(b => b.uploading)) {
      Toast.show({
        type: 'error',
        text1: 'Subida en progreso',
        text2: 'Espera a que terminen de subirse las imágenes.',
      });
      return;
    }

    setSaving(true);
    try {
      const serializedContent = JSON.stringify(nonCanceledBlocks.map(b => ({ type: b.type, value: b.value })));
      
      if (type === 'problem') {
        await pb.collection('problems').create({
          title: title.trim(),
          content: serializedContent,
          tags: tags,
          ramo: ramo.trim().toUpperCase(),
          semestre: semestre.trim(),
          instancia: instancia.trim().toUpperCase(),
          author: user.id
        });
      } else {
        await pb.collection('problems').create({
          parent: problemId,
          title: title.trim(),
          content: serializedContent,
          author: user.id
        });
      }

      navigation.goBack();
    } catch (err) {
      console.error('Error saving:', err);
      let errorMsg = 'Ocurrió un error al guardar tu contenido.';
      if (err && typeof err === 'object') {
        const pocketbaseErr = err as any;
        if (pocketbaseErr.data) {
          const firstFieldErr = Object.values(pocketbaseErr.data)[0] as any;
          if (firstFieldErr && firstFieldErr.message) {
            errorMsg = firstFieldErr.message;
          }
        } else if (pocketbaseErr.message) {
          errorMsg = pocketbaseErr.message;
        }
      }
      Toast.show({
        type: 'error',
        text1: 'Error al guardar',
        text2: errorMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Selector de pestañas */}
      <View style={styles.tabHeader}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'edit' && styles.tabButtonActive]}
          onPress={() => setActiveTab('edit')}
        >
          <Feather name="edit-3" size={16} color={activeTab === 'edit' ? theme.colors.primary : theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'edit' && styles.tabTextActive]}>Editar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'preview' && styles.tabButtonActive]}
          onPress={() => setActiveTab('preview')}
        >
          <Feather name="eye" size={16} color={activeTab === 'preview' ? theme.colors.primary : theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'preview' && styles.tabTextActive]}>Previsualizar</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'edit' ? (
        <ScrollView style={styles.editorBody} contentContainerStyle={styles.editorContent}>
          {type === 'answer' && (
            <View style={styles.infoBanner}>
              <Feather name="info" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.infoBannerText} numberOfLines={1}>
                Respondiendo a: {problemTitle}
              </Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{type === 'problem' ? 'Título del Problema' : 'Título de la Pauta / Solución'}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={type === 'problem' ? "Ej. Criterio de la integral para series" : "Ej. Resolución con Teorema de Tales"}
              placeholderTextColor={theme.colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
          </View>

          {type === 'problem' && (
            <View>
              <View style={styles.academicFiltersRow}>
                {/* Ramo */}
                <TouchableOpacity 
                  onPress={() => {
                    if (ramo) {
                      setRamo('');
                    } else {
                      setShowRamoModal(true);
                    }
                  }}
                  style={[styles.inputGroup, { flex: 1, marginRight: theme.spacing.xs }]}
                >
                  <Text style={styles.inputLabel}>Ramo</Text>
                  <View pointerEvents="none">
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej. MA1001"
                      placeholderTextColor={theme.colors.textMuted}
                      value={ramo}
                      editable={false}
                    />
                  </View>
                </TouchableOpacity>

                {/* Semestre */}
                <TouchableOpacity 
                  onPress={() => {
                    if (semestre) {
                      setSemestre('');
                    } else {
                      setShowSemestreModal(true);
                    }
                  }}
                  style={[styles.inputGroup, { flex: 1, marginRight: theme.spacing.xs }]}
                >
                  <Text style={styles.inputLabel}>Semestre</Text>
                  <View pointerEvents="none">
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej. 2024-1"
                      placeholderTextColor={theme.colors.textMuted}
                      value={semestre}
                      editable={false}
                    />
                  </View>
                </TouchableOpacity>

                {/* Instancia */}
                <TouchableOpacity 
                  onPress={() => {
                    if (instancia) {
                      setInstancia('');
                    } else {
                      setShowInstanciaModal(true);
                    }
                  }}
                  style={[styles.inputGroup, { flex: 1 }]}
                >
                  <Text style={styles.inputLabel}>Instancia</Text>
                  <View pointerEvents="none">
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej. C1"
                      placeholderTextColor={theme.colors.textMuted}
                      value={instancia}
                      editable={false}
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Etiquetas (Junto a los otros filtros, pero debajo de la fila horizontal) */}
              <View style={[styles.inputGroup, { marginBottom: theme.spacing.md }]}>
                <Text style={styles.inputLabel}>Etiquetas</Text>
                <TouchableOpacity 
                  onPress={() => {
                    const specialCount = (ramo ? 1 : 0) + (semestre ? 1 : 0) + (instancia ? 1 : 0);
                    if (tags.length + specialCount < 10) {
                      setShowTagModal(true);
                    }
                  }}
                  style={{ marginTop: theme.spacing.xs }}
                  disabled={tags.length + ((ramo ? 1 : 0) + (semestre ? 1 : 0) + (instancia ? 1 : 0)) >= 10}
                >
                  <View pointerEvents="none">
                    <TextInput
                      style={styles.textInput}
                      placeholder={tags.length + ((ramo ? 1 : 0) + (semestre ? 1 : 0) + (instancia ? 1 : 0)) >= 10 ? "Límite de 10 etiquetas alcanzado" : "Seleccionar / Agregar etiqueta..."}
                      placeholderTextColor={theme.colors.textMuted}
                      value=""
                      editable={false}
                    />
                  </View>
                </TouchableOpacity>

                {/* Chips de etiquetas activas (renderizadas abajo) */}
                {tags.length > 0 && (
                  <View style={styles.activeTagsRow}>
                    {tags.map((t, i) => (
                      <TouchableOpacity key={i} onPress={() => removeTag(i)} style={styles.tagChipEditable}>
                        <Text style={styles.tagChipEditableText}>#{t} ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Modales de Selección */}
          <SelectorModal
            visible={showRamoModal}
            title="Seleccionar Ramo"
            placeholder="Buscar ramo (ej. MA1001)..."
            suggestions={ramoSuggestions}
            allowCustom={true}
            onSelect={(val) => {
              const valTrimmed = val.trim();
              const willBeSpecialCount = (valTrimmed ? 1 : 0) + (semestre ? 1 : 0) + (instancia ? 1 : 0);
              if (tags.length + willBeSpecialCount > 10) {
                Toast.show({
                  type: 'error',
                  text1: 'Límite de etiquetas',
                  text2: 'No puedes añadir este ramo. El total de etiquetas superaría el límite de 10.',
                });
                return;
              }
              setRamo(valTrimmed);
            }}
            onClose={() => setShowRamoModal(false)}
          />

          <SelectorModal
            visible={showSemestreModal}
            title="Seleccionar Semestre"
            placeholder="Buscar semestre (ej. 2024-1)..."
            suggestions={semestreSuggestions}
            allowCustom={true}
            onSelect={(val) => {
              const valTrimmed = val.trim();
              const willBeSpecialCount = (ramo ? 1 : 0) + (valTrimmed ? 1 : 0) + (instancia ? 1 : 0);
              if (tags.length + willBeSpecialCount > 10) {
                Toast.show({
                  type: 'error',
                  text1: 'Límite de etiquetas',
                  text2: 'No puedes añadir este semestre. El total de etiquetas superaría el límite de 10.',
                });
                return;
              }
              setSemestre(valTrimmed);
            }}
            onClose={() => setShowSemestreModal(false)}
          />

          <SelectorModal
            visible={showInstanciaModal}
            title="Seleccionar Instancia"
            placeholder="Buscar instancia (ej. C1)..."
            suggestions={instanciaSuggestions}
            allowCustom={true}
            onSelect={(val) => {
              const valTrimmed = val.trim();
              const willBeSpecialCount = (ramo ? 1 : 0) + (semestre ? 1 : 0) + (valTrimmed ? 1 : 0);
              if (tags.length + willBeSpecialCount > 10) {
                Toast.show({
                  type: 'error',
                  text1: 'Límite de etiquetas',
                  text2: 'No puedes añadir esta instancia. El total de etiquetas superaría el límite de 10.',
                });
                return;
              }
              setInstancia(valTrimmed);
            }}
            onClose={() => setShowInstanciaModal(false)}
          />

          {/* Renderizado de Bloques de Edición */}
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Text style={[styles.inputLabel, { marginBottom: theme.spacing.sm }]}>Contenido del Enunciado / Solución</Text>
            
            {blocks.map((block, index) => {
              if (block.type === 'markdown') {
                return (
                  <View key={block.id} style={styles.blockContainer}>
                    <View style={styles.blockHeader}>
                      <Text style={styles.blockTitle}>Bloque de Texto #{index + 1}</Text>
                      {blocks.length > 1 && (
                        <TouchableOpacity onPress={() => removeBlock(block.id)} style={styles.deleteBlockBtn}>
                          <Feather name="trash-2" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={styles.blockTextArea}
                      placeholder="Escribe el enunciado aquí en Markdown y LaTeX..."
                      placeholderTextColor={theme.colors.textMuted}
                      multiline
                      value={block.value}
                      onChangeText={(text) => updateBlockValue(block.id, text)}
                      textAlignVertical="top"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                );
              } else {
                return (
                  <View key={block.id} style={styles.blockContainer}>
                    <View style={styles.blockHeader}>
                      <Text style={styles.blockTitle}>Bloque de Imagen #{index + 1}</Text>
                      <TouchableOpacity onPress={() => removeBlock(block.id)} style={styles.deleteBlockBtn}>
                        <Feather name="trash-2" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    
                    {block.uploading ? (
                      <View style={styles.imagePlaceholder}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={styles.imagePlaceholderText}>Subiendo a Cloudflare...</Text>
                      </View>
                    ) : block.value ? (
                      <View style={styles.imageWrapper}>
                        <Image source={{ uri: block.value }} style={styles.imagePreview} resizeMode="contain" />
                        <TouchableOpacity onPress={() => pickImage(block.id)} style={styles.changeImageBtn}>
                          <Feather name="edit" size={14} color="#000000" style={{ marginRight: 4 }} />
                          <Text style={styles.changeImageBtnText}>Cambiar imagen</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => pickImage(block.id)} style={styles.imagePlaceholder}>
                        <Feather name="image" size={24} color={theme.colors.textMuted} />
                        <Text style={styles.imagePlaceholderText}>Seleccionar de la galería</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }
            })}

            {/* Controles para Añadir Bloques */}
            <View style={styles.addBlockRow}>
              <TouchableOpacity onPress={() => addBlock('markdown')} style={styles.addBlockBtn}>
                <Feather name="plus" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.addBlockBtnText}>Agregar Texto</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => addBlock('image')} style={styles.addBlockBtn}>
                <Feather name="image" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.addBlockBtnText}>Agregar Imagen</Text>
              </TouchableOpacity>
            </View>
          </View>

          <SelectorModal
            visible={showTagModal}
            title="Seleccionar Etiqueta"
            placeholder="Buscar o escribir nueva etiqueta..."
            suggestions={tagSuggestions.filter(t => !tags.some(tg => tg.toLowerCase() === t.toLowerCase()))}
            allowCustom={tags.length + ((ramo ? 1 : 0) + (semestre ? 1 : 0) + (instancia ? 1 : 0)) < 10}
            onSelect={(val) => {
              const clean = val.trim();
              const specialCount = (ramo ? 1 : 0) + (semestre ? 1 : 0) + (instancia ? 1 : 0);
              if (clean && tags.length + specialCount < 10 && !tags.some(t => t.toLowerCase() === clean.toLowerCase())) {
                setTags([...tags, clean]);
              }
            }}
            onClose={() => setShowTagModal(false)}
          />
        </ScrollView>
      ) : (
        <ScrollView style={styles.previewBody} contentContainerStyle={styles.previewContent}>
          {blocks.some(b => b.value.trim()) ? (
            <View style={{ flex: 1 }}>
              <MarkdownRenderer 
                content={blocks.map(b => b.type === 'markdown' ? b.value : (b.value ? `\n![imagen](${b.value})\n` : '')).join('\n\n')} 
                height={300} 
              />
            </View>
          ) : (
            <Text style={styles.emptyPreviewText}>No hay contenido que previsualizar. Escribe algo en la pestaña Editar.</Text>
          )}
        </ScrollView>
      )}

      {/* Botones inferiores */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.cancelBtn} 
          onPress={() => navigation.goBack()}
          disabled={saving}
        >
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.saveBtn, 
            (blocks.filter(b => b.type === 'markdown' ? b.value.trim() : b.value).length === 0 || 
             blocks.some(b => b.uploading) || 
             !title.trim()) && styles.saveBtnDisabled
          ]} 
          onPress={handleSave}
          disabled={
            saving || 
            blocks.filter(b => b.type === 'markdown' ? b.value.trim() : b.value).length === 0 || 
            blocks.some(b => b.uploading) || 
            !title.trim()
          }
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={styles.saveBtnText}>Publicar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.text,
  },
  editorBody: {
    flex: 1,
  },
  editorContent: {
    padding: theme.spacing.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: theme.spacing.lg,
  },
  infoBannerText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  editorTip: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 14,
    marginTop: theme.spacing.xs,
  },
  helpersBar: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
    marginTop: 2,
  },
  helperBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
  },
  helperBtnText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 14,
    minHeight: 250,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginTop: theme.spacing.xs,
  },
  helpText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  previewBody: {
    flex: 1,
  },
  previewContent: {
    padding: theme.spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyPreviewText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    minWidth: 90,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 13,
  },
  academicFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 65,
    left: 0,
    right: 0,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    maxHeight: 120,
    zIndex: 999,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222222',
  },
  suggestionItemText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  activeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 4,
  },
  tagChipEditable: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipEditableText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  addTagBtn: {
    backgroundColor: '#333333',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addTagBtnDisabled: {
    opacity: 0.3,
  },
  addTagBtnText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '500',
    marginTop: -2,
  },
  inputSubLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  cancelCustomBtn: {
    marginLeft: 8,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockContainer: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  blockTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deleteBlockBtn: {
    padding: 4,
  },
  blockTextArea: {
    color: theme.colors.text,
    fontSize: 14,
    minHeight: 120,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    textAlignVertical: 'top',
  },
  imagePlaceholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  imageWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#050505',
  },
  changeImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: theme.spacing.sm,
  },
  changeImageBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  addBlockRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  addBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addBlockBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  previewImageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
  },
});
