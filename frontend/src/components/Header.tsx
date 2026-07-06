import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, DeviceEventEmitter } from 'react-native';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

interface HeaderProps {
  title: string;
  onToggleSidebar?: () => void;
  onBack?: () => void;
  rightComponent?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, onToggleSidebar, onBack, rightComponent }) => {
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
      
      <Text style={styles.headerTitle}>{title}</Text>
      
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
});
