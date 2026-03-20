'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import { storage } from '@/lib/storage';
import { configureAmplify } from '@/lib/aws-config';

const CHECK_INTERVAL = 1 * 60 * 1000; // Check every 1 minute
const TOKEN_EXPIRY = 30 * 60; // 30 minutes in seconds

// Dev mode: skip Cognito when no pool ID configured
const IS_DEV = !process.env.NEXT_PUBLIC_USER_POOL_ID;

const DEV_USER = {
  userId: 'dev-user-local',
  username: 'dev@paisatax.com',
};

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { userId: string; username: string } | null;
  idToken: string | null;
  isTokenValid: boolean;
  login: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  idToken: null,
  isTokenValid: true,
  login: async () => {},
  logout: async () => {},
  checkAuth: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(IS_DEV);
  const [isLoading, setIsLoading] = useState(!IS_DEV);
  const [user, setUser] = useState<{ userId: string; username: string } | null>(
    IS_DEV ? DEV_USER : null,
  );
  const [idToken, setIdToken] = useState<string | null>(IS_DEV ? 'dev-token' : null);
  const [isTokenValid, setIsTokenValid] = useState(true);

  const router = useRouter();

  const storeToken = useCallback(async (token: string) => {
    const expiryTime = Date.now() + TOKEN_EXPIRY * 1000;
    storage.setItem('idToken', token);
    storage.setItem('tokenExpiry', expiryTime.toString());
    setIdToken(token);
  }, []);

  const login = async (userData: any) => {
    if (IS_DEV) {
      setUser(DEV_USER);
      setIsAuthenticated(true);
      setIsTokenValid(true);
      return;
    }

    try {
      const session = await fetchAuthSession();
      const newIdToken = session.tokens?.idToken?.toString();

      if (!newIdToken) {
        throw new Error('No token received');
      }

      await storeToken(newIdToken);
      storage.setItem('auth', JSON.stringify(userData));

      const currentUser = await getCurrentUser();

      setUser({ userId: currentUser.userId, username: userData.username });
      setIsAuthenticated(true);
      setIsTokenValid(true);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const logout = useCallback(async () => {
    if (IS_DEV) {
      // In dev, just reset to dev user (no real sign-out)
      setUser(DEV_USER);
      setIsAuthenticated(true);
      return;
    }

    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }

    storage.removeItem('idToken');
    storage.removeItem('tokenExpiry');
    storage.removeItem('auth');

    setIdToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setIsTokenValid(false);

    configureAmplify();
    router.push('/signin');
  }, [router]);

  const checkAndRefreshToken = useCallback(async () => {
    if (IS_DEV) return true;

    try {
      const expiryTimeStr = storage.getItem('tokenExpiry');
      if (!expiryTimeStr) {
        setIsTokenValid(false);
        await logout();
        return false;
      }

      const timeUntilExpiry = parseInt(expiryTimeStr) - Date.now();

      if (timeUntilExpiry <= 0) {
        setIsTokenValid(false);
        await logout();
        return false;
      }

      // Refresh if expiring in < 5 minutes
      if (timeUntilExpiry <= 5 * 60 * 1000) {
        try {
          const session = await fetchAuthSession({ forceRefresh: true });
          const newToken = session.tokens?.idToken?.toString();

          if (newToken) {
            await storeToken(newToken);
            setIsTokenValid(true);
            return true;
          } else {
            setIsTokenValid(false);
            await logout();
            return false;
          }
        } catch {
          setIsTokenValid(false);
          await logout();
          return false;
        }
      }

      setIsTokenValid(true);
      return true;
    } catch {
      setIsTokenValid(false);
      await logout();
      return false;
    }
  }, [logout, storeToken]);

  const checkAuth = useCallback(async () => {
    if (IS_DEV) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const storedIdToken = storage.getItem('idToken');
      const storedAuth = storage.getItem('auth');

      if (!storedIdToken || !storedAuth) {
        setIsLoading(false);
        return;
      }

      configureAmplify();

      const tokenValid = await checkAndRefreshToken();
      if (!tokenValid) {
        throw new Error('Token validation failed');
      }

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('No current user');
      }

      const authData = JSON.parse(storedAuth);

      setUser({ userId: currentUser.userId, username: authData.username });
      setIsAuthenticated(true);
    } catch {
      storage.removeItem('idToken');
      storage.removeItem('tokenExpiry');
      storage.removeItem('auth');

      setIdToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setIsTokenValid(false);
    } finally {
      setIsLoading(false);
    }
  }, [checkAndRefreshToken]);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Periodic token check every minute while authenticated
  useEffect(() => {
    if (!isAuthenticated || IS_DEV) return;
    const intervalId = setInterval(checkAndRefreshToken, CHECK_INTERVAL);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, checkAndRefreshToken]);

  // Check token on tab focus
  useEffect(() => {
    if (IS_DEV) return;
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        await checkAndRefreshToken();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, checkAndRefreshToken]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        idToken,
        isTokenValid,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
