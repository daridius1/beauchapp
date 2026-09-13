import { pb } from './pocketbase';

// Álbum de figuritas: las rutas custom del backend (album.pb.js) hacen el trabajo
// pesado (agrupar jugadores por equipo cruzando varias ligas, cruzar con lo que ya
// tiene el usuario) — ver PRINCIPLES.md §7.2, no se duplica esa lógica acá.

// El capitán no tiene figurita propia — es directamente el jugador con
// `isCaptain: true`, con su código/foto/count de jugador normal (ver el comentario
// grande al inicio de backend/pb_hooks/album.pb.js). El frontend lo usa para reordenar
// visualmente esa lámina al frente de la lista del equipo, nada más.
export interface AlbumPlayer {
  id: string;
  collectionId: string;
  name: string;
  photo?: string;
  position?: string;
  isCaptain: boolean;
  count: number;
  pasted: boolean;
  code: string;
}

export interface AlbumDT {
  id: string;
  collectionId: string;
  name: string;
  photo?: string;
}

export interface AlbumTeam {
  team: {
    id: string;
    collectionId: string;
    name: string;
    username?: string;
    avatar?: string;
    matchPhoto?: string;
    teamPhoto?: string;
    teamColor?: string;
  };
  number: number;
  // A qué liga pertenece este equipo — un álbum puede juntar varias (ver el
  // comentario grande al inicio de backend/pb_hooks/album.pb.js). `null` si la liga
  // fue borrada. Se usa para agrupar visualmente el selector "ir a una página" por
  // liga (ver buildAlbumSections en LeagueAlbumScreen.tsx) y, con `category`, para el
  // cuadrado de categoría de la lámina de plantel (ver buildTeamSlots ahí mismo):
  // masc/fem/mixto, elegida por liga desde /admin/album (admin_album.pb.js) — "" si
  // el superusuario todavía no la eligió.
  league: { id: string; name: string; category?: string } | null;
  // Escudo y foto de equipo son figuritas coleccionables (count/pasted vienen de
  // album_stickers, igual que un jugador) — ver el comentario grande al inicio de
  // backend/pb_hooks/album.pb.js.
  crestCode: string;
  crestCount: number;
  crestPasted: boolean;
  // La foto de equipo es panorámica y se reparte en 2 figuritas independientes
  // (izquierda/derecha) — cada una con su propio código/count/pasted, hay que
  // conseguir y pegar las 2 por separado (ver el comentario grande al inicio de
  // backend/pb_hooks/album.pb.js).
  photoLeftCode: string;
  photoLeftCount: number;
  photoLeftPasted: boolean;
  photoRightCode: string;
  photoRightCount: number;
  photoRightPasted: boolean;
  // El DT es coleccionable igual que un jugador (count/pasted vienen de
  // album_stickers) — `dt` es null cuando el equipo todavía no tiene entrenador
  // asignado, y en ese caso la lámina de DT directamente no aparece en el álbum (ver
  // buildTeamSlots en LeagueAlbumScreen.tsx), a diferencia de escudo/foto que siempre
  // están.
  dtCode: string;
  dtCount: number;
  dtPasted: boolean;
  dt: AlbumDT | null;
  players: AlbumPlayer[];
}

export interface AlbumData {
  album: { id: string; collectionId: string; name: string; cover?: string; palette?: (string | null)[] };
  packPrice: number;
  packSize: number;
  // Cupos diarios de sobres (ver el comentario grande sobre POST /api/album/buy-pack
  // en backend/pb_hooks/album.pb.js): 3 gratis + 3 comprables por álbum, reseteados a
  // medianoche (huso America/Santiago), más 1 bono si ya completaste el Beaudle de
  // hoy. Todos `null` sin sesión — no hay a quién cobrarle cupo.
  freePacksPerDay: number;
  boughtPacksPerDay: number;
  freeRemaining: number | null;
  boughtRemaining: number | null;
  beaudleBonusAvailable: boolean | null;
  // Por separado de beaudleBonusAvailable: distinguen "todavía no completó el Beaudle
  // de hoy" de "ya reclamó el bono hoy" para el botón que siempre se muestra (ver
  // AlbumLaminasView en LeagueAlbumScreen.tsx).
  beaudleDoneToday: boolean | null;
  beaudleBonusOpened: boolean | null;
  beautokens: number | null;
  teams: AlbumTeam[];
}

export interface DrawnSticker {
  // Para un jugador, apunta a su team_players; para escudo/foto (`special` seteado),
  // apunta directo al equipo (colección users) — mismo par de campos, la única forma
  // de saber cuál es cuál es mirando `special`.
  playerId: string;
  collectionId: string;
  name: string;
  photo?: string;
  position?: string;
  teamName: string;
  teamColor?: string;
  // Mismo escudo que usa la grilla del álbum para el badge de jugador/DT (ver
  // buildTeamSlots en LeagueAlbumScreen) — con esto el modal de "abrir sobre" arma el
  // mismo thumb en vez de mostrar la lámina sin nombre/escudo arriba.
  teamId: string;
  teamCollectionId: string;
  teamCrestFile: string;
  // Solo la mitad de plantel la usa (cuadrado de categoría, ver StickerCard) — "" si
  // la liga todavía no tiene categoría elegida en /admin/album.
  teamCategory?: string;
  code: string;
  isNew: boolean;
  special?: 'crest' | 'photo-left' | 'photo-right' | 'dt';
}

