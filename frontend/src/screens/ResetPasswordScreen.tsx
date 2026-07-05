import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export const ResetPasswordScreen: React.FC<Props> = ({ route, navigation }) => {
  const token = (route.params as any)?.token;
  const { confirmPasswordReset, loading } = useAuth();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setErrorMsg('');
    if (!token) {
      setErrorMsg('Token inválido o no encontrado.');
      return;
    }
    if (!password || password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    try {
      await confirmPasswordReset(token, password, confirmPassword);
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al restablecer la contraseña. Puede que el enlace haya expirado.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formCard}>
        {success ? (
          <>
            <Text style={styles.emoji}>🔑</Text>
            <Text style={styles.title}>¡Contraseña actualizada!</Text>
            <Text style={styles.message}>
              Tu contraseña se ha restablecido correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
            </Text>
            <TouchableOpacity style={styles.submitButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}>
              <Text style={styles.submitButtonText}>Ir a Iniciar Sesión</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Restablecer Contraseña</Text>
            
            {!token && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>No se encontró un token válido. Revisa el enlace en tu correo.</Text>
              </View>
            )}

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nueva Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={theme.colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmar Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Vuelve a escribir la contraseña"
                placeholderTextColor={theme.colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, loading && styles.disabledButton]} 
              onPress={handleSubmit}
              disabled={loading || !token}
            >
              {loading ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Guardar Nueva Contraseña</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleLink} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })} disabled={loading}>
              <Text style={styles.toggleLinkText}>Cancelar y volver</Text>
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
  formCard: { paddingVertical: theme.spacing.lg },
  emoji: { fontSize: 64, marginBottom: theme.spacing.lg, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.lg, textAlign: 'center' },
  message: { fontSize: 16, color: theme.colors.textMuted, lineHeight: 24, textAlign: 'center', marginBottom: theme.spacing.lg },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  errorText: { color: '#f87171', fontSize: 14, fontWeight: '500' },
  inputGroup: { marginBottom: theme.spacing.lg },
  label: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  input: { fontSize: 16, color: theme.colors.text, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: 10, paddingHorizontal: 0 },
  submitButton: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: theme.spacing.md },
  disabledButton: { opacity: 0.7 },
  submitButtonText: { color: '#000000', fontSize: 15, fontWeight: '600' },
  toggleLink: { alignItems: 'center', marginTop: theme.spacing.lg, paddingVertical: 4 },
  toggleLinkText: { color: theme.colors.accent, fontSize: 13, fontWeight: '500' }
});
