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
    body: 'Mercados de predicción para jugar entre la comunidad — se apuesta con BeauTokens (ℬ), una moneda de juego sin valor real. Cada mercado tiene resultados posibles (ej. "Sí" / "No") y un precio para cada uno, que representa qué tan probable cree la comunidad que sea.',
  },
  {
    title: '¿Cómo se mueve el precio?',
    body: 'No es un pozo que se reparte: el precio lo fija un algoritmo automático (market maker) en función de cuánta gente compró cada resultado. Comprar un resultado sube su precio; venderlo lo baja. Por eso el precio se mueve solo, sin tener que esperar a que otra persona apueste.',
  },
  {
    title: 'Comprar y vender',
    body: 'Comprar acciones de un resultado cuesta puntos según el precio actual — mientras más gente compra ese lado, más caro se pone. Puedes vender tus acciones en cualquier momento antes de que el mercado se resuelva, al precio que tenga en ese momento (puede ser más o menos de lo que pagaste).',
  },
  {
    title: 'Al resolverse',
    body: 'Cuando el mercado se resuelve, cada acción del resultado ganador vale exactamente 1 ℬ — sin importar a qué precio la compraste. Las acciones del resultado que no ganó valen 0. Si un mercado se cancela, se reembolsa 1 ℬ por acción sin importar el resultado.',
  },
  {
    title: 'BeauTokens (ℬ)',
    body: 'Todos empiezan con un saldo inicial y reciben una acumulación diaria solo por ser parte de la comunidad. Es plata de juego — la idea es que el gráfico de cada mercado se sienta vivo y entretenido de seguir, no ganar algo real.',
  },
  {
    title: 'La matemática: LMSR',
    body: 'El mecanismo se llama LMSR (Logarithmic Market Scoring Rule). Cada mercado guarda un vector q = [q₁, q₂, ...], con la cantidad neta de acciones compradas de cada resultado (arranca en todo ceros), y un número b elegido por quien crea el mercado — la "liquidez": con b bajo el precio se mueve fuerte y rápido; con b alto hace falta mucho volumen para moverlo. De ahí sale una función de costo:',
    formulas: ['C(q) = b · ln( Σᵢ e^(qᵢ /b) )'],
  },
  {
    title: 'El precio de cada resultado',
    body: 'El precio que ves (la probabilidad implícita) es la derivada de esa función de costo — siempre da un número entre 0% y 100%, y los precios de todos los resultados de un mercado siempre suman 100%:',
    formulas: ['pᵢ = e^(qᵢ /b) / Σⱼ e^(qⱼ /b)'],
  },
  {
    title: 'Costo de comprar o vender',
    body: 'Comprar k acciones del resultado i mueve q así: qᵢ → qᵢ + k. Lo que pagas (o recibes, si vendes con k negativo) es la diferencia de costo entre el "antes" y el "después" — nunca un precio fijo, siempre recalculado en el momento contra el estado real del mercado:',
    formulas: ['costo = C(q después) − C(q antes)'],
  },
  {
    title: 'El redondeo siempre juega en tu contra',
    body: 'Como los ℬ son enteros, cada operación se redondea: al comprar, el costo se redondea hacia arriba; al vender, lo que recibes se redondea hacia abajo. Es a propósito — así ni comprando ni vendiendo en pedacitos muy chicos se puede sacar ventaja del redondeo. De hecho, partir una operación grande en muchas chicas siempre sale más caro (o rinde menos), nunca más barato.',
  },
  {
    title: 'Pérdida máxima garantizada',
    body: 'No importa qué tan hábil sea la gente operando: la pérdida máxima posible del sistema en un mercado está acotada desde que se crea, en función de b y de la cantidad de resultados n:',
    formulas: ['pérdida máxima = b · ln(n)'],
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
