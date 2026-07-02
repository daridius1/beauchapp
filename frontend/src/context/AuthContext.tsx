import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '../services/pocketbase';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  created: string;
  updated: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar el estado con el AuthStore de PocketBase al iniciar
  useEffect(() => {
    const checkAuth = () => {
      try {
        if (pb.authStore.isValid && pb.authStore.model) {
          setUser(pb.authStore.model as unknown as UserProfile);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error al restaurar sesión:', err);
      } finally {
        setLoading(false);
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

  const signup = async (email: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      // Filtro previo en cliente (adicional al del backend)
      if (!email.endsWith('@ing.uchile.cl')) {
        throw new Error('Solo se permiten correos institucionales @ing.uchile.cl');
      }

      const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        signup,
        logout,
        clearError,
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
