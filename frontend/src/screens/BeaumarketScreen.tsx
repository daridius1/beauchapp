import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { beaumarketService, BeaumarketMarket } from '../services/beaumarketService';
import { withMinimumDelay } from '../utils/refresh';
import { RootStackParamList } from '../types/navigation';
import { InfoModal } from './beaumarket/InfoModal';
import { styles } from './beaumarket/BeaumarketScreen.styles';

type BeaumarketScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Beaumarket'>;

interface Props {
  navigation: BeaumarketScreenNavigationProp;
}

const STATUS_LABELS: Record<string, string> = { open: 'Abierto', closed: 'Cerrado', resolved: 'Resuelto', cancelled: 'Cancelado' };
const STATUS_COLORS: Record<string, string> = { open: '#22c55e', closed: '#facc15', resolved: '#38bdf8', cancelled: '#ef4444' };
const STATUS_TEXT_STYLES: Record<string, any> = {
  open: styles.statusOpen,
  closed: styles.statusClosed,
  resolved: styles.statusResolved,
  cancelled: styles.statusCancelled,
};

function StatusTag({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.open;
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusLabel, STATUS_TEXT_STYLES[status] || styles.statusOpen]}>{STATUS_LABELS[status] || status}</Text>
    </View>
  );
}

export const BeaumarketScreen: React.FC<Props> = ({ navigation }) => {
  const { user, refreshUser } = useAuth();
  const [markets, setMarkets] = useState<BeaumarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);

  const fetchMarkets = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      const [data] = await Promise.all([beaumarketService.getMarkets(), refreshUser()]);
      setMarkets(data);
    } catch (err) {
      console.error('Error fetching Beaumarket markets:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMarkets();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchMarkets(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, []);

  const handlePullRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchMarkets(true));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Abiertos primero, luego cerrados, luego resueltos/cancelados al final.
  const order: Record<string, number> = { open: 0, closed: 1, resolved: 2, cancelled: 3 };
  const sortedMarkets = [...markets].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handlePullRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      <View style={styles.balanceRow}>
        <View>
          <Text style={styles.balanceLabel}>BeauTokens</Text>
          <Text style={styles.balanceValue}>{user?.beautokens ?? 0} ℬ</Text>
        </View>
        <TouchableOpacity style={styles.infoButton} activeOpacity={0.7} onPress={() => setInfoVisible(true)}>
          <Feather name="info" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {sortedMarkets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Todavía no hay mercados abiertos.</Text>
        </View>
      ) : (
        sortedMarkets.map((m) => {
          const topIdx = m.prices.length > 0 ? m.prices.indexOf(Math.max(...m.prices)) : -1;
          const totalShares = m.myPositions.reduce((sum, p) => sum + p.shares, 0);
          return (
            <TouchableOpacity
              key={m.id}
              style={styles.marketRow}
              activeOpacity={0.7}
              onPress={() => navigation.push('BeaumarketDetail', { marketId: m.id, title: m.title })}
            >
              <View style={styles.marketRowMain}>
                <StatusTag status={m.status} />
                <Text style={styles.marketTitle} numberOfLines={2}>{m.title}</Text>
                <View style={styles.marketMetaRow}>
                  {topIdx >= 0 && (
                    <Text style={styles.marketMetaText} numberOfLines={1}>
                      {m.outcomes[topIdx]} favorito · {m.prices[topIdx].toFixed(0)}%
                    </Text>
                  )}
                  {totalShares > 0 && (
                    <>
                      {topIdx >= 0 && <Text style={styles.marketMetaDivider}>·</Text>}
                      <Text style={styles.marketMetaAccent}>Tus acciones: {totalShares}</Text>
                    </>
                  )}
                </View>
              </View>

              <Feather name="chevron-right" color={theme.colors.textMuted} size={20} />
            </TouchableOpacity>
          );
        })
      )}

      <InfoModal visible={infoVisible} onClose={() => setInfoVisible(false)} />
    </ScrollView>
  );
};
