import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, TextInputProps, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';
import { pb } from '../services/pocketbase';
import { Avatar } from './Avatar';

interface UserSuggestion {
  id: string;
  collectionId: string;
  name?: string;
  username?: string;
  avatar?: string;
}

// Reemplazo drop-in de TextInput (mismas props) que detecta "@" mientras se escribe y
// sugiere usuarios para etiquetar — usado tanto en el compositor de posts (HomeScreen) como
// en la caja de comentarios reutilizable (EntityCommentBox), así el autocompletado se
// comporta igual en toda la app sin duplicar la lógica de detección/búsqueda dos veces.
export const MentionTextInput: React.FC<TextInputProps> = ({ value, onChangeText, ...rest }) => {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const text = value || '';

  // Query activa = lo que sigue al último "@" precedido de inicio/espacio, hasta el
  // cursor, siempre que no haya espacios de por medio (si los hay, ya no es la mención
  // que se está escribiendo ahora mismo).
  const getActiveQuery = (): string | null => {
    if (selection.start !== selection.end) return null;
    const uptoCursor = text.slice(0, selection.start);
    const match = uptoCursor.match(/(?:^|\s)@([a-zA-Z0-9_.-]{0,20})$/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    const query = getActiveQuery();

    if (query === null) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const myRequestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const safeQuery = query.replace(/["\\]/g, '');
        const filter = safeQuery ? `username ~ "${safeQuery}" || name ~ "${safeQuery}"` : '';
        const res = await pb.collection('users').getList<UserSuggestion>(1, 6, {
          filter,
          sort: 'username',
          fields: 'id,collectionId,name,username,avatar',
        });
        if (myRequestId === requestIdRef.current) {
          setSuggestions(res.items);
        }
      } catch (err) {
        console.error('Error fetching mention suggestions:', err);
      } finally {
        if (myRequestId === requestIdRef.current) setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, selection.start, selection.end]);

  const handleSelectSuggestion = (u: UserSuggestion) => {
    const uptoCursor = text.slice(0, selection.start);
    const atIndex = uptoCursor.lastIndexOf('@');
    if (atIndex === -1) return;

    const username = u.username || '';
    const newText = text.slice(0, atIndex) + '@' + username + ' ' + text.slice(selection.start);
    const newCursor = atIndex + username.length + 2;

    onChangeText && onChangeText(newText);
    setSelection({ start: newCursor, end: newCursor });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <View style={styles.wrapper}>
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={(e) => {
          setSelection(e.nativeEvent.selection);
          rest.onSelectionChange && rest.onSelectionChange(e);
        }}
      />

      {showSuggestions && (loading || suggestions.length > 0) && (
        <View style={styles.dropdown}>
          {loading && suggestions.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            suggestions.map((u, idx) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.suggestionRow, idx === suggestions.length - 1 && styles.suggestionRowLast]}
                activeOpacity={0.7}
                onPress={() => handleSelectSuggestion(u)}
              >
                <Avatar user={u} size={28} />
                <View style={styles.suggestionTextCol}>
                  <Text style={styles.suggestionName} numberOfLines={1}>{u.name || 'Usuario'}</Text>
                  <Text style={styles.suggestionUsername} numberOfLines={1}>@{u.username}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  dropdown: {
    backgroundColor: theme.colors.cardBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  loadingRow: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionRowLast: {
    borderBottomWidth: 0,
  },
  suggestionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  suggestionName: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionUsername: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
});
