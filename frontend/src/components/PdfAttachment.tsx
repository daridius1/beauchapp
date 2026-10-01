import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';

export const MAX_PDF_SIZE = 2 * 1024 * 1024;

interface PdfPickerProps {
  value?: File | null;
  onPdfReady: (file: File | null) => void;
  variant?: 'icon' | 'menu';
}

export const PdfPicker: React.FC<PdfPickerProps> = ({ value, onPdfReady, variant = 'icon' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setChecking(true);
    setError(null);
    try {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Solo se permiten archivos PDF.');
      }
      if (file.size > MAX_PDF_SIZE) {
        throw new Error('El PDF debe pesar como máximo 2 MB.');
      }

      // El MIME declarado por el navegador no basta: esta firma evita subir por error
      // otro tipo de archivo renombrado como .pdf. PocketBase vuelve a validar MIME y peso.
      const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
      if (!String.fromCharCode(...header).includes('%PDF-')) {
        throw new Error('El archivo seleccionado no parece ser un PDF válido.');
      }
      onPdfReady(file);
    } catch (err: any) {
      setError(err.message || 'No se pudo revisar el PDF.');
    } finally {
      setChecking(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={variant === 'menu' ? undefined : styles.pickerContainer}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <TouchableOpacity
        style={variant === 'menu' ? styles.menuItem : styles.iconButton}
        onPress={() => inputRef.current?.click()}
        disabled={checking || !!value}
      >
        {checking ? (
          <ActivityIndicator size="small" color={theme.colors.text} />
        ) : (
          <>
            <Feather name="file-text" size={variant === 'menu' ? 18 : 20} color={theme.colors.textMuted} />
            {variant === 'menu' && <Text style={styles.menuLabel}>PDF (máx. 2 MB)</Text>}
          </>
        )}
      </TouchableOpacity>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

interface PdfAttachmentProps {
  name: string;
  size?: number;
  url?: string;
  onRemove?: () => void;
}

const formatSize = (size?: number) => {
  if (!size || size < 1) return 'PDF';
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const PdfAttachment: React.FC<PdfAttachmentProps> = ({ name, size, url, onRemove }) => {
  const openPdf = () => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  const Container = url ? TouchableOpacity : View;
  return (
    <Container style={styles.card} {...(url ? { onPress: openPdf, activeOpacity: 0.7 } : {})}>
      <View style={styles.fileIcon}>
        <Feather name="file-text" size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.fileText}>
        <Text style={styles.fileName} numberOfLines={1}>{name || 'Documento PDF'}</Text>
        <Text style={styles.fileMeta}>{formatSize(size)}{url ? ' · Abrir documento' : ''}</Text>
      </View>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
          <Feather name="x" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      ) : (
        <Feather name="external-link" size={16} color={theme.colors.textMuted} />
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  pickerContainer: { marginRight: 12 },
  iconButton: { padding: 8, borderRadius: 6 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  menuLabel: { color: theme.colors.text, fontSize: 14 },
  errorText: { color: theme.colors.error, fontSize: 12, paddingHorizontal: 8, paddingBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  fileIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  },
  fileText: { flex: 1, minWidth: 0 },
  fileName: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  fileMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  removeButton: { padding: 8, marginLeft: theme.spacing.xs },
});
