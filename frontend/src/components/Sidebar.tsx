import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Dimensions, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { Avatar } from './Avatar';
import { isStandalone } from '../utils/pwa';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 300);

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  activeScreen: string;
  onNavigate: (screen: string) => void;
  isDocked?: boolean;
  hasUnreadNotifications?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose, activeScreen, onNavigate, isDocked = false, hasUnreadNotifications }) => {
  const { user, logout } = useAuth();
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [runningAsPwa, setRunningAsPwa] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') setRunningAsPwa(isStandalone());
  }, []);
  useEffect(() => {
    if (isDocked) return;
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isOpen, isDocked]);

  const handleLinkPress = (screen: string) => {
    onNavigate(screen);
    if (onClose) onClose();
  };

  const handleLogout = () => {
    logout();
    onNavigate('Home');
    if (onClose) onClose();
  };

  // Cada categoría de nivel superior es en realidad una pantalla-grilla (ver
  // Comunidad/Academico/Deportes/JuegosScreen) que navega a estas subpantallas.
  // Esta tabla es la que decide qué ítem del sidebar queda resaltado cuando el
  // usuario está adentro de una de ellas — hay que mantenerla sincronizada a mano
  // con la lista `apps` de cada pantalla-grilla y con el mapeo de `handleBack` en App.tsx.
  const categoryScreens: Record<string, string[]> = {
    Comunidad: ['Marketplace', 'MarketplaceItemDetail', 'SellerProfile', 'SellerProfileEditor', 'MarketplaceItemEditor', 'Tinder', 'Directory', 'Students', 'Communities', 'Centers', 'Teams', 'Bands', 'UserProfile', 'FollowList', 'Activities', 'ActivityDetail', 'ActivityEditor'],
    Academico: ['ProblemsList', 'ProblemDetail', 'ProblemEditor', 'Reviews', 'CourseDetail', 'ProfessorDetail'],
    Deportes: ['LeaguesList', 'LeagueDetail', 'LeagueMatchDetail', 'LeagueMatchArbitrator', 'TeamProfile', 'Polla', 'PollaMatch', 'PollaUserBets', 'TeamSchedule'],
    Juegos: ['LaddersList', 'LadderDetail', 'LadderMatchArbitrator', 'LadderMatchDetail', 'LadderPlayerProfile', 'Beaudle', 'BeaudleDay', 'Beaumarket', 'BeaumarketDetail', 'PollasList'],
  };

  const menuItems = [
    { id: 'Home', label: 'Inicio' },
    { id: 'Comunidad', label: 'Comunidad' },
    { id: 'Academico', label: 'Académico' },
    { id: 'Deportes', label: 'Deportes' },
    { id: 'Juegos', label: 'Juegos' },
    // Instalar como PWA solo tiene sentido en el navegador y si todavía no está instalada
    // (si ya se abrió en modo standalone, no hay nada que instalar). Va al final del arreglo
    // a propósito para que quede como el último ítem del sidebar.
    ...(Platform.OS === 'web' && !runningAsPwa ? [{ id: 'InstallApp', label: 'Instalar aplicación' }] : []),
  ];

  const renderSidebarContent = () => (
    <>
      {/* Encabezado del Perfil con Botones de Icono (Notificaciones y Ajustes) */}
      <View style={styles.header}>
        {user ? (
          <View style={styles.profileHeaderRow}>
            <TouchableOpacity 
              activeOpacity={0.7}
              style={styles.profileClickArea}
              onPress={() => handleLinkPress('Profile')}
            >
              <Avatar user={user} size={48} />
              <View style={styles.profileTextWrapper}>
                <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                {!!user.username && <Text style={styles.userUsername} numberOfLines={1}>@{user.username}</Text>}
              </View>
            </TouchableOpacity>

            <View style={styles.headerIconsContainer}>
              <TouchableOpacity
                style={[
                  styles.headerIconBtn,
                  activeScreen === 'Notifications' && styles.headerIconBtnActive
                ]}
                onPress={() => handleLinkPress('Notifications')}
                activeOpacity={0.75}
              >
                <Feather name="bell" size={17} color={activeScreen === 'Notifications' ? theme.colors.primary : '#d1d5db'} />
                {hasUnreadNotifications && (
                  <View style={styles.sidebarUnreadDot} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.headerIconBtn,
                  activeScreen === 'Settings' && styles.headerIconBtnActive
                ]}
                onPress={() => handleLinkPress('Settings')}
                activeOpacity={0.75}
              >
                <Feather name="settings" size={17} color={activeScreen === 'Settings' ? theme.colors.primary : '#d1d5db'} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.profileHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeTitle}>Invitado</Text>
              <Text style={styles.welcomeSubtitle}>Inicia sesión para ver novedades.</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                activeScreen === 'Settings' && styles.headerIconBtnActive
              ]}
              onPress={() => handleLinkPress('Settings')}
              activeOpacity={0.75}
            >
              <Feather name="settings" size={17} color={activeScreen === 'Settings' ? theme.colors.primary : '#d1d5db'} />
            </TouchableOpacity>
          </View>
        )}

        {!user && (
          <TouchableOpacity 
            style={styles.loginBtn}
            onPress={() => handleLinkPress('Login')}
          >
            <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Enlaces de Navegación */}
      <View style={styles.navLinks}>
        {menuItems.map((item: any) => {
          const isActive = activeScreen === item.id || (categoryScreens[item.id]?.includes(activeScreen) ?? false);
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navItem,
                isActive && styles.navItemActive
              ]}
              onPress={() => handleLinkPress(item.id)}
            >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Text 
                style={[
                  styles.navItemText,
                  activeScreen === item.id && styles.navItemTextActive
                ]}
              >
                {item.label}
              </Text>
              {!!item.badge && item.badge > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          );
        })}
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
    </>
  );

  if (isDocked) {
    return (
      <View style={styles.sidebarDocked}>
        {renderSidebarContent()}
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFillObject, { pointerEvents: isOpen ? 'auto' : 'none' }]}>
      {/* Backdrop (Fondo oscuro transparente) */}
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
      </Animated.View>

      {/* Menú deslizante */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        {renderSidebarContent()}
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
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: theme.colors.cardBg,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingTop: 20,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  sidebarDocked: {
    width: 250,
    backgroundColor: theme.colors.cardBg,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    paddingTop: 20,
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileClickArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  profileTextWrapper: {
    marginLeft: 10,
    flex: 1,
  },
  headerIconsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sidebarUnreadDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },
  headerIconBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
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
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  userUsername: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 1,
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
  badgeContainer: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
