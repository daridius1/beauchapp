import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Dimensions, Pressable } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 300);

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, activeScreen, onNavigate }) => {
  const { user, logout } = useAuth();
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : SIDEBAR_WIDTH,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isOpen]);

  const handleLinkPress = (screen: string) => {
    onNavigate(screen);
    onClose();
  };

  const handleLogout = () => {
    logout();
    onNavigate('Home');
    onClose();
  };


  const menuItems = [
    { id: 'Home', label: 'Inicio' },
    { id: 'Communities', label: 'Comunidades' },
    { id: 'Organizations', label: 'Organizaciones' },
    { id: 'Contests', label: 'Actividades' },
    { id: 'Profile', label: 'Perfil' },
  ];


  return (
    <View style={[StyleSheet.absoluteFillObject, { pointerEvents: isOpen ? 'auto' : 'none' }]}>
      {/* Backdrop (Fondo oscuro transparente) */}
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
      </Animated.View>

      {/* Menú deslizante */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        {/* Encabezado del Perfil */}
        <View style={styles.header}>
          {user ? (
            <View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
              {!!user.username && <Text style={styles.userUsername} numberOfLines={1}>@{user.username}</Text>}
              <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.welcomeTitle}>Invitado</Text>
              <Text style={styles.welcomeSubtitle}>Inicia sesión para ver las novedades de la comunidad.</Text>
              <TouchableOpacity 
                style={styles.loginBtn}
                onPress={() => handleLinkPress('Login')}
              >
                <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Enlaces de Navegación */}
        <View style={styles.navLinks}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navItem,
                activeScreen === item.id && styles.navItemActive
              ]}
              onPress={() => handleLinkPress(item.id)}
            >
              <Text 
                style={[
                  styles.navItemText,
                  activeScreen === item.id && styles.navItemTextActive
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Botón de Salida (Cerrar Sesión) */}
        {user && (
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.logoutBtn} 
              onPress={handleLogout}
            >
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  backdropPressable: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: theme.colors.cardBg,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    paddingTop: 50,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  avatarText: {
    fontSize: 24,
    color: '#000',
    fontWeight: '800',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  userUsername: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  welcomeSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  loginBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  navLinks: {
    flex: 1,
    paddingTop: theme.spacing.md,
  },
  navItem: {
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderLeftColor: theme.colors.primary,
  },
  navItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  navItemTextActive: {
    color: theme.colors.text,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  logoutBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.borderRadius.md,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
