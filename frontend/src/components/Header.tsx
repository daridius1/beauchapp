import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { theme } from '../screens/HomeScreen';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onToggleSidebar }) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.menuButton} 
        onPress={onToggleSidebar}
        activeOpacity={0.7}
      >
        <View style={styles.hamburger}>
          <View style={styles.hamburgerLine} />
          <View style={[styles.hamburgerLine, { marginVertical: 4 }]} />
          <View style={styles.hamburgerLine} />
        </View>
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>{title}</Text>
      
      {/* Elemento de balanceo a la derecha */}
      <View style={styles.rightPlaceholder} />
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
  menuButton: {
    padding: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburger: {
    width: 24,
    height: 18,
    justifyContent: 'center',
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
  },
  rightPlaceholder: {
    width: 40,
  },
});
