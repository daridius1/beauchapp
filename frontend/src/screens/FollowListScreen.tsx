import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  TextInput 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'FollowList'>;

export const FollowListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId, type } = route.params;
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const isFirstLoad = useRef(true);

  const fetchFollows = async () => {
    try {
      setLoading(true);
      const isFollowers = type === 'followers';
      
      const filterStr = isFollowers 
        ? `following = "${userId}"` 
        : `follower = "${userId}"`;
        
      const res = await pb.collection('follows').getList(1, 200, {
        filter: filterStr,
        expand: isFollowers ? 'follower' : 'following',
        sort: '-created',
      });
      
      // Mapear los registros de la relación a los objetos de usuario expandidos
      const mappedUsers = res.items
        .map(item => isFollowers ? item.expand?.follower : item.expand?.following)
        .filter(user => !!user); // Quitar nulos si hay inconsistencia
        
      setUsers(mappedUsers);
    } catch (err) {
      console.error('Error fetching follows list:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFollows();
    }, [userId, type])
  );

  const filteredUsers = users.filter(user => 
    (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (user.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const emptyMessage = type === 'followers' 
    ? 'Esta cuenta aún no tiene seguidores.' 
    : 'Esta cuenta aún no sigue a nadie.';

  return (
    <View style={styles.container}>
      {/* Buscador local */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 50 }} />
        ) : (
          filteredUsers.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchQuery.trim().length > 0 ? 'No se encontraron resultados.' : emptyMessage}
            </Text>
          ) : (
            filteredUsers.map((user) => (
              <TouchableOpacity 
                key={user.id} 
                style={styles.itemContainer}
                onPress={() => navigation.push('UserProfile', { userId: user.id, title: user.name })}
              >
                <View style={{ marginRight: theme.spacing.md }}>
                  <Avatar user={user} size={40} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>
                    {user.name || 'Usuario'}
                  </Text>
                  {!!user.username && (
                    <Text style={styles.itemUsername}>
                      @{user.username}
                    </Text>
                  )}
                </View>
                <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
  },
  emptyText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  itemUsername: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
