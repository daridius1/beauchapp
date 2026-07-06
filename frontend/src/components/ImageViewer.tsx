import React, { useState, useRef } from 'react';
import { Modal, View, Image, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TouchableWithoutFeedback, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface ImageViewerProps {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ visible, imageUrl, onClose }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const lastTapRef = useRef<number>(0);

  const handleClose = () => {
    setIsZoomed(false);
    onClose();
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      setIsZoomed(!isZoomed);
    } else {
      lastTapRef.current = now;
    }
  };

  if (!imageUrl) return null;

  const { width, height } = Dimensions.get('window');

  // When zoomed, multiply width/height by 2
  const imageStyle = isZoomed
    ? { width: width * 2, height: height * 2 }
    : { width: width, height: height };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          maximumZoomScale={3} 
          minimumZoomScale={1}
          centerContent={true}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          // Required for panning a large image natively if isZoomed is true on web/android
          horizontal={isZoomed} 
        >
          {/* A nested ScrollView for vertical scrolling when horizontal is enabled is standard in React Native Web, but we can also just use a single ScrollView or let CSS handle it. React Native Web translates this into overflow: auto */}
          <TouchableWithoutFeedback onPress={handleDoubleTap}>
            <Image 
              source={{ uri: imageUrl }}
              style={[styles.image, imageStyle]}
              resizeMode="contain"
            />
          </TouchableWithoutFeedback>
        </ScrollView>

        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
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
  }
});
