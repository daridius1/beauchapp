import { pb } from './pocketbase';

export interface BeaumarketPosition {
  outcomeIndex: number;
  amount: number; // ℬ apostados en este resultado
  // Pago proyectado si este resultado gana, al estado ACTUAL del pozo — sigue
  // fluctuando mientras entren más apuestas a cualquier resultado, hasta que el mercado
  // se resuelva (ahí el pozo queda fijo y esta cifra pasa a ser el pago real). Se muestra
  // en la lista de "tus apuestas" (seguimiento de algo ya hecho) pero OJO: nunca en el
  // modal para apostar, que es justo donde sería más engañoso mostrar una promesa fresca.
  estimatedPayout: number;
}

export interface BeaumarketOddsHistoryPoint {
  t: number; // epoch millis, calculado en el backend (ver computePoolHistory)
  percentages: number[];
}

export interface BeaumarketMarket {
  id: string;
  title: string;
  description: string;
  outcomes: string[];
  status: 'open' | 'closed' | 'resolved' | 'cancelled';
  winningOutcomeIndex: number | null;
  closesAt: string; // ISO — fecha de cierre automático de las apuestas
  prices: number[]; // 0-100 por resultado, siempre suman ~100
  history?: BeaumarketOddsHistoryPoint[];
  // Una entrada por resultado en el que el usuario tiene ℬ apostados vigentes.
  myPositions: BeaumarketPosition[];
}

export const beaumarketService = {
  getMarkets: async (status?: string): Promise<BeaumarketMarket[]> => {
    const qs = status ? `?status=${status}` : '';
    const res = await pb.send<{ markets: BeaumarketMarket[] }>(`/api/beaumarket/markets${qs}`, { method: 'GET' });
    return res.markets;
  },

  // Incluye "history" (la oscilación del pozo apuesta a apuesta) — no se pide en
  // getMarkets() para no calcularla en cada carga de la lista.
  getMarketDetail: async (marketId: string): Promise<BeaumarketMarket | null> => {
    const res = await pb.send<{ markets: BeaumarketMarket[] }>(`/api/beaumarket/markets?id=${marketId}`, { method: 'GET' });
    return res.markets[0] || null;
  },

  // Las apuestas son definitivas — no existe un endpoint para retirarlas.
  placeBet: async (marketId: string, outcomeIndex: number, amount: number): Promise<{ success: boolean; amount: number }> => {
    return pb.send<{ success: boolean; amount: number }>('/api/beaumarket/bet', {
      method: 'POST',
      body: { marketId, outcomeIndex, amount },
    });
  },
};