export interface BuyPackResult {
  drawn: DrawnSticker[];
  beautokens: number;
}

// Una propuesta de intercambio. `offerCodes` son las láminas que puso quien propuso;
// `counterCodes` las que eligió la otra persona, vacío hasta que responde. Los códigos
// van repetidos cuando se ofrecen varias copias de la misma figurita — la cantidad es
// parte de la oferta.
//
// El backend NO resuelve nombre/foto/equipo de esos códigos (ver album_trades.pb.js):
// la pantalla los cruza contra el `AlbumData` que ya tiene cargado, así que acá solo
// viajan los códigos crudos + la contraparte.
//
//   pending   → falta que la otra persona elija qué dar
//   countered → ya eligió, falta que quien propuso confirme
//
// `accepted` no aparece nunca en esta lista: el backend solo devuelve las abiertas.
export interface TradeCounterparty {
  id: string;
  collectionId: string;
  name: string;
  username?: string;
  avatar?: string;
}

export type TradeStatus = 'pending' | 'countered';

export interface TradeProposal {
  id: string;
  status: TradeStatus;
  offerCodes: string[];
  counterCodes: string[];
  created: string;
  counterparty: TradeCounterparty | null;
}

export interface TradeList {
  incoming: TradeProposal[];
  outgoing: TradeProposal[];
}

export const albumService = {
  async getAlbum(albumId: string): Promise<AlbumData> {
    return await pb.send('/api/album', { method: 'GET', query: { id: albumId } });
  },

  async buyPack(albumId: string, kind: 'free' | 'bought' | 'beaudle-bonus'): Promise<BuyPackResult> {
    return await pb.send('/api/album/buy-pack', { method: 'POST', body: { albumId, kind } });
  },

  async pasteSticker(albumId: string, code: string): Promise<{ success: boolean }> {
    return await pb.send('/api/album/paste', { method: 'POST', body: { albumId, code } });
  },

  async getTrades(albumId: string): Promise<TradeList> {
    return await pb.send('/api/album/trades', { method: 'GET', query: { albumId } });
  },

  // Solo se ofrece; no se pide nada puntual a cambio (ver el comentario grande al
  // inicio de backend/pb_hooks/album_trades.pb.js). `offerCodes` lleva el código
  // repetido tantas veces como copias de esa figurita se ofrezcan.
  async proposeTrade(albumId: string, toUserId: string, offerCodes: string[]): Promise<{ success: boolean; tradeId: string }> {
    return await pb.send('/api/album/trades', { method: 'POST', body: { albumId, toUserId, offerCodes } });
  },

  // Códigos que la OTRA parte YA tiene en el álbum. Se pide al abrir el armado de la
  // contraoferta, para marcar cuáles de las propias le faltan y no devolverle algo que
  // ya tiene. El complemento (lo que le falta) lo saca la pantalla sola, que ya conoce
  // el checklist completo.
  async getCounterpartyStock(tradeId: string): Promise<{ ownedCodes: string[] }> {
    return await pb.send('/api/album/trades/counterparty-stock', { method: 'GET', query: { tradeId } });
  },

  // Responder una propuesta recibida con exactamente la misma cantidad de láminas.
  async counterTrade(tradeId: string, counterCodes: string[]): Promise<{ success: boolean }> {
    return await pb.send('/api/album/trades/counter', { method: 'POST', body: { tradeId, counterCodes } });
  },

  // Último paso, solo para quien propuso: acá recién se mueven las láminas.
  async confirmTrade(tradeId: string): Promise<{ success: boolean }> {
    return await pb.send('/api/album/trades/confirm', { method: 'POST', body: { tradeId } });
  },

  // Cancelar, rechazar o desistir — las tres son lo mismo (borrar la propuesta) y las
  // pueden hacer las dos partes mientras no esté confirmada.
  async cancelTrade(tradeId: string): Promise<{ success: boolean }> {
    return await pb.send('/api/album/trades/cancel', { method: 'POST', body: { tradeId } });
  },

  // Personas a las que proponerles un intercambio. Sin filtrar por `type`: las cuentas
  // de equipo también abren sobres y coleccionan, y el backend acepta una propuesta a
  // cualquier cuenta — el buscador tiene que ofrecer exactamente a quien se le puede
  // proponer, no menos. La listRule de `users` ya excluye a quien bloqueó o fue
  // bloqueado, así que eso no hace falta filtrarlo acá (y el backend lo revalida igual
  // al proponer).
  async searchTradePartners(query: string): Promise<TradeCounterparty[]> {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];
    const res = await pb.collection('users').getList<any>(1, 20, {
      filter: `name ~ "${clean}" || username ~ "${clean}"`,
      sort: 'name',
      fields: 'id,collectionId,name,username,avatar',
    });
    return res.items as TradeCounterparty[];
  },
};
