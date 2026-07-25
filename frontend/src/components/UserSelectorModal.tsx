import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { pb } from '../services/pocketbase';
import { Avatar } from './Avatar';

export interface StudentUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  collectionId?: string;
}

interface UserSelectorModalProps {
  visible: boolean;
  title?: string;
  placeholder?: string;
  excludeUserIds?: string[];
  onSelect: (user: StudentUser) => void;
  onClose: () => void;
}

export const UserSelectorModal: React.FC<UserSelectorModalProps> = ({
  visible,
  title = 'Buscar Usuario',
  placeholder = 'Buscar por nombre o @username...',
  excludeUserIds = [],
  onSelect,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<StudentUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Resetear cuando se abre el modal
  useEffect(() => {
    if (visible) {
      setSearch('');
      setUsers([]);
      setHasLoadedOnce(false);
      fetchUsers('', true);
    }
  }, [visible]);

  // Buscar usuarios con debounce
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      fetchUsers(search, false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, visible]);

  const fetchUsers = async (queryStr: string, isInitial: boolean) => {
    try {
      if (!isInitial) setSearching(true);
      const query = queryStr.trim();
      let filter = 'type != "organization"';
      if (query) {
        filter += ` && (name ~ "${query}" || username ~ "${query}")`;
      }
      
      const res = await pb.collection('users').getList<StudentUser>(1, 30, {
        filter,
        sort: 'name',
      });
      
      setUsers(res.items);
      setHasLoadedOnce(true);
    } catch (err) {
      console.error('Error fetching users in UserSelectorModal:', err);
    } finally {
      setSearching(false);
    }
  };

  const filteredUsers = users.filter((u) => !excludeUserIds.includes(u.id));

  const handleSelect = (user: StudentUser) => {
    onSelect(user);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.keyboardView, isDesktop && styles.keyboardViewDesktop]}
        >
          <View style={[styles.content, isDesktop && styles.contentDesktop]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Buscador */}
            <View style={styles.searchBar}>
              <Feather name="search" size={16} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus={true}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Feather name="x-circle" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Listado */}
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {searching ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : !hasLoadedOnce ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : filteredUsers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No se encontraron usuarios</Text>
                </View>
              ) : (
                filteredUsers.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.userRow}
                    onPress={() => handleSelect(user)}
                  >
                    <View style={{ marginRight: 12 }}>
                      <Avatar user={{ id: user.id, collectionId: '_pb_users_auth_', avatar: user.avatar, name: user.name, username: user.username }} size={36} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{user.name || 'Usuario'}</Text>
                      {!!user.username && (
                        <Text style={styles.userHandle}>@{user.username}</Text>
                      )}
                    </View>
                    <Feather name="plus" size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  overlayDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  keyboardView: {
    width: '100%',
  },
  keyboardViewDesktop: {
    width: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    backgroundColor: '#0c0c0c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#222222',
    borderBottomWidth: 0,
    maxHeight: '80%',
    minHeight: 320,
    paddingTop: 16,
  },
  contentDesktop: {
    width: 480,
    borderRadius: 16,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    marginHorizontal: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    padding: 0,
  },
  list: {
    maxHeight: 380,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  userName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  userHandle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});
