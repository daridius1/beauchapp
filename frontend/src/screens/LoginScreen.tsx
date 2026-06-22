import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { theme } from './HomeScreen';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
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
      // Redirigir siempre a Home después de login (App.tsx mostrará los menús)
      navigation.navigate('Home');
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
        <Text style={styles.title}>{isSignUp ? 'Registro' : 'Iniciar Sesión'}</Text>

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
              placeholder="Nombre"
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Usuario</Text>
          <TextInput
            style={styles.input}
            placeholder="Usuario"
            placeholderTextColor={theme.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
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
              {isSignUp ? 'Crear cuenta' : 'Iniciar Sesión'}
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
    paddingVertical: theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
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
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    color: theme.colors.text,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 0,
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
    marginTop: theme.spacing.md,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  toggleLink: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: 4,
  },
  toggleLinkText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
});
