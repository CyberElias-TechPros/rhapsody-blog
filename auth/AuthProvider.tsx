/**
 * Client-side auth session state.
 *
 * The token lives in localStorage (see src/lib/api.ts for the rationale). This context is a
 * UX convenience only — every protected capability is enforced server-side by the Worker.
 * A stale/expired token surfaces as a 401 → `meaning:unauthorized` → session cleared here.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getStoredToken, setStoredToken, UNAUTHORIZED_EVENT } from '@/lib/api';
import type { User } from '@/lib/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  logoutAllDevices: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (getStoredToken() ? 'loading' : 'anonymous'));
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setStatus('anonymous');
    // Personal data must not linger in the query cache after sign-out.
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    // No token: the state initialiser already reports 'anonymous', so there is nothing to sync.
    const token = getStoredToken();
    if (!token) return;
    api.auth
      .me()
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  useEffect(() => {
    const onUnauthorized = () => clearSession();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    setStoredToken(res.token);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.auth.register(name, email, password);
    setStoredToken(res.token);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => clearSession(), [clearSession]);

  const logoutAllDevices = useCallback(async () => {
    try {
      await api.auth.logoutAll();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refresh = useCallback(async () => {
    if (!getStoredToken()) {
      setStatus('anonymous');
      setUser(null);
      return;
    }
    try {
      const { user: me } = await api.auth.me();
      setUser(me);
      setStatus('authenticated');
    } catch {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, logoutAllDevices, refresh }),
    [user, status, login, register, logout, logoutAllDevices, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export function hasRole(user: User | null | undefined, roles: string[]): boolean {
  return !!user && roles.includes(user.role);
}
