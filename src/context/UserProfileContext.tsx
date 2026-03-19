'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { UserMode } from '@/lib/types';

const STORAGE_KEY = 'paisatax-mode';

interface UserProfileContextValue {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function useUserProfile(): UserProfileContextValue {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used within UserProfileProvider');
  return ctx;
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UserMode>(() => {
    if (typeof window === 'undefined') return 'personal';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'business' ? 'business' : 'personal';
  });

  const setMode = useCallback((newMode: UserMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, newMode);
    }
  }, []);

  // Sync on mount (SSR hydration safety)
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'business' || stored === 'personal') {
      setModeState(stored);
    }
  }, []);

  return (
    <UserProfileContext.Provider value={{ mode, setMode }}>
      {children}
    </UserProfileContext.Provider>
  );
}
