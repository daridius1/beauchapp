import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '../services/pocketbase';
import { storage } from '../utils/storage';

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar?: string;
  matchAlias?: string;
  matchPhoto?: string;
  collectionId: string;
  type: 'student' | 'organization';
  subtype?: 'center' | 'team' | 'community' | 'band' | 'organization';
  description?: string;
  chip_text?: string;
  chip_color?: string;
  entry_year?: string;
  department?: string;
  instagram?: string;
  telegram?: string;
  whatsapp?: string;
  signal?: string;
  website?: string;
  karma?: number;
  show_karma_on_profile?: boolean;
  beautokens?: number;
  show_beautokens_on_profile?: boolean;
  beaudle_streak?: number;
  beaudle_best_streak?: number;
  show_beaudle_streak_on_profile?: boolean;
  last_seen_announcement?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isInitialized: boolean;
  error: string | null;
  unverifiedEmail: string | null;
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  requestVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, password: string, passwordConfirm: string) => Promise<void>;
  confirmVerification: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getFriendlyErrorMessage = (err: any, defaultMsg: string): string => {
  if (!err) return defaultMsg;
  
  if (err instanceof Error && !('status' in err)) {
    return err.message;
  }

  if (err.status === 0) {
    return 'No se pudo conectar con el servidor. Por favor, verifica tu conexión a internet.';
  }

  const errData = err.response?.data || err.data;
  if (errData && typeof errData === 'object') {
    const errorDetails: string[] = [];
    
    for (const [key, value] of Object.entries(errData)) {
      const fieldError = value as { code: string; message: string };
      if (key === 'username') {
        errorDetails.push('El nombre de usuario ya está en uso o es inválido.');
      } else if (key === 'email') {
        errorDetails.push('El correo electrónico ya está registrado.');
      } else if (key === 'password') {
        errorDetails.push('La contraseña es demasiado corta o no es válida.');
      } else if (key === 'name') {
        errorDetails.push('El nombre es requerido.');
      } else {
        errorDetails.push(`${key}: ${fieldError.message}`);
      }
    }

    if (errorDetails.length > 0) {
      return errorDetails.join('\n');
    }
  }

  if (err.message && err.message.includes('Failed to authenticate')) {
    return 'El usuario o la contraseña son incorrectos. Verifica tus credenciales.';
  }

  if (err.message && err.message.includes("doesn't satisfy the collection requirements")) {
    return 'Debes verificar tu correo electrónico institucional antes de iniciar sesión. Revisa tu correo del CEC (correo.cec.uchile.cl).';
  }

  return err.message || defaultMsg;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [developerMode, setDeveloperModeState] = useState<boolean>(() => storage.getItem('beauchapp_dev_mode') === 'true');

  const setDeveloperMode = (enabled: boolean) => {
    setDeveloperModeState(enabled);
    storage.setItem('beauchapp_dev_mode', enabled.toString());
  };

  // Sincronizar el estado con el AuthStore de PocketBase al iniciar, y refrescar el
  // token periódicamente mientras la app queda abierta (es una PWA, se puede quedar
  // horas en una pestaña sin remontar el provider).
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (pb.authStore.isValid && pb.authStore.token) {
          // Refresh the auth token to ensure session is still valid in DB
          const authData = await pb.collection('users').authRefresh();
          setUser(authData.record as unknown as User);
        } else {
          setUser(null);
        }
      } catch (err: any) {
        console.error('Error al restaurar sesión:', err);
        // Solo un 401 real significa "el token ya no sirve". Cualquier otra falla
        // (sin red, 5xx, timeout) no debe cerrar una sesión que sigue siendo válida —
        // el próximo refresh (periódico o al reabrir la app) puede recuperarse solo.
        if (err?.status === 401) {
          pb.authStore.clear();
          setUser(null);
        }
      } finally {
        setIsInitialized(true);
      }
    };

    checkAuth();
    const refreshInterval = setInterval(checkAuth, 10 * 60 * 1000);

    // Escuchar cambios en authStore (ej. logout en otra pestaña)
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model as unknown as User);
    });

    return () => {
      clearInterval(refreshInterval);
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    setUnverifiedEmail(null);
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      setUser(authData.record as unknown as User);
    } catch (err: any) {
      console.error('login error:', err);
      if (err.message && err.message.includes("doesn't satisfy the collection requirements")) {
        // El login acepta nombre de usuario sin dominio; requestVerification necesita el correo real.
        setUnverifiedEmail(email.includes('@') ? email : `${email}@ing.uchile.cl`);
      }
      setError(getFriendlyErrorMessage(err, 'Error al iniciar sesión.'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const username = email.split('@')[0];
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm: password,
        name,
        username,
      });

      // Solicitar correo de verificación automáticamente tras registro exitoso
      try {
        await pb.collection('users').requestVerification(email);
      } catch (verr) {
        console.error('requestVerification error:', verr);
      }

      // Intentar auto login si la cuenta estuviera verificada automáticamente
      try {
        await login(email, password);
      } catch (loginErr: any) {
        // Si el login falla porque el usuario aún no ha verificado su correo (esperado),
        // no consideramos que el registro falló. El registro fue exitoso.
        const msg = loginErr?.message || '';
        if (msg.includes("doesn't satisfy the collection requirements") || loginErr?.status === 400) {
          // Registro exitoso; cuenta pendiente de verificación (login rechazado a propósito).
          return;
        }
        throw loginErr;
      }
    } catch (err: any) {
      console.error('signup error:', err);
      setError(getFriendlyErrorMessage(err, 'Error al registrarse.'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setUser(null);
  };

  const refreshUser = async () => {
    if (!pb.authStore.model?.id) return;
    try {
      const updated = await pb.collection('users').getOne(pb.authStore.model.id);
      setUser(updated as unknown as User);
      pb.authStore.save(pb.authStore.token, updated);
    } catch (err) {
      console.warn('Error refreshing user:', err);
    }
  };

  const clearError = () => {
    setError(null);
    setUnverifiedEmail(null);
  };

  const requestVerification = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await pb.collection('users').requestVerification(email);
    } catch (err: any) {
      console.error('requestVerification error:', err);
      setError(getFriendlyErrorMessage(err, 'Error al solicitar correo de verificación.'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await pb.collection('users').requestPasswordReset(email);
    } catch (err: any) {
      console.error('requestPasswordReset error:', err);
      setError(getFriendlyErrorMessage(err, 'Error al solicitar recuperación de contraseña.'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const confirmPasswordReset = async (token: string, password: string, passwordConfirm: string) => {
    setLoading(true);
    setError(null);
    try {
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm);
    } catch (err: any) {
      console.error('confirmPasswordReset error:', err);
      setError(getFriendlyErrorMessage(err, 'Error al restablecer la contraseña. Token inválido o expirado.'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const confirmVerification = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      await pb.collection('users').confirmVerification(token);
    } catch (err: any) {
      console.error('confirmVerification error:', err);
      setError(getFriendlyErrorMessage(err, 'Error al verificar la cuenta. Token inválido o expirado.'));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isInitialized,
        error,
        unverifiedEmail,
        developerMode,
        setDeveloperMode,
        login,
        signup,
        logout,
        refreshUser,
        clearError,
        requestVerification,
        requestPasswordReset,
        confirmPasswordReset,
        confirmVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
