import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { ActivityRecord, activityService } from '../services/activityService';
import { OrgChip } from './OrgChip';

interface ActivityCardProps {
  activity: ActivityRecord;
  onPress: () => void;
  onOrgPress?: (orgId: string) => void;
  onPressAttendees?: () => void;
  compact?: boolean;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  onPress,
  onOrgPress,
  onPressAttendees,
  compact = false,
}) => {
  const org = activity.expand?.organization;
  const bannerUrl = activityService.getBannerUrl(activity);

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {/* Banner de Portada si existe y no es compacto */}
      {!compact && !!bannerUrl && (
        <Image source={{ uri: bannerUrl }} style={styles.bannerImage} resizeMode="cover" />
      )}

      <View style={styles.contentContainer}>
        {/* Cabecera: Organización y Categoría en texto limpio */}
        <View style={styles.headerRow}>
          <Text style={styles.orgCategoryText} numberOfLines={1}>
            <Text
              style={styles.orgText}
              onPress={onOrgPress && org ? () => onOrgPress(org.id) : undefined}
            >
              @{org?.username || org?.name || 'organización'}
            </Text>
            {!!activity.category && (
              <Text style={styles.dotSeparator}> • {activity.category}</Text>
            )}
          </Text>

          {!!activity.price && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>{activity.price}</Text>
            </View>
          )}
        </View>

        {/* Título de la Actividad */}
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={compact ? 1 : 2}>
          {activity.title}
        </Text>

        {/* Descripción corta si existe */}
        {!compact && !!activity.description && (
          <Text style={styles.description} numberOfLines={2}>
            {activity.description}
          </Text>
        )}

        {/* Info Meta: Horario, Lugar y Asistentes */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="clock" size={13} color={theme.colors.accent} />
            <Text style={styles.metaText}>
              {activity.start_time} - {activity.end_time}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Feather name="map-pin" size={13} color="#f59e0b" />
            <Text style={styles.metaText} numberOfLines={1}>
              {activity.location}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.metaItem, { marginLeft: 'auto' }]}
            activeOpacity={0.7}
            onPress={(e: any) => {
              if (e.stopPropagation) e.stopPropagation();
              onPressAttendees ? onPressAttendees() : onPress();
            }}
          >
            <Feather name="users" size={13} color="#10b981" />
            <Text style={[styles.metaText, { color: '#10b981', fontWeight: '700', textDecorationLine: 'underline' }]}>
              {activity.attendee_count || 0} asistirán
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0c0c0c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardCompact: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
  },
  bannerImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#171717',
  },
  contentContainer: {
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orgCategoryText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    flex: 1,
  },
  orgText: {
    fontWeight: '700',
    color: theme.colors.primary,
  },
  dotSeparator: {
    color: '#888888',
    fontWeight: '500',
  },
  priceBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  priceBadgeText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    lineHeight: 22,
  },
  titleCompact: {
    fontSize: 14,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#a3a3a3',
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
});
