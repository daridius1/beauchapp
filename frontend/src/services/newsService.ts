import { pb } from './pocketbase';
import { NewsArticle } from '../types/news';

// Lecturas de la sección pública de Noticias — la escritura (generar/editar/publicar)
// vive en el panel de /admin/noticias (news.pb.js), no acá: `news` tiene
// create/update/delete en null a propósito.

export const newsService = {
  async listNews(page: number, perPage = 20): Promise<{ items: NewsArticle[]; totalPages: number }> {
    const result = await pb.collection('news').getList<NewsArticle>(page, perPage, {
      filter: 'status = "published" && deleted = false',
      sort: '-created',
      expand: 'author',
    });
    return { items: result.items, totalPages: result.totalPages };
  },

  async getNews(newsId: string): Promise<NewsArticle> {
    return await pb.collection('news').getOne<NewsArticle>(newsId, { expand: 'author,relatedMatch' });
  },
};
