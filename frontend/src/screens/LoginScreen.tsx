import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login, signup, requestPasswordReset, error, clearError, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    clearError();

    // Validaciones del cliente
    if (!email) {
      setLocalError('El usuario o correo es requerido.');
      return;
    }
    
    let identity = email.trim().toLowerCase();
    
    if (isForgotPassword) {
      if (identity && !identity.includes('@')) {
        identity += '@ing.uchile.cl';
      }
      if (!identity.endsWith('@ing.uchile.cl')) {
        setLocalError('Debes usar tu correo @ing.uchile.cl');
        return;
      }
    } else if (isSignUp) {
      if (identity.includes('@')) {
         identity = identity.split('@')[0];
      }
      identity += '@ing.uchile.cl';
    } else {
      if (identity.includes('@') && !identity.endsWith('@ing.uchile.cl')) {
        setLocalError('Si usas correo, debe ser @ing.uchile.cl');
        return;
      }
    }
    if (!isForgotPassword && (!password || password.length < 8)) {
      setLocalError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden.');
      return;
    }
    if (isSignUp && !name) {
      setLocalError('El nombre es requerido.');
      return;
    }
    if (isSignUp && (!username || username.trim().length < 3)) {
      setLocalError('El nombre de usuario es requerido y debe tener al menos 3 caracteres.');
      return;
    }

    try {
      if (isForgotPassword) {
        await requestPasswordReset(identity);
        setSuccessMessage('Te enviamos un correo con las instrucciones.\n\nPor favor, ten paciencia y revisa tu carpeta de SPAM si no lo encuentras inmediatamente.');
      } else if (isSignUp) {
        await signup(identity, password, name.trim(), username.trim().toLowerCase());
        navigation.reset({
          index: 0,
          routes: [{ name: 'Verification' }],
        });
      } else {
        await login(identity, password);
        // Redirigir siempre a Home después de login
        navigation.navigate('Home');
      }
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
    setConfirmPassword('');
    setName('');
    setUsername('');
    setSuccessMessage(null);
  };

  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    clearError();
    setLocalError(null);
    setSuccessMessage(null);
    setEmail('');
    setPassword('');
  };

  const activeError = localError || error;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formCard}>
        <Text style={styles.title}>
          {isForgotPassword ? 'Recuperar Contraseña' : isSignUp ? 'Registro' : 'Iniciar Sesión'}
        </Text>

        {activeError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{activeError}</Text>
          </View>
        )}

        {successMessage && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {!isForgotPassword && isSignUp && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre a mostrar</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Juan Pérez ⚽️"
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        )}

        {!isForgotPassword && isSignUp && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre de usuario</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: jperez99"
              placeholderTextColor={theme.colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {isSignUp && !isForgotPassword ? (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo institucional</Text>
            <View style={styles.emailContainer}>
              <TextInput
                style={[styles.input, styles.emailPrefixInput]}
                placeholder="jperez99"
                placeholderTextColor={theme.colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.emailSuffix}>@ing.uchile.cl</Text>
            </View>
            <Text style={styles.helperText}>Es tu correo de la FCFM. Si no lo recuerdas, revisa servicios.cec.uchile.cl</Text>
          </View>
        ) : (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{isForgotPassword ? 'Correo institucional' : 'Correo o Nombre de usuario'}</Text>
            <TextInput
              style={styles.input}
              placeholder={isForgotPassword ? "juan@ing.uchile.cl" : "Ej: jperez99 o juan@ing.uchile.cl"}
              placeholderTextColor={theme.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isForgotPassword && (
              <Text style={styles.helperText}>Escribe tu correo de la facultad para enviarte un enlace de recuperación.</Text>
            )}
          </View>
        )}

        {!isForgotPassword && (
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
        )}

        {!isForgotPassword && isSignUp && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmar contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="Vuelve a escribir tu contraseña"
              placeholderTextColor={theme.colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]} 
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#000000" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isForgotPassword ? 'Recuperar Contraseña' : isSignUp ? 'Crear cuenta' : 'Iniciar Sesión'}
            </Text>
          )}
        </TouchableOpacity>

        {!isForgotPassword && !isSignUp && (
          <TouchableOpacity style={styles.toggleLink} onPress={toggleForgotPassword} disabled={loading}>
            <Text style={styles.forgotPasswordText}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.toggleLink} onPress={isForgotPassword ? toggleForgotPassword : toggleMode} disabled={loading}>
          <Text style={styles.toggleLinkText}>
            {isForgotPassword 
              ? 'Volver al inicio de sesión'
              : isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
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
  successBox: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  successText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  emailPrefixInput: {
    flex: 1,
    borderBottomWidth: 0,
    textAlign: 'right',
  },
  emailSuffix: {
    fontSize: 16,
    color: theme.colors.textMuted,
    paddingVertical: 10,
    paddingLeft: 4,
  },
  helperText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 6,
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
    color: '#000000',
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
  forgotPasswordText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});
