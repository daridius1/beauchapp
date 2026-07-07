import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle, ScrollView, Platform } from 'react-native';
import { pb } from '../services/pocketbase';
import { theme } from '../theme/theme';

interface UserSearchAutocompleteProps {
  onSelectUser: (user: any) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  buttonText?: string;
  onButtonPress?: (username: string) => void;
  isProcessing?: boolean;
}

export const UserSearchAutocomplete: React.FC<UserSearchAutocompleteProps> = ({
  onSelectUser,
  placeholder = "Busca por @username o nombre",
  style,
  containerStyle,
  buttonText = "Añadir",
  onButtonPress,
  isProcessing = false,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const trimmedQuery = query.trim().toLowerCase();
      if (trimmedQuery.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        setLoading(true);
        const result = await pb.collection('users').getList(1, 5, {
          filter: `username ~ "${trimmedQuery}" || name ~ "${trimmedQuery}"`,
          sort: 'username'
        });
        setSuggestions(result.items);
        setShowSuggestions(true);
      } catch (error) {
        console.error("User search error:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (user: any) => {
    setQuery('');
    setShowSuggestions(false);
    onSelectUser(user);
  };

  const handlePressButton = () => {
    if (onButtonPress && query.trim()) {
      onButtonPress(query.trim());
      setQuery('');
      setShowSuggestions(false);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, style]}
          placeholder={placeholder}
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
        />
        {onButtonPress && (
          <TouchableOpacity 
            style={[styles.button, isProcessing && styles.buttonDisabled]}
            onPress={handlePressButton}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.buttonText}>{buttonText}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && (
        <View style={styles.suggestionsWrapper}>
          {loading && suggestions.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : suggestions.length > 0 ? (
            <ScrollView 
              style={styles.suggestionsContainer} 
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {suggestions.map(s => (
                <TouchableOpacity 
                  key={s.id} 
                  style={styles.suggestionItem}
                  onPress={() => handleSelect(s)}
                >
                  <Text style={styles.suggestionName}>{s.name || s.username}</Text>
                  <Text style={styles.suggestionUsername}>@{s.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : query.length >= 2 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No se encontraron usuarios</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    zIndex: 1000,
    ...(Platform.OS === 'web' && { zIndex: 1000 } as any),
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    color: theme.colors.text,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    height: 40,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  suggestionsWrapper: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    maxHeight: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }
    }),
  },
  suggestionsContainer: {
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionName: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  suggestionUsername: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
});
