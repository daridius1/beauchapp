import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types/navigation';
import { ReportModal } from '../components/ReportModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Info'>;

const FAQS = [
  {
    question: '¿Puedo cambiar mi nombre de usuario?',
    answer: 'No hay una opción en la app para editarlo directamente todavía. Mándanos un reporte/sugerencia desde el botón de más abajo contándonos a qué lo quieres cambiar, y te lo actualizamos a mano.',
  },
];

export const InfoScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      {/* Sin sesión (registro) no hay Header compartido con botón atrás — se agrega uno propio.
          Con sesión, el Header de App.tsx ya lo resuelve, así que no se duplica. */}
      {!user && (
        <TouchableOpacity
          style={styles.backRow}
          activeOpacity={0.7}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
        >
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
          <Text style={styles.backRowText}>Volver</Text>
        </TouchableOpacity>
      )}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Qué es Beauchapp</Text>
        <Text style={styles.paragraph}>
          Beauchapp es una plataforma hecha y gestionada por un estudiante de la facultad, pensada como
          un espacio no anónimo que potencie la vida universitaria: pauteo colaborativo, ladders de
          deportes, marketplace, reseñas de ramos y profesores, y más. El no-anonimato existe a propósito,
          para mantener el respeto y la sana convivencia.
        </Text>
        <Text style={styles.paragraph}>
          No pretendemos ganar plata con esto. Es un proyecto comunitario, sin fines de lucro.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Normas de convivencia</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• El trato respetuoso es obligatorio en todo el contenido que se publique.</Text>
          <Text style={styles.bullet}>• Está prohibido difamar, funar, acosar, insultar o incitar a la mala conducta.</Text>
          <Text style={styles.bullet}>• El equipo se reserva el derecho de eliminar contenido y de suspender o eliminar cuentas que incumplan estas normas.</Text>
          <Text style={styles.bullet}>• Si ves algo que no corresponde, repórtalo: en cualquier publicación, comentario, perfil o producto vas a encontrar un botón "⋮" con la opción "Reportar".</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Privacidad y datos</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Se recolecta solo la información mínima necesaria para que la plataforma funcione.</Text>
          <Text style={styles.bullet}>• Compromiso real de no revisar esos datos, salvo lo estrictamente necesario para el funcionamiento técnico, o para colaborar con una investigación académica formal y seria de la universidad.</Text>
          <Text style={styles.bullet}>• Por ejemplo, en Tinder Beauchef guardamos tus likes y matches, es la única forma viable de que esa funcionalidad pueda existir. Hoy no están anonimizados del lado del servidor (por costo técnico de implementación), pero el compromiso de no revisarlos es el mismo que con cualquier otro dato de la plataforma.</Text>
          <Text style={styles.bullet}>• Por eso, por ejemplo, no existe un chat dentro de la app: cualquier contacto se coordina a través de otras plataformas (WhatsApp, Instagram, Telegram, etc.).</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Preguntas frecuentes</Text>
        {FAQS.map((faq, index) => (
          <View key={index} style={[styles.faqItem, index === FAQS.length - 1 && styles.faqItemNoBorder]}>
            <TouchableOpacity
              style={styles.faqHeader}
              activeOpacity={0.7}
              onPress={() => setOpenFaq(openFaq === index ? null : index)}
            >
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <Feather
                name={openFaq === index ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
            {openFaq === index && <Text style={styles.faqAnswer}>{faq.answer}</Text>}
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Contacto</Text>
        <Text style={styles.paragraph}>
          ¿Bugs, problemas o sugerencias? Escríbenos por Telegram a{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://t.me/MatadorMarceloSalas1994')}>
            @MatadorMarceloSalas1994
          </Text>
          , o mándanos un mensaje directo desde acá.
        </Text>

        <TouchableOpacity style={styles.reportBtn} activeOpacity={0.8} onPress={() => setShowReportModal(true)}>
          <Feather name="flag" size={16} color="#000000" style={{ marginRight: 8 }} />
          <Text style={styles.reportBtnText}>Enviar sugerencia o reporte</Text>
        </TouchableOpacity>
      </ScrollView>

      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        heading="Enviar sugerencia o reporte"
        titlePlaceholder='Un resumen corto (ej. "Bug al subir imágenes")'
        messagePlaceholder="Cuéntanos qué bug encontraste, qué te gustaría que agregáramos, o cualquier otra cosa..."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: 60,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  backRowText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
  },
  paragraph: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: theme.spacing.sm,
  },
  bold: {
    fontWeight: '700',
  },
  bulletList: {
    gap: 8,
  },
  bullet: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 12,
  },
  faqItemNoBorder: {
    borderBottomWidth: 0,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  faqAnswer: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: theme.spacing.lg,
  },
  reportBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
