import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken, setToken, clearToken } from '../lib/authToken';
import { apiFetch } from '../lib/api';

export interface User {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setAuth: (user: User, token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ user: User }>('/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(data.user);
      setSessionExpired(false);
    } catch {
      clearToken();
      setUser(null);
      setSessionExpired(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const setAuth = useCallback((user: User, token: string) => {
    setToken(token);
    setUser(user);
    setSessionExpired(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    setSessionExpired(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    clearToken();
    setUser(null);
    setSessionExpired(false);
  }, []);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionExpired,
        clearSessionExpired,
        login,
        logout,
        refreshUser,
        setAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
