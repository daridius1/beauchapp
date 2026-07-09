import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { TypstRenderer } from '../components/TypstRenderer';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'ProblemEditor'>;

export const ProblemEditorScreen: React.FC<Props> = ({ route, navigation }) => {
  const { type, problemId, problemTitle } = route.params;
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Algunos helpers para facilitar escribir Typst rápidamente
  const typstHelpers = [
    { label: 'Título', code: '\n= Título\n' },
    { label: 'Fórmula', code: ' $ f(x) = x^2 $ ' },
    { label: 'Negrita', code: ' *negrita* ' },
    { label: 'Cursiva', code: ' _cursiva_ ' },
    { label: 'Lista', code: '\n- Elemento 1\n- Elemento 2\n' },
    { label: 'Código', code: '\n\`\`\`rust\nfn main() {}\n\`\`\`\n' },
  ];

  const handleInsertHelper = (code: string) => {
    setContent(prev => prev + code);
  };

  const handleSave = async () => {
    if (!user) {
      Toast.show({
        type: 'error',
        text1: 'Sesión expirada',
        text2: 'Debes iniciar sesión para guardar.',
      });
      return;
    }

    if (type === 'problem' && !title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Título requerido',
        text2: 'Por favor ingresa un título para el problema.',
      });
      return;
    }

    if (!content.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Contenido vacío',
        text2: 'Por favor escribe el enunciado o la solución.',
      });
      return;
    }

    setSaving(true);
    try {
      if (type === 'problem') {
        // Formatear las etiquetas ingresadas por coma
        const cleanTags = tagsInput
          .split(',')
          .map(t => t.trim().toLowerCase().replace(/#/g, ''))
          .filter(t => t.length > 0);

        await pb.collection('problems').create({
          title: title.trim(),
          content: content.trim(),
          tags: cleanTags,
          author: user.id
        });

        Toast.show({
          type: 'success',
          text1: '¡Problema publicado!',
          text2: 'Tu problema se ha subido correctamente.',
        });
      } else {
        // Crear respuesta
        await pb.collection('problem_answers').create({
          problem: problemId,
          content: content.trim(),
          author: user.id
        });

        Toast.show({
          type: 'success',
          text1: '¡Pauta publicada!',
          text2: 'Tu pauta se ha subido correctamente.',
        });
      }

      navigation.goBack();
    } catch (err) {
      console.error('Error saving:', err);
      Toast.show({
        type: 'error',
        text1: 'Error al guardar',
        text2: 'Ocurrió un error al guardar tu contenido.',
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

          {type === 'problem' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Título del Problema</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. Criterio de la integral para series"
                placeholderTextColor={theme.colors.textMuted}
                value={title}
                onChangeText={setTitle}
                maxLength={80}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xs }}>
              <Text style={styles.inputLabel}>Cuerpo en Typst</Text>
              <Text style={styles.editorTip}>Usa $ para fórmulas</Text>
            </View>
            
            {/* Barra de Helpers */}
            <View style={styles.helpersBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {typstHelpers.map(helper => (
                  <TouchableOpacity 
                    key={helper.label} 
                    style={styles.helperBtn}
                    onPress={() => handleInsertHelper(helper.code)}
                  >
                    <Text style={styles.helperBtnText}>{helper.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TextInput
              style={styles.textArea}
              placeholder="Escribe el enunciado aquí en código Typst..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              value={content}
              onChangeText={setContent}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {type === 'problem' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Etiquetas (Separadas por comas)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="ej: calculo, series, integrales"
                placeholderTextColor={theme.colors.textMuted}
                value={tagsInput}
                onChangeText={setTagsInput}
                autoCapitalize="none"
              />
              <Text style={styles.helpText}>Las comas separarán las etiquetas al guardar.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.previewBody} contentContainerStyle={styles.previewContent}>
          {content.trim() ? (
            <View style={{ marginHorizontal: -theme.spacing.lg }}>
              <TypstRenderer content={content} height={400} />
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
          style={[styles.saveBtn, (!content.trim() || (type === 'problem' && !title.trim())) && styles.saveBtnDisabled]} 
          onPress={handleSave}
          disabled={saving || !content.trim() || (type === 'problem' && !title.trim())}
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
});
