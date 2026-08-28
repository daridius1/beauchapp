import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Section {
  title: string;
  body: string;
  formulas?: string[];
}

const SECTIONS: Section[] = [
  {
    title: '¿Qué es Beaumarket?',
    body: 'Mercados de predicción para jugar entre la comunidad — se apuesta con BeauTokens (ℬ), una moneda de juego sin valor real. Cada mercado tiene resultados posibles (ej. "Sí" / "No") y un porcentaje para cada uno, que representa qué tan probable cree la comunidad que sea.',
  },
  {
    title: '¿Cómo se mueve el porcentaje?',
    body: 'Es un pozo: todo lo que se apuesta a un resultado se suma a su propio pozo. El porcentaje que ves es exactamente la fracción del pozo total que representa ese resultado — no hay ningún algoritmo de por medio. Apostar a un resultado sube su porcentaje (y baja el de los demás, porque el pozo total creció).',
  },
  {
    title: 'Apostar',
    body: 'Apostar mueve exactamente el monto que escribes al pozo del resultado elegido — nunca cuesta más ni menos que eso. Las apuestas son definitivas: una vez hecha, no se puede retirar ni deshacer, así que piénsalo antes de confirmar.',
  },
  {
    title: '¿Cuánto ganarías?',
    body: 'En "tus apuestas" (debajo de cada resultado que ya jugaste) se muestra una proyección de cuánto recibirías si ese resultado gana, calculada con el pozo tal como está ahora mismo — se sigue moviendo con cada apuesta de cualquiera hasta que el mercado cierra, así que es una estimación, no una promesa. Esa cifra a propósito NO aparece en el momento de apostar: justo ahí sería más fácil de leer como una garantía. Recién al resolverse el mercado, con el pozo ya congelado, esa misma cifra pasa a ser el pago real.',
  },
  {
    title: 'Cierre automático',
    body: 'Cada mercado nace con una fecha de cierre: desde ahí nadie puede seguir apostando, aunque todavía no se sepa el resultado. Un administrador puede cerrarlo antes a mano, pero nunca extender esa fecha.',
  },
  {
    title: 'Al resolverse',
    body: 'Cuando el mercado se resuelve, el pozo TOTAL (de todos los resultados juntos) se reparte entre quienes apostaron al resultado ganador, a prorrata de lo que apostó cada quien. Quien puso una fracción más grande del pozo ganador se lleva una fracción más grande del pozo total. Si un mercado se cancela, cada quien recupera exactamente lo que apostó.',
  },
  {
    title: 'BeauTokens (ℬ)',
    body: 'Todos empiezan con un saldo inicial y reciben una acumulación diaria solo por ser parte de la comunidad. Es plata de juego — la idea es que el pozo de cada mercado se sienta vivo y entretenido de seguir, no ganar algo real.',
  },
  {
    title: 'La matemática: pari-mutuel',
    body: 'Este mecanismo se llama pari-mutuel — el mismo que usan históricamente las apuestas hípicas. Si apostaste "apuesta" ℬ al resultado ganador, y el pozo de ese resultado terminó siendo "pozoGanador" (la suma de tu apuesta y la de todos los que acertaron), tu pago es tu fracción de ese pozo ganador aplicada al pozo total del mercado entero:',
    formulas: ['pago = apuesta · (pozoTotal / pozoGanador)'],
  },
  {
    title: 'La casa nunca gana ni pierde',
    body: 'A diferencia de un market maker automático, acá no hay ningún algoritmo tomando el otro lado de la apuesta: todo lo que entra al pozo sale repartido entre los ganadores. La única excepción es el redondeo — los pagos se redondean siempre hacia abajo, así que puede quedar un resto muy chico sin repartir (nunca al revés, nunca se reparte más de lo que hay).',
  },
];

export const InfoModal: React.FC<InfoModalProps> = ({ visible, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.iconContainer}>
            <Feather name="info" size={22} color="#ffffff" />
          </View>

          <Text style={styles.title}>Cómo funciona Beaumarket</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {SECTIONS.map((s, i) => (
              <View key={s.title} style={[styles.section, i !== SECTIONS.length - 1 && styles.sectionDivider]}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.sectionBody}>{s.body}</Text>
                {s.formulas?.map((f) => (
                  <View key={f} style={styles.formulaBox}>
                    <Text style={styles.formulaText}>{f}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: '#0c0c0c',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  scroll: {
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  section: {
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionBody: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  formulaBox: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  formulaText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    textAlign: 'center',
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
