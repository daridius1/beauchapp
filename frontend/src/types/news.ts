// Tipo de la colección `news` — noticias generadas (con ayuda de IA) por una cuenta
// de organización subtype=media. Ver news.pb.js y create_news.js.

import { OrgAccountRef, LeagueMatch } from './league';

export type NewsStatus = 'draft' | 'published';

export interface NewsArticle {
  id: string;
  title: string;
  body: string;
  coverImage?: string;
  author: string;
  relatedMatch?: string;
  status: NewsStatus;
  sourcesUsed?: string[];
  deleted?: boolean;
  created: string;
  updated: string;
  expand?: {
    author?: OrgAccountRef;
    relatedMatch?: LeagueMatch;
  };
}
