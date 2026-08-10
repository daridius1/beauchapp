import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { styles } from './TinderScreen.styles';

interface TinderRulesPanelProps {
  savingProfile: boolean;
  onActivate: () => void;
  onInfoPress: () => void;
}

export const TinderRulesPanel: React.FC<TinderRulesPanelProps> = ({ savingProfile, onActivate, onInfoPress }) => (
  <View style={styles.inlineRuleBox}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
      <Text style={[styles.ruleTitle, { marginBottom: 0 }]}>Reglas de Tinder Beauchef</Text>
      <TouchableOpacity style={styles.infoButtonInline} activeOpacity={0.7} onPress={onInfoPress}>
        <Feather name="info" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>
    </View>
    <View style={styles.ruleItem}>
      <Feather name="shield" size={14} color={theme.colors.primary} />
      <Text style={styles.ruleItemText}>Tus datos de contacto estarán 100% ocultos hasta hacer match mutuo.</Text>
    </View>
    <View style={styles.ruleItem}>
      <Feather name="clock" size={14} color={theme.colors.primary} />
      <Text style={styles.ruleItemText}>Una vez que lo actives, no podrás desactivarlo por 24 horas.</Text>
    </View>

    <TouchableOpacity
      style={styles.bigActivateBtn}
      onPress={onActivate}
      disabled={savingProfile}
    >
      {savingProfile ? (
        <ActivityIndicator color="#000" />
      ) : (
        <Text style={styles.bigActivateBtnText}>Activar Tinder Beauchef</Text>
      )}
    </TouchableOpacity>
  </View>
);
