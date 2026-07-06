import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '../services/pocketbase';

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar?: string;
  collectionId: string;
  isSuperadmin: boolean;
  type: 'student' | 'organization';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isInitialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, username: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  requestVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, password: string, passwordConfirm: string) => Promise<void>;
  confirmVerification: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar el estado con el AuthStore de PocketBase al iniciar
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (pb.authStore.isValid && pb.authStore.token) {
          // Refresh the auth token to ensure session is still valid in DB
          const authData = await pb.collection('users').authRefresh();
          setUser(authData.record as unknown as UserProfile);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error al restaurar sesión:', err);
        pb.authStore.clear();
        setUser(null);
      } finally {
        setIsInitialized(true);
      }
    };

    checkAuth();

    // Suscribirse a cambios en el AuthStore
    const unsubscribe = pb.authStore.onChange((token, model) => {
      if (model) {
        setUser(model as unknown as UserProfile);
      } else {
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      // Iniciar sesión con email y contraseña
      const authData = await pb.collection('users').authWithPassword(email, password);
      
      if (!authData.record.verified) {
        pb.authStore.clear();
        throw new Error('Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada o spam.');
      }
      
      setUser(authData.record as unknown as UserProfile);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'Error al iniciar sesión. Verifica tus credenciales.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string, username: string) => {
    setLoading(true);
    setError(null);
    try {
      // Filtro previo en cliente (adicional al del backend)
      if (!email.endsWith('@ing.uchile.cl')) {
        throw new Error('Solo se permiten correos institucionales @ing.uchile.cl');
      }

      const data = {
        username: username,
        email: email,
        emailVisibility: true,
        password: password,
        passwordConfirm: password,
        name: name,
      };

      // Crear el registro de usuario
      await pb.collection('users').create(data);

      // Enviar enlace de verificación de correo
      await pb.collection('users').requestVerification(email);

      // No iniciamos sesión automáticamente para obligar a verificar el correo
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err?.message || 'Error al registrar usuario.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setUser(null);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  const requestVerification = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await pb.collection('users').requestVerification(email);
    } catch (err: any) {
      console.error('requestVerification error:', err);
      setError(err?.message || 'Error al solicitar verificación.');
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
      setError(err?.message || 'Error al solicitar reseteo de contraseña.');
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
      setError(err?.message || 'Error al confirmar reseteo de contraseña.');
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
      setError(err?.message || 'Error al confirmar verificación.');
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
        login,
        signup,
        logout,
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
