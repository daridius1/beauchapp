import React, { useRef, useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { compressImage } from '../utils/imageCompressor';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

interface Props {
  onImageReady: (file: File | null) => void;
  value?: File | null;
}

export const ImagePicker: React.FC<Props> = ({ onImageReady, value }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (value === null) {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
    }
  }, [value]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes.');
      return;
    }

    setIsCompressing(true);
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' });
      
      // Generate preview
      const previewUrl = URL.createObjectURL(compressedFile);
      setPreview(previewUrl);
      onImageReady(compressedFile);
    } catch (err: any) {
      setError(err.message || 'Error al procesar la imagen.');
    } finally {
      setIsCompressing(false);
      // Reset input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <View style={styles.container}>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      
      <TouchableOpacity
        style={[styles.attachButton, !!value && { opacity: 0.3 } ]}
        onPress={() => fileInputRef.current?.click()}
        disabled={isCompressing || !!value}
      >
        {isCompressing ? (
          <ActivityIndicator size="small" color={theme.colors.text} />
        ) : (
          <Feather name="image" size={22} color={theme.colors.textMuted} />
        )}
      </TouchableOpacity>

      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
    marginRight: 12,
  },
  attachButton: {
    padding: 8,
    borderRadius: 8,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
  },
});
