import React from 'react';
import { Modal, View, Image, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface ImageViewerProps {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ visible, imageUrl, onClose }) => {
  if (!imageUrl) return null;

  const handleDownload = async () => {
    if (Platform.OS === 'web') {
      try {
        const response = await fetch(imageUrl);
        const originalBlob = await response.blob();
        const blob = new Blob([originalBlob], { type: 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'imagen_beauchapp.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('Error al descargar la imagen:', err);
        window.open(imageUrl, '_blank');
      }
    } else {
      Linking.openURL(imageUrl);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop táctil para cerrar la imagen al tocar fuera */}
        <TouchableOpacity 
          style={StyleSheet.absoluteFillObject} 
          activeOpacity={1} 
          onPress={onClose} 
        />

        <View style={[styles.scrollContent, { pointerEvents: 'box-none' }]}>
          <TouchableOpacity activeOpacity={1} style={styles.imageWrapper}>
            <Image 
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
          <Feather name="download" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Feather name="x" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  scrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    maxHeight: '85%',
    maxWidth: '95%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
  downloadButton: {
    position: 'absolute',
    top: 40,
    right: 70,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 10,
    zIndex: 10,
  }
});
