import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme } from '../theme/theme';

interface SectionHeadingProps {
  title: string;
  /** Espacio por encima. Útil cuando el encabezado abre una sección pegada a la anterior. */
  marginTop?: number;
  /** `lg` para separar bloques grandes dentro de una misma vista (ej. apuestas abiertas
   *  vs. cerradas), donde el encabezado tiene que pesar más que el de una etapa. */
  size?: 'md' | 'lg';
}

// Encabezado de sección: una línea horizontal fina que cruza todo el ancho, cortada en
// el centro por el título.
//
// La línea NO va por debajo del texto: eso dejaba el título colgando de un borde y, en
// una etapa, se leía como el borde superior de la primera fila en vez de como el cierre
// del encabezado. Cruzándolo por detrás, el título queda inscrito en el separador y la
// sección se lee como una unidad. El texto no se superpone a la línea — cada mitad es
// un `flex: 1` que se detiene en el `gap`, así que el trazo nunca pasa por el largo del
// título.
//
// Se usa para las etapas de una liga y para las secciones del perfil de un equipo, que
// son la misma idea de "acá empieza otro bloque".
export const SectionHeading: React.FC<SectionHeadingProps> = ({ title, marginTop, size = 'md' }) => (
  <View style={[styles.row, size === 'lg' && styles.rowLg, marginTop !== undefined && { marginTop }]}>
    <View style={styles.line} />
    <Text style={[styles.title, size === 'lg' && styles.titleLg]}>{title}</Text>
    <View style={styles.line} />
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#222222',
  },
  rowLg: {
    marginTop: 22,
    marginBottom: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  titleLg: {
    fontSize: 16,
    fontWeight: '800',
  },
});
