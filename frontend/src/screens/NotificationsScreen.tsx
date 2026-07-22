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

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    try {
      const items = await notificationService.getNotifications(user.id);
      setNotifications(items);
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

  const handleNotificationPress = (item: any) => {
    if (item.type === 'match') {
      navigation.navigate('Tinder', { initialTab: 'matches' });
    } else if (item.type === 'mention' && item.relatedId) {
      navigation.navigate('PostDetail', { postId: item.relatedId });
    } else if (item.type === 'ladder_match' && item.relatedId) {
      navigation.navigate('LadderMatchDetail', { matchId: item.relatedId });
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

    return (
      <TouchableOpacity 
        style={styles.notificationCard}
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
              <Text style={styles.titleText}>{item.title}</Text>
              <Text style={styles.timeText}>{formatTime(item.created)}</Text>
            </View>
            <Text style={styles.bodyText}>{item.body}</Text>
          </View>

          {item.type === 'match' && (
            <View style={styles.typeBadge}>
              <FontAwesome name="heart" size={16} color="#EF4444" />
            </View>
          )}

          {item.type === 'mention' && (
            <View style={[styles.typeBadge, { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1 }]}>
              <Feather name="at-sign" size={16} color="#CCCCCC" />
            </View>
          )}
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
                Aquí aparecerán las menciones, los avisos de nuevos matches y novedades del sistema.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
    alignItems: 'baseline',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
    marginRight: 8,
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
  typeBadge: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
