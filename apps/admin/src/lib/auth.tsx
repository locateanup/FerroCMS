import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './api.js';
import type { LoginChallenge, User } from './types.js';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Resolves to the logged-in user, or a challenge if the account has 2FA enabled. */
  login: (email: string, password: string) => Promise<User | LoginChallenge>;
  completeTotpLogin: (challengeToken: string, token: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function isChallenge(result: User | LoginChallenge): result is LoginChallenge {
  return 'requiresTotp' in result;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const result = await api.login(email, password);
        if (!isChallenge(result)) setUser(result);
        return result;
      },
      completeTotpLogin: async (challengeToken, token) => {
        setUser(await api.completeTotpLogin(challengeToken, token));
      },
      register: async (email, password, name) => setUser(await api.register(email, password, name)),
      logout: async () => {
        await api.logout();
        setUser(null);
      },
      refresh: async () => setUser(await api.me()),
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
