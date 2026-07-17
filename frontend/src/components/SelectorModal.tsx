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
} from 'react-native';
import { theme } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

interface SelectorModalProps {
  visible: boolean;
  title: string;
  placeholder: string;
  suggestions: string[];
  allowCustom?: boolean;
  onSelect: (val: string, isCustom: boolean) => void;
  onClose: () => void;
}

export const SelectorModal: React.FC<SelectorModalProps> = ({
  visible,
  title,
  placeholder,
  suggestions,
  allowCustom = false,
  onSelect,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Resetear búsqueda cuando se abre el modal
  useEffect(() => {
    if (visible) {
      setSearch('');
    }
  }, [visible]);

  const cleanSearch = search.trim();
  const filtered = suggestions.filter(s =>
    cleanSearch === '' || s.toLowerCase().includes(cleanSearch.toLowerCase())
  );

  const exactMatch = suggestions.some(s => s.toLowerCase() === cleanSearch.toLowerCase());

  const handleSelect = (item: string, isCustom: boolean) => {
    onSelect(item, isCustom);
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
                autoCapitalize={title.includes('Ramo') ? 'characters' : 'none'}
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
              {!allowCustom && (
                <TouchableOpacity
                  style={[styles.item, { backgroundColor: 'rgba(255, 255, 255, 0.02)' }]}
                  onPress={() => handleSelect('', false)}
                >
                  <Feather name="minus" size={14} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={[styles.itemText, { color: theme.colors.textMuted }]}>Cualquiera (Limpiar filtro)</Text>
                </TouchableOpacity>
              )}

              {filtered.map(item => (
                <TouchableOpacity
                  key={item}
                  style={styles.item}
                  onPress={() => handleSelect(item, false)}
                >
                  <Feather name="chevron-right" size={14} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.itemText}>{item}</Text>
                </TouchableOpacity>
              ))}

              {/* Opción de agregar si está permitido y no hay coincidencia exacta */}
              {allowCustom && cleanSearch.length > 0 && !exactMatch && (
                <TouchableOpacity
                  style={[styles.item, styles.customItem]}
                  onPress={() => {
                    const finalVal = title.includes('Ramo') || title.includes('Instancia') 
                      ? cleanSearch.toUpperCase() 
                      : cleanSearch;
                    handleSelect(finalVal, true);
                  }}
                >
                  <Feather name="plus" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.customItemText}>
                    Agregar "{title.includes('Ramo') || title.includes('Instancia') ? cleanSearch.toUpperCase() : cleanSearch}"
                  </Text>
                </TouchableOpacity>
              )}

              {filtered.length === 0 && (!allowCustom || cleanSearch.length === 0) && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No se encontraron opciones</Text>
                </View>
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
    minHeight: 300,
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
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    padding: 0,
  },
  list: {
    maxHeight: 350,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  itemText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  customItem: {
    backgroundColor: 'rgba(56, 189, 248, 0.04)',
    borderBottomColor: 'rgba(56, 189, 248, 0.1)',
  },
  customItemText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
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
