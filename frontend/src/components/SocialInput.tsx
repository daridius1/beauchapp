import React from 'react';
import { StyleSheet, Text, View, TextInput, StyleProp, ViewStyle, Image } from 'react-native';
import { theme } from '../theme/theme';
import { FontAwesome, Feather } from '@expo/vector-icons';
import { SIGNAL_LOGO_BASE64 } from '../assets/signalLogo';

interface SocialInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  type?: 'instagram' | 'whatsapp' | 'telegram' | 'signal' | 'email' | 'website';
  icon?: React.ReactNode;
  showAtPrefix?: boolean;
  style?: StyleProp<ViewStyle>;
  keyboardType?: any;
}

export const SocialInput: React.FC<SocialInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder = 'usuario',
  type,
  icon,
  showAtPrefix = true,
  style,
  keyboardType = 'default',
}) => {
  const handleChange = (text: string) => {
    const cleaned = type === 'website' ? text : text.replace(/^@+/, '');
    onChangeText(cleaned);
  };

  const cleanPlaceholder = placeholder.replace(/^@+/, '');

  const renderIcon = () => {
    if (type === 'signal') {
      return <Image source={{ uri: SIGNAL_LOGO_BASE64 }} style={{ width: 18, height: 18, borderRadius: 9 }} />;
    }
    if (type === 'instagram') {
      return <FontAwesome name="instagram" size={18} color="#E1306C" />;
    }
    if (type === 'whatsapp') {
      return <FontAwesome name="whatsapp" size={18} color="#25D366" />;
    }
    if (type === 'telegram') {
      return <FontAwesome name="paper-plane" size={16} color="#0088cc" />;
    }
    if (type === 'email') {
      return <FontAwesome name="envelope" size={16} color="#EA4335" />;
    }
    if (type === 'website') {
      return <Feather name="globe" size={18} color="#3b82f6" />;
    }
    return icon;
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrapper}>
        <View style={styles.iconContainer}>{renderIcon()}</View>
        {showAtPrefix && (
          <Text style={styles.atBadgeText}>@</Text>
        )}
        <TextInput
          style={styles.input}
          value={value.replace(/^@+/, '')}
          onChangeText={handleChange}
          placeholder={cleanPlaceholder}
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
  },
  iconContainer: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  atBadgeText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 10,
  },
});
