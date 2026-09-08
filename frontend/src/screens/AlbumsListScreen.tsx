import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, DeviceEventEmitter } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { pb, getFileUrl } from '../services/pocketbase';
import { RootStackParamList } from '../types/navigation';
import { withMinimumDelay } from '../utils/refresh';

type Props = NativeStackScreenProps<RootStackParamList, 'AlbumsList'>;

// Entrada global a los álbumes de figuritas.
//
// Un álbum puede juntar varias ligas (ver admin_album.pb.js) y no pertenece a ninguna
// en particular, así que —a diferencia de la Beaupolla, que sí lista ligas— acá se
// lista directamente la colección `albums`. Mismo motivo que PollasListScreen: sin
// esta entrada, un álbum solo se encuentra entrando primero a una de sus ligas.
export const AlbumsListScreen: React.FC<Props> = ({ navigation }) => {
  const [albums, setAlbums] = useState<{ id: string; name: string; cover?: string; collectionId?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlbums = useCallback(async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      await withMinimumDelay(async () => {
        const res = await pb.collection('albums').getFullList({
          filter: 'enabled = true',
          sort: 'name',
        });
        setAlbums(res as any[]);
      }, 400);
    } catch (err) {
      console.error('Error cargando los álbumes:', err);
    } finally {
      if (!hideLoading) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAlbums();
    }, [fetchAlbums])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await fetchAlbums(true);
      setLoading(false);
    });
    return () => sub.remove();
  }, [fetchAlbums]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {albums.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="book" size={24} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>Todavía no hay ningún álbum activo</Text>
          <Text style={styles.emptySub}>Cuando el administrador active uno, va a aparecer acá.</Text>
        </View>
      ) : (
        albums.map((album, idx) => (
          <TouchableOpacity
            key={album.id}
            style={[styles.row, idx === albums.length - 1 && styles.rowLast]}
            activeOpacity={0.7}
            onPress={() => navigation.push('LeagueAlbum', { albumId: album.id, name: album.name })}
          >
            <View style={styles.icon}>
              {album.cover ? (
                // expo-image en vez del <Image> de react-native (el resto de la app lo usa) porque
                // acá sí importa la caché real en disco entre aperturas — la portada es la misma
                // en cada visita al listado, no tiene sentido volver a bajarla cada vez.
                <Image
                  source={{ uri: getFileUrl(album, album.cover, '100x100') }}
                  style={styles.iconImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Feather name="book" size={18} color={theme.colors.text} />
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{album.name}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 60 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  rowLast: { borderBottomWidth: 0 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: '100%', height: '100%' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  emptyContainer: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  emptySub: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 17 },
});
