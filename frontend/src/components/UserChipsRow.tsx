import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { User } from '../context/AuthContext';
import { OrgChip } from './OrgChip';
import { OrganizationMemberRecord } from '../services/organizationService';

interface Props {
  user: User;
  memberships?: OrganizationMemberRecord[];
  onOrgPress?: (organizationId: string) => void;
  size?: 'sm' | 'md';
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

export const UserChipsRow: React.FC<Props> = ({ user, memberships = [], onOrgPress, size = 'md' }) => {
  const isSmall = size === 'sm';

  const entryYearText = user.entry_year ? `Gen '${user.entry_year.slice(2)}` : null;
  const deptText = user.department ? user.department : null;

  const hasAnyChip = entryYearText || deptText || memberships.length > 0;

  if (!hasAnyChip) return null;

  return (
    <View style={styles.container}>
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
    marginTop: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    marginRight: 6,
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
  // Año de Ingreso (Emerald / Green)
  yearChip: {
    borderColor: '#10b981',
    backgroundColor: '#10b98115',
  },
  yearChipText: {
    color: '#10b981',
  },
  // Departamento (Purple / Indigo)
  deptChip: {
    borderColor: '#8b5cf6',
    backgroundColor: '#8b5cf615',
  },
  deptChipText: {
    color: '#8b5cf6',
  },
});
