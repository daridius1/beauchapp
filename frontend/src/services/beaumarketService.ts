import { pb } from './pocketbase';

export interface BeaumarketPosition {
  outcomeIndex: number;
  shares: number;
  // Neto de ℬ efectivamente gastado en esta posición (suma de "cost" de los trades
  // propios en ese resultado) — siempre <= shares, porque el precio LMSR siempre es
  // menor a 100%. Con esto el front puede mostrar "cuánto llevas invertido" vs. "cuánto
  // recibes si gana" (que siempre es exactamente shares, 1 ℬ por acción).
  costBasis: number;
}

export interface BeaumarketOddsHistoryPoint {
  t: number; // epoch millis, calculado en el backend (ver computeLmsrPriceHistory)
  percentages: number[];
}

export interface BeaumarketMarket {
  id: string;
  title: string;
  description: string;
  outcomes: string[];
  status: 'open' | 'closed' | 'resolved' | 'cancelled';
  winningOutcomeIndex: number | null;
  // Parámetro de liquidez LMSR y el vector de acciones netas en circulación — se exponen
  // para que el modal de compra pueda mostrar una previsualización en vivo del precio
  // (ver lmsrPreview.ts); el cálculo definitivo y autoritativo siempre lo hace el backend.
  b: number;
  q: number[];
  prices: number[]; // 0-100 por resultado, siempre suman ~100
  history?: BeaumarketOddsHistoryPoint[];
  // Una entrada por resultado en el que el usuario tiene acciones vigentes.
  myPositions: BeaumarketPosition[];
}

export const beaumarketService = {
  getMarkets: async (status?: string): Promise<BeaumarketMarket[]> => {
    const qs = status ? `?status=${status}` : '';
    const res = await pb.send<{ markets: BeaumarketMarket[] }>(`/api/beaumarket/markets${qs}`, { method: 'GET' });
    return res.markets;
  },

  // Incluye "history" (la oscilación de precios trade a trade) — no se pide en
  // getMarkets() para no calcularla en cada carga de la lista.
  getMarketDetail: async (marketId: string): Promise<BeaumarketMarket | null> => {
    const res = await pb.send<{ markets: BeaumarketMarket[] }>(`/api/beaumarket/markets?id=${marketId}`, { method: 'GET' });
    return res.markets[0] || null;
  },

  buyShares: async (marketId: string, outcomeIndex: number, budgetPoints: number): Promise<{ success: boolean; shares: number; cost: number }> => {
    return pb.send<{ success: boolean; shares: number; cost: number }>('/api/beaumarket/buy', {
      method: 'POST',
      body: { marketId, outcomeIndex, budgetPoints },
    });
  },

  sellShares: async (marketId: string, outcomeIndex: number, shares: number): Promise<{ success: boolean; shares: number; proceeds: number }> => {
    return pb.send<{ success: boolean; shares: number; proceeds: number }>('/api/beaumarket/sell', {
      method: 'POST',
      body: { marketId, outcomeIndex, shares },
    });
  },
};
