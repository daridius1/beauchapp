export interface CategoryOption {
  id: string; // e.g. '1v1', '2v2'
  label: string; // e.g. '1v1', '2v2'
  slug: string; // e.g. 'tenis-de-mesa-1v1'
}

export interface SportGroup {
  groupSlug: string; // e.g. 'tenis-de-mesa', 'taca-taca', 'tiptap'
  groupName: string; // e.g. 'Tenis de Mesa', 'Taca Taca', 'TipTap'
  categories: CategoryOption[];
}

export const LADDER_GROUPS: SportGroup[] = [
  {
    groupSlug: 'tenis-de-mesa',
    groupName: 'Tenis de Mesa',
    categories: [
      { id: '1v1', label: '1v1', slug: 'tenis-de-mesa-1v1' },
      { id: '2v2', label: '2v2', slug: 'tenis-de-mesa-2v2' },
    ],
  },
  {
    groupSlug: 'taca-taca',
    groupName: 'Taca Taca',
    categories: [
      { id: '1v1', label: '1v1', slug: 'taca-taca-1v1' },
      { id: '2v2', label: '2v2', slug: 'taca-taca-2v2' },
    ],
  },
  {
    groupSlug: 'tiptap',
    groupName: 'TipTap',
    categories: [
      { id: '1v1', label: '1v1', slug: 'tiptap' },
    ],
  },
];

export const getSportGroup = (slugInput: string): { group: SportGroup; activeCategory: CategoryOption } => {
  // Buscar coincidencia exacta por slug de categoría
  for (const group of LADDER_GROUPS) {
    const cat = group.categories.find(c => c.slug === slugInput);
    if (cat) return { group, activeCategory: cat };
  }

  // Si slugInput es 'tenis-de-mesa' o 'taca-taca' antiguo
  if (slugInput === 'tenis-de-mesa') {
    const group = LADDER_GROUPS.find(g => g.groupSlug === 'tenis-de-mesa')!;
    return { group, activeCategory: group.categories[0] };
  }
  if (slugInput === 'taca-taca') {
    const group = LADDER_GROUPS.find(g => g.groupSlug === 'taca-taca')!;
    return { group, activeCategory: group.categories[1] || group.categories[0] }; // default 2v2 for taca taca
  }

  // Fallback
  const group = LADDER_GROUPS[0];
  return { group, activeCategory: group.categories[0] };
};
