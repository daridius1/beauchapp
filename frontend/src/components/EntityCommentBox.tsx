import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { theme } from '../theme/theme';
import { ImagePicker } from './ImagePicker';

export interface EntityCommentBoxProps {
  onSendComment: (content: string, photo: File | null) => Promise<void>;
  placeholder?: string;
  buttonText?: string;
  style?: any;
}

export const EntityCommentBox: React.FC<EntityCommentBoxProps> = ({
  onSendComment,
  placeholder = 'Escribe un comentario...',
  buttonText = 'Publicar',
  style,
}) => {
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (photo) {
      const url = URL.createObjectURL(photo);
      setPhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPhotoPreview(null);
    }
  }, [photo]);

  const handlePublish = async () => {
    if ((!content.trim() && !photo) || submitting) return;
    setSubmitting(true);
    try {
      await onSendComment(content.trim(), photo);
      setContent('');
      setPhoto(null);
      setPhotoPreview(null);
    } catch (err) {
      console.error('Error publishing comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const isBtnDisabled = (!content.trim() && !photo) || submitting;

  return (
    <View style={[styles.container, style]}>
      {photoPreview && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoPreview }} style={styles.previewImage} />
          <TouchableOpacity style={styles.removeButton} onPress={() => setPhoto(null)}>
            <Text style={styles.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
        />
      </View>

      <View style={styles.footerRow}>
        <ImagePicker onImageReady={(f) => setPhoto(f)} value={photo} />
        <TouchableOpacity
          style={[styles.publishBtn, isBtnDisabled && styles.publishBtnDisabled]}
          onPress={handlePublish}
          disabled={isBtnDisabled}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={styles.publishBtnText}>{buttonText}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  previewContainer: {
    position: 'relative',
    marginBottom: theme.spacing.sm,
    width: 100,
    height: 100,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  removeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  inputContainer: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  input: {
    color: theme.colors.text,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
    textAlignVertical: 'top',
    padding: 0,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  publishBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 84,
  },
  publishBtnDisabled: {
    opacity: 0.4,
  },
  publishBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
});
