import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityDetail'>;

export const CommunityDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { communityId } = route.params;
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommunity = async () => {
      try {
        const record = await pb.collection('communities').getOne(communityId, {
          expand: 'members',
        });
        setCommunity(record);
      } catch (error) {
        console.error('Error fetching community details:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCommunity();
  }, [communityId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>No se encontró la comunidad.</Text>
      </View>
    );
  }

  const members = community.expand?.members || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{community.name}</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!!community.description && (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionTitle}>Acerca de la comunidad</Text>
            <Text style={styles.communityDesc}>{community.description}</Text>
          </View>
        )}
        
        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>
            <Feather name="users" size={16} color={theme.colors.text} /> Miembros ({members.length})
          </Text>
          {members.length > 0 ? (
            <View style={styles.membersList}>
              {members.map((member: any) => (
                <View key={member.id} style={styles.memberRow}>
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarMiniText}>
                      {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <Text style={styles.memberName}>{member.name || member.username}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noMembersText}>Aún no hay miembros en esta comunidad.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  descriptionCard: {
    backgroundColor: theme.colors.cardBg,
    padding: theme.spacing.lg,
    borderRadius: 12,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  communityDesc: {
    fontSize: 15,
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  membersSection: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  membersList: {
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarMiniText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  noMembersText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 16,
  }
});
