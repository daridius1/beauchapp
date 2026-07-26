import { pb, getFileUrl } from './pocketbase';
import { User } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompressor';

export interface SellerProfileRecord {
  id: string;
  user: string;
  bio?: string;
  wsp_phone?: string;
  instagram_handle?: string;
  telegram_handle?: string;
  signal_phone?: string;
  contact_email?: string;
  recommendations_count: number;
  created: string;
  updated: string;
  expand?: {
    user?: User;
  };
}

export interface MarketplaceItemRecord {
  id: string;
  seller: string;
  user: string;
  title: string;
  description: string;
  price: number;
  category: 'comida' | 'ropa' | 'clases' | 'otros';
  tags?: string[];
  images?: string[];
  status: 'available' | 'unavailable';
  views_count?: number;
  deleted?: boolean;
  created: string;
  updated: string;
  expand?: {
    seller?: SellerProfileRecord;
    user?: User;
  };
}

export const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'grid' },
  { id: 'comida', label: 'Comida', icon: 'coffee', color: '#f59e0b' },
  { id: 'ropa', label: 'Ropa', icon: 'tag', color: '#10b981' },
  { id: 'clases', label: 'Clases Particulares', icon: 'book-open', color: '#6366f1' },
  { id: 'otros', label: 'Otros', icon: 'box', color: '#14b8a6' },
];

