import React, { useRef, useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { compressImage } from '../utils/imageCompressor';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

interface Props {
  onImageReady: (file: File | null) => void;
  value?: File | null;
  variant?: 'icon' | 'menu';
  // JPEG es el default (liviano, para fotos normales tipo posts/comentarios). PNG es
  // para casos que necesitan mantener transparencia (ej. foto de jugador con fondo
  // transparente) — a diferencia de WebP, PocketBase sí sabe generar thumbnails a
  // partir de un PNG (con WebP como origen, el generador de thumbs de PocketBase no
  // lo puede decodificar y termina sirviendo la imagen completa sin recortar).
  format?: 'image/jpeg' | 'image/png';
  cropToSquare?: boolean;
}

export const ImagePicker: React.FC<Props> = ({ onImageReady, value, variant = 'icon', format = 'image/jpeg', cropToSquare = false }) => {
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
      const compressedBlob = await compressImage(file, cropToSquare, format);
      const ext = format === 'image/png' ? '.png' : '.jpg';
      const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ext, { type: format });
      
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

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Subida de imágenes estará disponible pronto en móvil.</Text>
      </View>
    );
  }

  return (
    <View style={variant === 'menu' ? styles.menuContainer : styles.container}>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      
      <TouchableOpacity
        style={[variant === 'menu' ? styles.menuItem : styles.attachButton, !!value && { opacity: 0.3 }]}
        onPress={() => fileInputRef.current?.click()}
        disabled={isCompressing || !!value}
      >
        {isCompressing ? (
          <ActivityIndicator size="small" color={theme.colors.text} />
        ) : (
          <>
            <Feather name="image" size={variant === 'menu' ? 18 : 22} color={theme.colors.textMuted} />
            {variant === 'menu' && <Text style={styles.menuLabel}>Foto</Text>}
          </>
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
  menuContainer: {
    marginVertical: 0,
  },
  attachButton: {
    padding: 8,
    borderRadius: 8,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  menuLabel: {
    color: theme.colors.text,
    fontSize: 14,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
  },
});
