import React, { useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, DeviceEventEmitter, Animated } from 'react-native';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

interface HeaderProps {
  title: string;
  onToggleSidebar?: () => void;
  onBack?: () => void;
  onTitlePress?: () => void;
  rightComponent?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, onToggleSidebar, onBack, onTitlePress, rightComponent }) => {
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const spinnerOpacity = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handleTitlePress = () => {
    if (!onTitlePress) return;
    
    // Ejecutar callback de refresco
    onTitlePress();
    
    // Reiniciar rotación
    rotateAnim.setValue(0);

    // Ejecutar secuencia de animación
    Animated.sequence([
      // 1. Desvanecer título y mostrar spinner
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(spinnerOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      // 2. Rotar el spinner 360 grados
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      // 3. Desvanecer spinner y volver a mostrar el título
      Animated.parallel([
        Animated.timing(spinnerOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.header}>
      <View style={styles.sideContainer}>
        {onBack ? (
          <TouchableOpacity style={styles.iconButton} onPress={onBack} activeOpacity={0.7}>
            <Feather name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
      
      {onTitlePress ? (
        <TouchableOpacity 
          onPress={handleTitlePress} 
          activeOpacity={0.8} 
          style={styles.headerTitleContainer}
        >
          {/* Título */}
          <Animated.View style={{ opacity: titleOpacity, position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          </Animated.View>
          
          {/* Spinner de Actualización */}
          <Animated.View style={{ 
            opacity: spinnerOpacity, 
            position: 'absolute',
            transform: [{ rotate: spin }],
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Feather name="refresh-cw" size={18} color={theme.colors.text} />
          </Animated.View>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
      )}
      
      <View style={[styles.sideContainer, { justifyContent: 'flex-end' }]}>
        {rightComponent}
        {Platform.OS === 'web' && (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => DeviceEventEmitter.emit('onGlobalRefresh')}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.iconButton} 
          onPress={onToggleSidebar}
          activeOpacity={0.7}
        >
          <View style={styles.hamburger}>
            <View style={styles.hamburgerLine} />
            <View style={[styles.hamburgerLine, { marginVertical: 4 }]} />
            <View style={styles.hamburgerLine} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: theme.colors.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sideContainer: {
    minWidth: 40,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  iconButton: {
    padding: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholder: {
    width: 40,
  },
  hamburger: {
    width: 24,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerLine: {
    width: 20,
    height: 2.5,
    backgroundColor: theme.colors.text,
    borderRadius: 1.25,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 60,
    right: 60,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
});
