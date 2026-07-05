import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export const VerifyEmailScreen: React.FC<Props> = ({ route, navigation }) => {
  const token = (route.params as any)?.token;
  const { confirmVerification } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Token no encontrado en el enlace.');
      return;
    }

    const verify = async () => {
      try {
        await confirmVerification(token);
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err?.message || 'El enlace es inválido o ha expirado.');
      }
    };

    verify();
  }, [token]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 20 }} />
            <Text style={styles.title}>Verificando tu cuenta...</Text>
            <Text style={styles.message}>Por favor espera un momento.</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text style={styles.title}>¡Cuenta Verificada!</Text>
            <Text style={styles.message}>
              Tu correo ha sido verificado correctamente. Ya puedes iniciar sesión.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}>
              <Text style={styles.primaryButtonText}>Ir a Iniciar Sesión</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.title}>Error al verificar</Text>
            <Text style={styles.message}>{errorMsg}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}>
              <Text style={styles.primaryButtonText}>Volver</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  contentContainer: { padding: theme.spacing.md, justifyContent: 'center', minHeight: '80%' },
  card: { paddingVertical: theme.spacing.lg, alignItems: 'center' },

  title: { fontSize: 28, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.md, textAlign: 'center' },
  message: { fontSize: 16, color: theme.colors.textMuted, lineHeight: 24, textAlign: 'center', marginBottom: theme.spacing.lg },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%', marginTop: theme.spacing.md },
  primaryButtonText: { color: '#000000', fontSize: 15, fontWeight: '600' }
});
