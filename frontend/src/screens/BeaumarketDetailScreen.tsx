import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { beaumarketService, BeaumarketMarket } from '../services/beaumarketService';
import { withMinimumDelay } from '../utils/refresh';
import { RootStackParamList } from '../types/navigation';
import { OddsChart } from './beaumarket/OddsChart';
import { TradeModal } from './beaumarket/TradeModal';
import { styles } from './beaumarket/BeaumarketDetail.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'BeaumarketDetail'>;

export const BeaumarketDetailScreen: React.FC<Props> = ({ route }) => {
  const { marketId } = route.params;
  const { user, refreshUser } = useAuth();

  const [market, setMarket] = useState<BeaumarketMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tradeOutcome, setTradeOutcome] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarket = async (hideLoading = false) => {
    try {
      if (!hideLoading) setLoading(true);
      const [detail] = await Promise.all([beaumarketService.getMarketDetail(marketId), refreshUser()]);
      setMarket(detail);
    } catch (err) {
      console.error('Error fetching Beaumarket market:', err);
    } finally {
      if (!hideLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMarket();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketId])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onGlobalRefresh', async () => {
      setLoading(true);
      await withMinimumDelay(() => fetchMarket(true));
      setLoading(false);
    });
    return () => sub.remove();
  }, []);

  const handlePullRefresh = async () => {
    setRefreshing(true);
    await withMinimumDelay(() => fetchMarket(true));
  };

  const handleBuy = async (budgetPoints: number) => {
    if (tradeOutcome === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await beaumarketService.buyShares(marketId, tradeOutcome, budgetPoints);
      // El modal se queda abierto (comprar y vender conviven en el mismo modal) — solo
      // se refresca el mercado para que el saldo, el precio y "tienes X acciones" queden
      // al día para la próxima operación.
      await fetchMarket(true);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'No se pudo completar la compra.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSell = async (shares: number) => {
    if (tradeOutcome === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await beaumarketService.sellShares(marketId, tradeOutcome, shares);
      await fetchMarket(true);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'No se pudo completar la venta.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeTradeModal = () => {
    setTradeOutcome(null);
    setError(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!market) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se encontró este mercado.</Text>
      </View>
    );
  }

  // Se puede seguir comprando/vendiendo mientras el mercado esté abierto — el precio se
  // mueve solo con la actividad de trading, así que siempre hay motivo para volver.
  const canTrade = market.status === 'open';
  const heldShares = tradeOutcome !== null
    ? market.myPositions.find((p) => p.outcomeIndex === tradeOutcome)?.shares ?? 0
    : 0;

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
      <Text style={styles.title}>{market.title}</Text>
      {!!market.description && <Text style={styles.description}>{market.description}</Text>}

      {market.history && market.history.length > 0 && (
        <>
          <View style={styles.divider} />
          <OddsChart
            outcomes={market.outcomes}
            history={market.history}
            winningOutcomeIndex={market.winningOutcomeIndex}
            status={market.status}
            myPositions={market.myPositions}
            onSelectOutcome={canTrade ? setTradeOutcome : undefined}
            disabled={submitting}
          />
        </>
      )}

      <TradeModal
        visible={tradeOutcome !== null}
        outcomeLabel={tradeOutcome !== null ? market.outcomes[tradeOutcome] : null}
        outcomeIndex={tradeOutcome}
        q={market.q}
        b={market.b}
        balance={user?.beautokens ?? 0}
        heldShares={heldShares}
        submitting={submitting}
        error={error}
        onBuy={handleBuy}
        onSell={handleSell}
        onClose={closeTradeModal}
      />
    </ScrollView>
  );
};
