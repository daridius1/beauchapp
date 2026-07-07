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
  const titleTranslateY = useRef(new Animated.Value(0)).current;

  const handleTitlePress = () => {
    if (!onTitlePress) return;
    
    // Ejecutar callback de refresco
    onTitlePress();
    
    // Reiniciar valores de animación
    titleTranslateY.setValue(0);
    titleOpacity.setValue(1);

    // Secuencia de animación: el texto sale por arriba, espera un momento y entra por abajo
    Animated.sequence([
      // 1. El título se desliza hacia arriba (-20) y se desvanece
      Animated.parallel([
        Animated.timing(titleTranslateY, {
          toValue: -20,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
      // 2. Tiempo de espera representando la recarga (400ms)
      Animated.delay(400),
      // 3. Preparamos el título abajo (+20) de forma invisible (duration: 0)
      Animated.timing(titleTranslateY, {
        toValue: 20,
        duration: 0,
        useNativeDriver: true,
      }),
      // 4. El título aparece desde abajo hacia el centro (0) con fundido
      Animated.parallel([
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

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
          {/* Título animado */}
          <Animated.View style={{ 
            opacity: titleOpacity, 
            transform: [{ translateY: titleTranslateY }],
            position: 'absolute', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          </Animated.View>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
      )}
      
      <View style={[styles.sideContainer, { justifyContent: 'flex-end' }]}>
        {rightComponent}

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
