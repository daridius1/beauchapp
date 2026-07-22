export interface CategoryOption {
  id: string; // e.g. '1v1', '2v2'
  label: string; // e.g. '1v1', '2v2'
  slug: string; // e.g. 'tenis-de-mesa'
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
      { id: '1v1', label: '1v1', slug: 'tenis-de-mesa' },
      { id: '2v2', label: '2v2', slug: 'tenis-de-mesa' },
    ],
  },
  {
    groupSlug: 'taca-taca',
    groupName: 'Taca Taca',
    categories: [
      { id: '1v1', label: '1v1', slug: 'taca-taca' },
      { id: '2v2', label: '2v2', slug: 'taca-taca' },
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
  const cleanSlug = slugInput.replace(/-(1v1|2v2)$/, '');
  const group = LADDER_GROUPS.find(g => g.groupSlug === cleanSlug) || LADDER_GROUPS[0];
  
  // Si venía un modo en el slug original (ej. tenis-de-mesa-2v2)
  const modeMatch = slugInput.match(/-(1v1|2v2)$/);
  const activeMode = modeMatch ? modeMatch[1] : (group.categories[0].id);
  const activeCategory = group.categories.find(c => c.id === activeMode) || group.categories[0];

  return { group, activeCategory };
};
