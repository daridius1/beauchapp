import { StyleSheet } from 'react-native';

// Estilo base compartido por TODOS los "chips" de perfil (Karma, BeauTokens, Racha,
// Generación, Departamento, Ladders/ELO, Organización) — vive acá aparte para que
// UserChipsRow.tsx y OrgChip.tsx nunca puedan divergir en tamaño/espaciado como pasó
// antes (OrgChip tenía su propio marginRight+padding ligeramente distinto al del resto,
// así que quedaba más separado/alto que los demás chips de la misma fila). Cualquier
// chip de perfil nuevo debe usar esto en vez de definir sus propios valores.
export const chipBaseStyles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 3,
    marginBottom: 6,
  },
  chipMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chipText: {
    fontWeight: '700',
  },
  chipTextMd: {
    fontSize: 11,
  },
  chipTextSm: {
    fontSize: 10,
  },
});
