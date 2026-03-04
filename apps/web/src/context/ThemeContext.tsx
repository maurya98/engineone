import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type ThemePreference = 'light' | 'dark' | 'system';
type EffectiveTheme = 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  setPreference: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialPreference?: ThemePreference | null;
}

export function ThemeProvider({ children, initialPreference = null }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference ?? 'system');
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme);

  const effectiveTheme: EffectiveTheme =
    preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    if (initialPreference != null) setPreferenceState(initialPreference);
  }, [initialPreference]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handle = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    setSystemTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, [preference]);

  const setPreference = useCallback((theme: ThemePreference) => {
    setPreferenceState(theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, effectiveTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Fetches user theme preference and provides ThemeProvider. Use inside AuthProvider. */
export function ThemeProviderWithPrefs({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/users/me/preferences', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const theme = data?.preferences?.theme;
        if (theme === 'light' || theme === 'dark' || theme === 'system') {
          setPreference(theme);
        } else {
          setPreference('system');
        }
      })
      .catch(() => {
        if (!cancelled) setPreference('system');
      });
    return () => { cancelled = true; };
  }, []);

  return <ThemeProvider initialPreference={preference}>{children}</ThemeProvider>;
}
