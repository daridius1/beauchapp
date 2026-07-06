import React from 'react';
import { Modal, View, Image, StyleSheet, TouchableOpacity, Dimensions, Platform, Linking } from 'react-native';
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
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = 'imagen_beauchapp.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Linking.openURL(imageUrl);
    }
  };

  const { width, height } = Dimensions.get('window');

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.scrollContent}>
          <Image 
            source={{ uri: imageUrl }}
            style={[styles.image, { width, height }]}
            resizeMode="contain"
          />
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
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    // dynamic styles applied in render
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
