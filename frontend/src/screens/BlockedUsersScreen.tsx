import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { pb, getFileUrl } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'BlockedUsers'>;

export const BlockedUsersScreen: React.FC<Props> = () => {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);

  const loadBlockedUsers = async () => {
    if (!user) return;
    setLoadingBlocked(true);
    try {
      // No se usa expand:'blocked' — una vez creado el bloqueo, users.viewRule ya
      // excluye a esa persona para este mismo usuario, así que vendría vacío.
      // El nombre/username quedan guardados aparte en el propio registro (ver
      // blocking.pb.js).
      const res = await pb.collection('blocked_users').getList(1, 100, {
        filter: `blocker = "${user.id}"`,
        sort: '-created',
      });
      setBlockedUsers(res.items);
    } catch (err) {
      console.warn('Error cargando usuarios bloqueados:', err);
    } finally {
      setLoadingBlocked(false);
    }
  };

  useEffect(() => {
    loadBlockedUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleUnblock = async (blockRecordId: string, blockedName: string) => {
    try {
      await pb.collection('blocked_users').delete(blockRecordId);
      setBlockedUsers((prev) => prev.filter((b) => b.id !== blockRecordId));
      Toast.show({
        type: 'info',
        text1: 'Usuario desbloqueado',
        text2: `${blockedName} ya puede volver a aparecer en la app.`,
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'No se pudo desbloquear al usuario.',
      });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>
        Las personas que bloquees no podrán ver tu contenido ni contactarte, y tú tampoco verás el suyo.
      </Text>

      {loadingBlocked ? (
        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 24 }} />
      ) : blockedUsers.length === 0 ? (
        <Text style={styles.emptyText}>No has bloqueado a nadie.</Text>
      ) : (
        blockedUsers.map((b) => (
          <View key={b.id} style={styles.rowCard}>
            {b.blocked_avatar ? (
              <Image
                source={{ uri: getFileUrl(b, b.blocked_avatar, '100x100') }}
                style={styles.avatarPlaceholder}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={18} color={theme.colors.textMuted} />
              </View>
            )}
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{b.blocked_name || 'Usuario'}</Text>
              {!!b.blocked_username && <Text style={styles.rowSub}>@{b.blocked_username}</Text>}
            </View>
            <TouchableOpacity
              style={styles.unblockBtn}
              onPress={() => handleUnblock(b.id, b.blocked_name || 'Usuario')}
            >
              <Text style={styles.unblockBtnText}>Desbloquear</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    padding: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    marginLeft: 10,
  },
  rowName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rowSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  unblockBtn: {
    padding: 8,
  },
  unblockBtnText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
});