export const marketplaceService = {
  // Obtener Perfil de Vendedor por ID de usuario
  getSellerProfile: async (userId: string): Promise<SellerProfileRecord | null> => {
    try {
      const records = await pb.collection('seller_profiles').getList<SellerProfileRecord>(1, 1, {
        filter: `user = "${userId}"`,
        expand: 'user',
      });
      return records.items[0] || null;
    } catch (err) {
      console.error('Error fetching seller profile:', err);
      return null;
    }
  },

  // Obtener Perfil de Vendedor por ID propio del registro de seller_profile
  getSellerProfileById: async (sellerProfileId: string): Promise<SellerProfileRecord | null> => {
    try {
      return await pb.collection('seller_profiles').getOne<SellerProfileRecord>(sellerProfileId, {
        expand: 'user',
      });
    } catch (err) {
      console.error('Error fetching seller profile by ID:', err);
      return null;
    }
  },

  // Crear o actualizar perfil de vendedor
  upsertSellerProfile: async (data: {
    bio?: string;
    wsp_phone?: string;
    instagram_handle?: string;
    telegram_handle?: string;
    signal_phone?: string;
    contact_email?: string;
  }): Promise<SellerProfileRecord> => {
    const user = pb.authStore.model;
    if (!user) throw new Error('Debes estar autenticado para configurar tu perfil de vendedor.');

    const existing = await marketplaceService.getSellerProfile(user.id);

    const payload = {
      user: user.id,
      bio: data.bio || '',
      wsp_phone: data.wsp_phone || '',
      instagram_handle: data.instagram_handle || '',
      telegram_handle: data.telegram_handle || '',
      signal_phone: data.signal_phone || '',
      contact_email: data.contact_email || '',
    };

    if (existing) {
      return await pb.collection('seller_profiles').update<SellerProfileRecord>(existing.id, payload, {
        expand: 'user',
      });
    } else {
      return await pb.collection('seller_profiles').create<SellerProfileRecord>(
        {
          ...payload,
          recommendations_count: 0,
        },
        { expand: 'user' }
      );
    }
  },

  // Verificar si el usuario ha recomendado a este vendedor
  hasUserRecommended: async (sellerProfileId: string): Promise<boolean> => {
    const user = pb.authStore.model;
    if (!user) return false;

    try {
      const records = await pb.collection('seller_recommendations').getList(1, 1, {
        filter: `seller = "${sellerProfileId}" && user = "${user.id}"`,
      });
      return records.items.length > 0;
    } catch (err) {
      return false;
    }
  },

  // Recomendar (+1) o retirar recomendación
  toggleRecommendation: async (sellerProfileId: string): Promise<{ isRecommended: boolean; count: number }> => {
    const user = pb.authStore.model;
    if (!user) throw new Error('Debes estar autenticado para recomendar a un vendedor.');

    const existingRecs = await pb.collection('seller_recommendations').getList(1, 1, {
      filter: `seller = "${sellerProfileId}" && user = "${user.id}"`,
    });

    const seller = await pb.collection('seller_profiles').getOne<SellerProfileRecord>(sellerProfileId);
    let count = seller.recommendations_count || 0;

    if (existingRecs.items.length > 0) {
      // Eliminar recomendación
      await pb.collection('seller_recommendations').delete(existingRecs.items[0].id);
      count = Math.max(0, count - 1);
      await pb.collection('seller_profiles').update(sellerProfileId, { recommendations_count: count });
      return { isRecommended: false, count };
    } else {
      // Crear recomendación
      await pb.collection('seller_recommendations').create({
        seller: sellerProfileId,
        user: user.id,
      });
      count = count + 1;
      await pb.collection('seller_profiles').update(sellerProfileId, { recommendations_count: count });
      return { isRecommended: true, count };
    }
  },

  // Obtener detalle de un producto por ID
  getItemDetail: async (itemId: string): Promise<MarketplaceItemRecord | null> => {
    try {
      return await pb.collection('marketplace_items').getOne<MarketplaceItemRecord>(itemId, {
        expand: 'seller.user,user',
      });
    } catch (err) {
      console.error('Error fetching item detail:', err);
      return null;
    }
  },

  // Obtener publicaciones del Marketplace con filtros
  getMarketplaceItems: async (params: {
    category?: string;
    query?: string;
    tag?: string;
    sellerProfileId?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ items: MarketplaceItemRecord[]; totalPages: number }> => {
    try {
      const page = params.page || 1;
      const perPage = params.perPage || 30;

      let filters: string[] = ['deleted = false'];

      if (params.category && params.category !== 'all') {
        filters.push(`category = "${params.category}"`);
      }

      if (params.sellerProfileId) {
        filters.push(`seller = "${params.sellerProfileId}"`);
      }

      if (params.query && params.query.trim()) {
        const q = params.query.trim();
        filters.push(`(title ~ "${q}" || description ~ "${q}")`);
      }

      const res = await pb.collection('marketplace_items').getList<MarketplaceItemRecord>(page, perPage, {
        filter: filters.join(' && '),
        sort: '-created',
        expand: 'seller.user,user',
      });

      // Filtrado por sub-tag manual en frontend si aplica
      let finalItems = res.items;
      if (params.tag) {
        const targetTag = params.tag.toLowerCase();
        finalItems = res.items.filter((item) =>
          Array.isArray(item.tags) && item.tags.some((t) => t.toLowerCase() === targetTag)
        );
      }

      return {
        items: finalItems,
        totalPages: res.totalPages,
      };
    } catch (err) {
      console.error('Error fetching marketplace items:', err);
      return { items: [], totalPages: 0 };
    }
  },

  // Crear producto (con compresión cliente WebP/JPEG obligatoria por estándar de la app)
  createItem: async (
    data: {
      title: string;
      description: string;
      price: number;
      category: string;
      tags: string[];
    },
    rawImages: File[]
  ): Promise<MarketplaceItemRecord> => {
    const user = pb.authStore.model;
    if (!user) throw new Error('Debes estar autenticado para publicar en el Marketplace.');

    const seller = await marketplaceService.getSellerProfile(user.id);
    if (!seller) {
      throw new Error('Primero debes crear tu Perfil de Vendedor para publicar productos.');
    }

    const formData = new FormData();
    formData.append('seller', seller.id);
    formData.append('user', user.id);
    formData.append('title', data.title.trim());
    formData.append('description', data.description.trim());
    formData.append('price', data.price.toString());
    formData.append('category', data.category);
    formData.append('tags', JSON.stringify(data.tags));
    formData.append('status', 'available');
    formData.append('deleted', 'false');

    // Compresión cliente de imágenes siguiendo la regla estricta de la plataforma
    for (let i = 0; i < rawImages.length; i++) {
      const file = rawImages[i];
      try {
        const compressedBlob = await compressImage(file);
        const compressedFile = new File(
          [compressedBlob],
          file.name.replace(/\.[^/.]+$/, '') + '.webp',
          { type: 'image/webp' }
        );
        formData.append('images', compressedFile);
      } catch (e) {
        // Fallback si falla compresión
        formData.append('images', file);
      }
    }

    return await pb.collection('marketplace_items').create<MarketplaceItemRecord>(formData, {
      expand: 'seller.user,user',
    });
  },

  // Actualizar estado del producto (Disponible / No disponible)
  updateItemStatus: async (itemId: string, status: 'available' | 'unavailable'): Promise<MarketplaceItemRecord> => {
    return await pb.collection('marketplace_items').update<MarketplaceItemRecord>(
      itemId,
      { status },
      { expand: 'seller.user,user' }
    );
  },

  // Soft Delete del producto
  softDeleteItem: async (itemId: string): Promise<void> => {
    await pb.collection('marketplace_items').update(itemId, { deleted: true });
  },

  // Obtener URL de imagen de producto
  getItemImageUrl: (item: MarketplaceItemRecord, filename: string): string => {
    return getFileUrl(item, filename);
  },
};
