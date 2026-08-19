import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface CommentsHeaderProps {
  /** Título alternativo. Por defecto "Comentarios" (ej. la tienda usa "Muro del Vendedor"). */
  title?: string;
  /** Si viene, se muestra como "Comentarios (n)". Omitir para el título a secas. */
  count?: number;
  /** Texto del botón. Por defecto "Citar". */
  quoteLabel?: string;
  /** Si no viene, no se muestra el botón (ej. contenido eliminado). */
  onQuote?: () => void;
  /** Línea separadora sobre la sección. Por defecto sí. */
  showDivider?: boolean;
}

// Cabecera única de toda sección de comentarios de una entidad (problema, pauta, liga,
// partido, equipo, curso, actividad, producto, tienda, mercado, Beaudle…).
//
// Antes cada pantalla la reimplementaba: el título variaba entre 13, 14 y 18px, el
// `marginBottom` de la fila entre 2 y 12, y —lo que más se notaba— algunas usaban un
// estilo de título que traía su propio `marginBottom`. Dentro de una fila con
// `alignItems: 'center'` ese margen desplaza la caja del texto hacia arriba respecto
// del botón, y por eso el título y "Citar" quedaban a distinta altura según la vista.
//
// La referencia es la sección de comentarios de las pautas, que es la que quedó bien:
// divisor arriba, título grande, botón alineado al centro vertical, y ningún margen
// suelto en el texto. Cualquier vista nueva con comentarios debe usar este componente
// en vez de rearmar la fila.
export const CommentsHeader: React.FC<CommentsHeaderProps> = ({
  title = 'Comentarios',
  count,
  quoteLabel = 'Citar',
  onQuote,
  showDivider = true,
}) => (
  <>
    {showDivider && <View style={styles.divider} />}
    <View style={styles.row}>
      <Text style={styles.title}>
        {count === undefined ? title : `${title} (${count})`}
      </Text>

      {!!onQuote && (
        <TouchableOpacity style={styles.quoteBtn} activeOpacity={0.7} onPress={onQuote}>
          <FontAwesome name="quote-left" size={11} color={theme.colors.text} style={{ marginRight: 6 }} />
          <Text style={styles.quoteBtnText}>{quoteLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  </>
);

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  // Sin marginBottom a propósito: es justamente lo que descentraba el título respecto
  // del botón. El espacio que sigue lo pone `row`.
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  quoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quoteBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
