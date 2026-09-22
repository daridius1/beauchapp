import React, { useState, useCallback, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  DeviceEventEmitter
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { notificationService } from '../services/notifications';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { withMinimumDelay } from '../utils/refresh';
import { storage } from '../utils/storage';
import { pushNotificationService } from '../services/pushNotifications';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import Toast from 'react-native-toast-message';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    try {
      const items = await notificationService.getNotifications(user.id);
      setNotifications(items);
      const hasRefereeNotice = items.some((item) =>
        (item.type === 'league_referee_assignment' || item.type === 'league_referee_member_assignment') && !item.read
      );
      if (hasRefereeNotice && storage.getItem(`referee_push_prompt_${user.id}`) !== 'dismissed') {
        pushNotificationService.getStatus()
          .then((status) => setShowPushPrompt(status === 'disabled' || status === 'needs-install'))
          .catch(() => setShowPushPrompt(false));
      } else {
        setShowPushPrompt(false);
      }

      // Marcar como leídas
      await notificationService.markAllAsRead(user.id);
      DeviceEventEmitter.emit('onNotificationsRead');
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudieron cargar las notificaciones.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      withMinimumDelay(() => fetchNotifications());
    }, [fetchNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchNotifications(true));
    setRefreshing(false);
  }, [fetchNotifications]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchNotifications(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, [fetchNotifications]);

  const handleDeleteNotification = async (notifId: string) => {
    try {
      await notificationService.deleteNotification(notifId);
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      Toast.show({
        type: 'success',
        text1: 'Eliminada',
        text2: 'Notificación eliminada correctamente.',
      });
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const dismissPushPrompt = () => {
    if (user) storage.setItem(`referee_push_prompt_${user.id}`, 'dismissed');
    setShowPushPrompt(false);
  };

  const handleNotificationPress = (item: any) => {
    if (item.type === 'match') {
      navigation.navigate('Tinder', { initialTab: 'matches' });
    } else if ((item.type === 'mention' || item.type === 'reply') && item.relatedId) {
      navigation.navigate('PostDetail', { postId: item.relatedId });
    } else if ((item.type === 'ladder_match' || item.type === 'ladder_confirmation') && item.relatedId) {
      navigation.navigate('LadderMatchDetail', { matchId: item.relatedId });
    } else if ((item.type === 'league_referee_result' || item.type === 'league_referee_assignment' ||
      item.type === 'league_referee_member_result' || item.type === 'league_referee_member_assignment') && item.relatedId) {
      navigation.navigate('LeagueMatchDetail', { matchId: item.relatedId });
    } else if ((item.type === 'activity' || item.type === 'new_activity') && item.relatedId) {
      navigation.navigate('ActivityDetail', { activityId: item.relatedId });
    } else if (item.type === 'org_invite' && item.relatedId) {
      navigation.navigate('UserProfile', { userId: item.relatedId });
    } else if ((item.type === 'trade_proposed' || item.type === 'trade_countered' || item.type === 'trade_accepted') && item.relatedId) {
      navigation.navigate('LeagueAlbum', { albumId: item.relatedId });
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr.replace(' ', 'T'));
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Hace un momento';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;
      return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const sender = item.expand?.sender;
    const isUnread = !item.read;

    return (
      <TouchableOpacity 
        style={[
          styles.notificationCard,
          isUnread && styles.notificationCardUnread,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {sender ? (
            <Avatar user={sender} size={44} />
          ) : (
            <View style={styles.systemIconContainer}>
              <Feather name="bell" size={20} color={theme.colors.primary} />
            </View>
          )}

          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                {isUnread && <View style={styles.unreadDot} />}
                <Text style={[styles.titleText, isUnread && styles.titleTextUnread]} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              <Text style={styles.timeText}>{formatTime(item.created)}</Text>
            </View>
            <Text style={[styles.bodyText, isUnread && styles.bodyTextUnread]}>{item.body}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.deleteBtn}
            onPress={() => handleDeleteNotification(item.id)}
          >
            <Feather name="trash-2" size={14} color={theme.colors.textMuted} />
            <Text style={styles.deleteBtnText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          ListHeaderComponent={showPushPrompt ? (
            <View style={styles.pushPrompt}>
              <View style={styles.pushPromptContent}>
                <Text style={styles.pushPromptTitle}>Entérate de los próximos arbitrajes</Text>
                <Text style={styles.pushPromptText}>Puedes activar avisos en este dispositivo para recibirlos aunque Beauchapp esté cerrada.</Text>
                <TouchableOpacity onPress={() => { dismissPushPrompt(); navigation.navigate('Settings'); }}>
                  <Text style={styles.pushPromptLink}>Ir a Configuración</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={dismissPushPrompt} accessibilityLabel="Cerrar sugerencia">
                <Feather name="x" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : null}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Feather name="bell-off" size={44} color={theme.colors.textMuted} />
              </View>
               <Text style={styles.emptyTitle}>No tienes notificaciones</Text>
              <Text style={styles.emptySubtitle}>
                Aquí aparecerán las menciones, respuestas, avisos de nuevos matches y novedades del sistema.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  pushPrompt: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  pushPromptContent: { flex: 1, paddingRight: theme.spacing.sm },
  pushPromptTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  pushPromptText: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  pushPromptLink: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
    gap: 12,
  },
  notificationCard: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  notificationCardUnread: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginRight: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  systemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  titleTextUnread: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  timeText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  bodyText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  bodyTextUnread: {
    color: theme.colors.text,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
    marginLeft: 'auto',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
