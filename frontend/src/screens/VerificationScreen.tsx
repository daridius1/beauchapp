import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Verification'>;

export const VerificationScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>

        <Text style={styles.title}>Revisa tu correo CEC</Text>
        <Text style={styles.message}>
          Hemos enviado un enlace de confirmación a tu correo institucional (@ing.uchile.cl).
          Por favor, revisa tu bandeja de entrada.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>¿No sabes cómo entrar a tu correo?</Text>
          <Text style={styles.infoText}>
            • El correo del CEC es tu correo de la FCFM.{"\n"}
            • <Text style={{fontWeight: 'bold', color: theme.colors.text}}>Tu usuario y contraseña son los mismos que usas para iniciar sesión en los computadores de los laboratorios de computación del CEC.</Text>
          </Text>
          
          <TouchableOpacity 
            style={styles.linkButton} 
            onPress={() => Linking.openURL('https://correo.cec.uchile.cl/')}
          >
            <Text style={styles.linkButtonText}>Ir al Correo del CEC</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryLinkButton} 
            onPress={() => Linking.openURL('https://servicios.cec.uchile.cl/')}
          >
            <Text style={styles.secondaryLinkButtonText}>¿Olvidaste tu clave o nunca te has creado una cuenta del CEC? Haz clic aquí</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.warning}>
          Debido a límites en el servidor de correos, el mensaje puede tardar unos 15 segundos en llegar. ¡Agradecemos tu paciencia!
        </Text>
        
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}>
          <Text style={styles.primaryButtonText}>Ir a Iniciar Sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  contentContainer: { padding: theme.spacing.md, justifyContent: 'center', minHeight: '80%' },
  card: { 
    paddingVertical: theme.spacing.lg, 
    alignItems: 'center',
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: 450,
        alignSelf: 'center',
      }
    })
  },
  emoji: { fontSize: 64, marginBottom: theme.spacing.lg },
  title: { fontSize: 28, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.md, textAlign: 'center' },
  message: { fontSize: 16, color: theme.colors.textMuted, lineHeight: 24, textAlign: 'center', marginBottom: theme.spacing.lg },
  
  infoBox: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    width: '100%',
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  linkButton: {
    backgroundColor: '#2563eb',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  linkButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryLinkButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryLinkButtonText: {
    color: theme.colors.accent,
    fontSize: 13,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },

  warning: { fontSize: 14, color: theme.colors.accent, lineHeight: 20, textAlign: 'center', marginBottom: theme.spacing.xl, padding: theme.spacing.md, backgroundColor: 'rgba(56, 189, 248, 0.1)', borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)' },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  primaryButtonText: { color: '#000000', fontSize: 15, fontWeight: '600' }
});
