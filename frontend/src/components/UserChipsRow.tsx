import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking, StyleProp, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { User } from '../context/AuthContext';
import { OrganizationMemberRecord } from '../services/organizationService';
import { SportIcon } from './SportIcon';
import { OrgChip } from './OrgChip';

interface Props {
  user: User;
  memberships?: OrganizationMemberRecord[];
  sellerProfile?: any;
  ladderRanks?: any[];
  onOrgPress?: (organizationId: string) => void;
  onSellerPress?: (sellerProfileId: string) => void;
  onLadderPress?: (sportSlug: string, mode?: string) => void;
  size?: 'sm' | 'md';
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
}

export function getSportCode(name?: string, slug?: string): string {
  if (!name && !slug) return 'ELO';
  const str = (name || slug || '').toLowerCase().trim();
  if (str.includes('tiptap')) return 'TpTp';
  if (str.includes('taca')) return 'TcTc';
  if (str.includes('tenis') || str.includes('mesa') || str.includes('ping')) return 'TdM';
  if (str.includes('pádel') || str.includes('padel')) return 'PDL';
  if (str.includes('ajedrez') || str.includes('chess')) return 'AJZ';
  if (str.includes('fútbol') || str.includes('futbol')) return 'FUT';
  if (str.includes('básquet') || str.includes('basquet') || str.includes('basket')) return 'BSQ';

  const words = (name || slug || '').split(/[\s-_]+/);
  if (words.length > 1) {
    return words.map(w => w[0].toUpperCase() + (w[1]?.toLowerCase() || '')).join('');
  }
  return (name || slug || '').slice(0, 4).toUpperCase();
}

export const YEARS_LIST = Array.from({ length: 27 }, (_, i) => (2026 - i).toString());

export const DEPARTMENTS_LIST = [
  { code: 'PC', label: 'Plan Común' },
  { code: 'DCC', label: 'Computación' },
  { code: 'DIM', label: 'Matemática' },
  { code: 'DII', label: 'Industrial' },
  { code: 'DIC', label: 'Civil' },
  { code: 'GEO', label: 'Geología' },
  { code: 'DIMIN', label: 'Minería' },
  { code: 'GEOF', label: 'Geofísica' },
  { code: 'DFI', label: 'Física' },
  { code: 'DAS', label: 'Astronomía' },
  { code: 'DIQBM', label: 'Química y Biotecnología' },
  { code: 'DIMEC', label: 'Mecánica' },
  { code: 'DIE', label: 'Eléctrica' },
];

export const UserChipsRow: React.FC<Props> = ({
  user,
  memberships = [],
  sellerProfile,
  ladderRanks = [],
  onOrgPress,
  onSellerPress,
  onLadderPress,
  size = 'md',
  align = 'center',
  style,
}) => {
  if (!user) return null;
  const isSmall = size === 'sm';

  const entryYearText = user.entry_year ? `Gen '${user.entry_year.slice(2)}` : null;
  const deptText = user.department ? user.department : null;

  // Filtrar ladders que tengan show_on_profile en true
  const validLadderRanks = ladderRanks.filter(r => r.show_on_profile !== false && (r.ordinal_rating || r.rating || r.points || r.mu));

  const showKarma = user.type !== 'organization' && Boolean(user.show_karma_on_profile);
  const karmaVal = user.karma || 0;

  const hasAnyChip = entryYearText || deptText || showKarma || memberships.length > 0 || !!sellerProfile || validLadderRanks.length > 0;

  if (!hasAnyChip) return null;

  return (
    <View style={[
      styles.container,
      align === 'left' && { justifyContent: 'flex-start' },
      style
    ]}>
      {/* Pin de Karma */}
      {showKarma && (
        <TouchableOpacity
          style={[styles.chip, isSmall ? styles.chipSm : styles.chipMd, styles.karmaChip]}
          onPress={onLadderPress ? () => onLadderPress('karma') : undefined}
          disabled={!onLadderPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, isSmall ? styles.chipTextSm : styles.chipTextMd, styles.karmaChipText]}>
            Karma {karmaVal}
          </Text>
        </TouchableOpacity>
      )}

      {/* Pin de Año de Ingreso (Generación) */}
      {!!entryYearText && (
        <View style={[styles.chip, isSmall ? styles.chipSm : styles.chipMd, styles.yearChip]}>
          <Text style={[styles.chipText, isSmall ? styles.chipTextSm : styles.chipTextMd, styles.yearChipText]}>
            {entryYearText}
          </Text>
        </View>
      )}

      {/* Pin de Departamento */}
      {!!deptText && (
        <View style={[styles.chip, isSmall ? styles.chipSm : styles.chipMd, styles.deptChip]}>
          <Text style={[styles.chipText, isSmall ? styles.chipTextSm : styles.chipTextMd, styles.deptChipText]}>
            {deptText}
          </Text>
        </View>
      )}



      {/* Chips de ELO / Ladders (1v1 es limpio, 2v2 muestra ícono de duos/colaboración) */}
      {validLadderRanks.map((rank) => {
        const sportName = rank.expand?.ladder?.name || rank.expand?.sport?.name || rank.sportKey || '';
        const sportSlug = rank.expand?.ladder?.slug || rank.sportKey || 'tenis-de-mesa';
        const mode = rank.mode || '1v1';
        const is2v2 = mode.includes('2v2');
        const eloVal = Math.round(rank.ordinal_rating || rank.rating || rank.points || 1200);

        return (
          <TouchableOpacity
            key={rank.id || `${sportSlug}-${mode}`}
            activeOpacity={0.7}
            style={[styles.chip, isSmall ? styles.chipSm : styles.chipMd, styles.ladderChip, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
            onPress={onLadderPress ? () => onLadderPress(sportSlug, mode) : undefined}
            disabled={!onLadderPress}
          >
            <SportIcon name={sportName} slug={sportSlug} size={isSmall ? 11 : 13} color="#38bdf8" />
            {is2v2 && (
              <Feather name="users" size={isSmall ? 10 : 11} color="#38bdf8" style={{ marginLeft: -1, marginRight: 1 }} />
            )}
            <Text style={[styles.chipText, isSmall ? styles.chipTextSm : styles.chipTextMd, styles.ladderChipText]}>
              {eloVal}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Chips de Organizaciones */}
      {memberships.map((m) => {
        const org = m.expand?.organization;
        if (!org) return null;
        return (
          <OrgChip
            key={m.id}
            organization={org}
            size={size}
            onPress={onOrgPress ? () => onOrgPress(org.id) : undefined}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 3,
    marginBottom: 6,
  },
  chipMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chipText: {
    fontWeight: '700',
  },
  chipTextMd: {
    fontSize: 11,
  },
  chipTextSm: {
    fontSize: 10,
  },
  yearChip: {
    borderColor: '#10b981',
    backgroundColor: '#10b98115',
  },
  yearChipText: {
    color: '#10b981',
  },
  deptChip: {
    borderColor: '#8b5cf6',
    backgroundColor: '#8b5cf615',
  },
  deptChipText: {
    color: '#8b5cf6',
  },
  ladderChip: {
    borderColor: '#38bdf8',
    backgroundColor: '#38bdf815',
  },
  ladderChipText: {
    color: '#38bdf8',
  },
  websiteChip: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f615',
  },
  websiteChipText: {
    color: '#3b82f6',
  },
  karmaChip: {
    borderColor: '#f59e0b',
    backgroundColor: '#f59e0b15',
  },
  karmaChipText: {
    color: '#f59e0b',
  },
});
