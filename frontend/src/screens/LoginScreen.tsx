import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Pressable, Platform } from 'react-native';
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
  const [hasSentResetEmail, setHasSentResetEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailInputRef = useRef<TextInput>(null);

  const handleEmailChange = (text: string) => {
    let clean = text.trim().replace(/\s/g, '');
    if (clean.includes('@')) {
      const [prefix, domain] = clean.split('@');
      if (domain && domain.toLowerCase() !== 'ing.uchile.cl') {
        setLocalError('Debes usar tu cuenta de la escuela (@ing.uchile.cl)');
      } else {
        setLocalError(null);
      }
      if (domain && domain.toLowerCase() === 'ing.uchile.cl') {
        clean = prefix;
      }
    } else {
      setLocalError(null);
    }
    setEmail(clean);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
      if (email.includes('@')) {
        const parts = email.split('@');
        const domain = parts[parts.length - 1].toLowerCase();
        if (domain !== 'ing.uchile.cl') {
          setLocalError('Debes usar tu correo @ing.uchile.cl');
          return;
        }
      }
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
        setHasSentResetEmail(true);
        setResendCooldown(60);
      } else if (isSignUp) {
        await signup(identity, password, name.trim(), username.trim().toLowerCase());
        navigation.reset({
          index: 0,
          routes: [{ name: 'Verification' }],
        });
      } else {
        await login(identity, password);
        // El AuthContext cambiará el 'user' y App.tsx nos redigirá al Stack correcto automáticamente
      }
    } catch (err) {
      // Los errores globales ya los maneja el AuthContext
    }
  };

  const handleResendResetEmail = async () => {
    if (resendCooldown > 0) return;
    setLocalError(null);
    clearError();
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setResendCooldown(60);
    } catch (err) {
      // handled globally
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
    setHasSentResetEmail(false);
  };

  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    clearError();
    setLocalError(null);
    setSuccessMessage(null);
    setEmail('');
    setPassword('');
    setHasSentResetEmail(false);
  };

  const activeError = localError || error;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formCard}>
        <Text style={styles.title}>
          {isForgotPassword ? (hasSentResetEmail ? 'Revisa tu correo CEC' : 'Recuperar Contraseña') : isSignUp ? 'Registro' : 'Iniciar Sesión'}
        </Text>

        {!!activeError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{activeError}</Text>
          </View>
        )}

        {isForgotPassword && hasSentResetEmail ? (
          <View>
            <Text style={styles.subtitle}>
              Hemos enviado las instrucciones a {email}. Por favor, revisa tu bandeja de entrada o SPAM.
            </Text>
            
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>¿No sabes cómo entrar a tu correo?</Text>
              <Text style={styles.infoText}>
                • El correo del CEC es tu correo de la FCFM.{"\n"}
                • <Text style={{fontWeight: 'bold', color: theme.colors.text}}>Tu usuario y contraseña son los mismos que usas en los laboratorios de computación del CEC.</Text>
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

            <TouchableOpacity 
              style={[styles.submitButton, (loading || resendCooldown > 0) && styles.disabledButton]} 
              onPress={handleResendResetEmail}
              disabled={loading || resendCooldown > 0}
            >
              {loading ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {resendCooldown > 0 ? `Reenviar correo en ${resendCooldown}s` : 'Reenviar correo'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleLink} onPress={() => setHasSentResetEmail(false)}>
              <Text style={styles.toggleLinkText}>Me equivoqué de correo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleLink} onPress={toggleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Volver a Iniciar Sesión</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
        {!!successMessage && (
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

        {isSignUp || isForgotPassword ? (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo institucional</Text>
            <View style={styles.emailContainer}>
              <TextInput
                ref={emailInputRef}
                style={styles.emailPrefixInput}
                placeholder="tu.usuario"
                placeholderTextColor={theme.colors.textMuted}
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.inlineEmailSuffix}>@ing.uchile.cl</Text>
            </View>
            <Text style={styles.helperText}>
              {isForgotPassword 
                ? 'Escribe tu usuario para enviarte un enlace de recuperación.'
                : 'Es tu correo de la FCFM. Si no lo recuerdas, revisa servicios.cec.uchile.cl'}
            </Text>
          </View>
        ) : (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo o Nombre de usuario</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: jperez99 o juan@ing.uchile.cl"
              placeholderTextColor={theme.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
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
        </>
        )}
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
    width: '100%',
    ...Platform.select({
      web: {
        maxWidth: 450,
        alignSelf: 'center',
      }
    })
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
    paddingVertical: 4,
  },
  emailPrefixInput: {
    flex: 1,
    borderBottomWidth: 0,
    fontSize: 16,
    color: theme.colors.text,
    paddingVertical: 8,
  },
  inlineEmailSuffix: {
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: '600',
    paddingLeft: 8,
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
    fontSize: 12,
    textAlign: 'center',
  },
});
