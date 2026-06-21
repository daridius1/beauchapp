import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from './HomeScreen';

interface LoginScreenProps {
  onNavigate: (screen: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigate }) => {
  const { login, signup, error, clearError, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    clearError();

    // Validaciones del cliente
    if (!email) {
      setLocalError('El usuario o correo es requerido.');
      return;
    }
    
    let formattedEmail = email.trim().toLowerCase();
    if (formattedEmail && !formattedEmail.includes('@')) {
      formattedEmail += '@ug.uchile.cl';
    }

    if (!formattedEmail.endsWith('@ug.uchile.cl')) {
      setLocalError('Solo se permiten correos institucionales @ug.uchile.cl');
      return;
    }
    if (!password || password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (isSignUp && !name) {
      setLocalError('El nombre es requerido.');
      return;
    }

    try {
      if (isSignUp) {
        await signup(formattedEmail, password, name.trim());
      } else {
        await login(formattedEmail, password);
      }
      // Navegar a Home tras inicio de sesión exitoso
      onNavigate('Home');
    } catch (err) {
      // Los errores globales ya los maneja el AuthContext
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
    setLocalError(null);
    setEmail('');
    setPassword('');
    setName('');
  };

  const activeError = localError || error;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formCard}>
        <Text style={styles.title}>{isSignUp ? 'Crear Perfil' : 'Iniciar Sesión'}</Text>
        <Text style={styles.subtitle}>
          {isSignUp 
            ? 'Regístrate con tu correo de la U. de Chile para entrar en el ranking.' 
            : 'Ingresa tus credenciales para registrar partidas.'}
        </Text>

        {activeError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{activeError}</Text>
          </View>
        )}

        {isSignUp && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Juan Pérez"
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Usuario o Correo institucional</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. juan (o juan@ug.uchile.cl)"
            placeholderTextColor={theme.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.domainWarning}>Si ingresas solo tu usuario, completaremos @ug.uchile.cl de forma automática.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={theme.colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]} 
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isSignUp ? 'Registrarme' : 'Entrar'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.toggleLink} onPress={toggleMode} disabled={loading}>
          <Text style={styles.toggleLinkText}>
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    justifyContent: 'center',
    minHeight: '80%',
  },
  formCard: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  domainWarning: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleLink: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingVertical: 4,
  },
  toggleLinkText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});
