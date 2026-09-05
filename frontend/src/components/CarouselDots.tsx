import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  count: number;
  activeIndex: number;
}

// Indicador de posición en un carrusel de fotos (Tinder, Mascotas, Música, Películas,
// Videojuegos, Libros), con un chip de fondo oscuro detrás de los puntos para que siempre
// haga contraste — antes iban directo sobre la foto y se perdían contra fondos claros.
export const CarouselDots: React.FC<Props> = ({ count, activeIndex }) => {
  if (count <= 1) return null;
  return (
    <View style={styles.row} pointerEvents="none">
      <View style={styles.chip}>
        {Array.from({ length: count }).map((_, idx) => (
          <View key={idx} style={[styles.dot, idx === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { position: 'absolute', top: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  dotActive: { backgroundColor: '#ffffff', width: 8 },
});
