import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'InstallApp'>;

type DetectedPlatform = 'ios-safari' | 'ios-other' | 'android-chrome' | 'android-other' | 'desktop-chrome' | 'desktop-safari' | 'desktop-other';

function detectPlatform(): DetectedPlatform {
  if (typeof navigator === 'undefined') return 'desktop-other';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome|CriOS/.test(ua) && !/Edg|OPR/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Android/.test(ua);

  if (isIOS) return isSafari ? 'ios-safari' : 'ios-other';
  if (isAndroid) return isChrome ? 'android-chrome' : 'android-other';
  return isChrome ? 'desktop-chrome' : isSafari ? 'desktop-safari' : 'desktop-other';
}

// Traduce el navegador/OS detectado a cuál de las 4 guías de abajo abrir automáticamente. Para
// navegadores no estándar (Firefox, Samsung Internet, etc.) no hay una guía 1:1, así que no se
// auto-abre ninguna y en su lugar se muestra la nota genérica de "otro navegador".
function detectedSectionId(platform: DetectedPlatform): string | null {
  switch (platform) {
    case 'ios-safari': return 'ios-safari';
    case 'desktop-safari': return 'mac-safari';
    case 'android-chrome': return 'android-chrome';
    case 'desktop-chrome': return 'desktop-chrome';
    default: return null;
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return !!(mq || iosStandalone);
}

interface Step {
  text: string;
}

interface Section {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  steps: Step[];
  note?: string;
}

// Instrucciones verificadas contra documentación oficial (Apple Support, MDN, web.dev) — ver
// contexto de esta sesión. macOS Safari SÍ soporta instalar (Safari 17 / Sonoma en adelante vía
// "Añadir al Dock"), a diferencia de lo que se solía asumir.
const SECTIONS: Section[] = [
  {
    id: 'ios-safari',
    label: 'iPhone / iPad — Safari',
    icon: 'smartphone',
    steps: [
      { text: 'Abre beauchapp.cl en Safari (no funciona desde Chrome, Instagram u otra app en iOS — tiene que ser Safari).' },
      { text: 'Toca el botón de Compartir: el cuadrado con una flecha hacia arriba, en la barra inferior.' },
      { text: 'Desliza la lista de opciones hacia abajo y elige "Agregar a pantalla de inicio".' },
      { text: 'Revisa el nombre y toca "Agregar" arriba a la derecha.' },
    ],
    note: 'iOS no muestra ningún aviso automático de instalación: siempre hay que hacerlo a mano desde el botón de Compartir.',
  },
  {
    id: 'mac-safari',
    label: 'Mac — Safari',
    icon: 'monitor',
    steps: [
      { text: 'Abre beauchapp.cl en Safari.' },
      { text: 'Ve al menú "Archivo" → "Añadir al Dock…" (o toca el botón de Compartir y elige "Añadir al Dock").' },
      { text: 'Ponle un nombre si quieres y toca "Añadir".' },
    ],
    note: 'Disponible desde macOS Sonoma (Safari 17) en adelante. En versiones más antiguas de Safari no es posible instalarla, pero puedes seguir usándola normal desde el navegador.',
  },
  {
    id: 'android-chrome',
    label: 'Android — Chrome',
    icon: 'smartphone',
    steps: [
      { text: 'Abre beauchapp.cl en Chrome.' },
      { text: 'Si aparece un aviso de "Instalar aplicación" abajo, tócalo y listo.' },
      { text: 'Si no aparece, toca el menú de tres puntos (⋮) arriba a la derecha.' },
      { text: 'Elige "Instalar aplicación" (o "Agregar a pantalla de inicio") y confirma con "Instalar".' },
    ],
  },
  {
    id: 'desktop-chrome',
    label: 'Computador — Chrome / Edge',
    icon: 'monitor',
    steps: [
      { text: 'Abre beauchapp.cl en Chrome o Edge.' },
      { text: 'Busca el ícono de instalar en la barra de direcciones (una pantalla con una flecha, o un "+" dentro de un círculo), al lado derecho.' },
      { text: 'Si no lo ves, abre el menú de tres puntos (⋮) y busca "Instalar Beauchapp…" (Chrome) o "Aplicaciones" → "Instalar este sitio como aplicación" (Edge).' },
      { text: 'Confirma haciendo clic en "Instalar". Queda como una ventana propia y un ícono en tu sistema.' },
    ],
  },
];

export const InstallAppScreen: React.FC<Props> = ({ navigation }) => {
  const [platform, setPlatform] = useState<DetectedPlatform>('desktop-other');
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const detected = detectPlatform();
    setPlatform(detected);
    setOpenSection(detectedSectionId(detected));
    setAlreadyInstalled(isStandalone());

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleQuickInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const activeSectionId = detectedSectionId(platform);
  const showOtherBrowserNote = platform === 'ios-other' || platform === 'android-other' || platform === 'desktop-other';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconCircle}>
          <Feather name="download" size={28} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>Instalar Beauchapp</Text>
        <Text style={styles.paragraph}>
          Instala Beauchapp como aplicación en tu celular o computador: ocupa un ícono propio, carga más rápido
          y no necesitas abrir el navegador cada vez.
        </Text>

        {alreadyInstalled && (
          <View style={styles.installedBox}>
            <Feather name="check-circle" size={18} color="#22c55e" />
            <Text style={styles.installedText}>Ya estás usando la app instalada.</Text>
          </View>
        )}

        {!!deferredPrompt && !alreadyInstalled && (
          <TouchableOpacity style={styles.quickInstallBtn} activeOpacity={0.8} onPress={handleQuickInstall}>
            <Feather name="download" size={16} color="#000000" style={{ marginRight: 8 }} />
            <Text style={styles.quickInstallBtnText}>Instalar ahora</Text>
          </TouchableOpacity>
        )}

        {showOtherBrowserNote && !alreadyInstalled && (
          <View style={styles.otherBrowserBox}>
            <Feather name="alert-circle" size={16} color="#f59e0b" />
            <Text style={styles.otherBrowserText}>
              Parece que estás en un navegador distinto a Safari o Chrome. Prueba abrir beauchapp.cl en alguno de
              esos dos según tu dispositivo, o revisa las guías de abajo — suelen tener una opción parecida en su
              menú (busca "Agregar a pantalla de inicio" o "Instalar sitio").
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionsHeading}>Guías paso a paso</Text>
        {SECTIONS.map((section) => {
          const isOpen = openSection === section.id;
          const isRecommended = section.id === activeSectionId;
          return (
            <View key={section.id} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                activeOpacity={0.7}
                onPress={() => setOpenSection(isOpen ? null : section.id)}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Feather name={section.icon} size={16} color={theme.colors.text} />
                  <Text style={styles.sectionLabel}>{section.label}</Text>
                  {isRecommended && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>Tu dispositivo</Text>
                    </View>
                  )}
                </View>
                <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.primary} />
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.stepsList}>
                  {section.steps.map((step, index) => (
                    <View key={index} style={styles.stepRow}>
                      <View style={styles.stepNumberCircle}>
                        <Text style={styles.stepNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{step.text}</Text>
                    </View>
                  ))}
                  {!!section.note && <Text style={styles.sectionNote}>{section.note}</Text>}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
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
    paddingTop: theme.spacing.lg,
    paddingBottom: 60,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
  },
  paragraph: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: theme.spacing.md,
  },
  installedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 8,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  installedText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '700',
  },
  quickInstallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: theme.spacing.sm,
  },
  quickInstallBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  otherBrowserBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  otherBrowserText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  sectionsHeading: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: theme.spacing.md,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    flexWrap: 'wrap',
  },
  sectionLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  recommendedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  recommendedBadgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  stepsList: {
    gap: 14,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumberCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionNote: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
