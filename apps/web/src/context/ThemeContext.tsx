import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

type ThemePreference = 'light' | 'dark' | 'system';
type EffectiveTheme = 'light' | 'dark';
type FontSizePreference = 'small' | 'medium' | 'large';

interface ThemeContextValue {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  setPreference: (theme: ThemePreference) => void;
  fontSize: FontSizePreference;
  setFontSize: (size: FontSizePreference) => void;
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
  initialFontSize?: FontSizePreference | null;
}

export function ThemeProvider({ children, initialPreference = null, initialFontSize = null }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference ?? 'system');
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme);
  const [fontSize, setFontSizeState] = useState<FontSizePreference>(initialFontSize ?? 'medium');

  const effectiveTheme: EffectiveTheme =
    preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    if (initialPreference != null) setPreferenceState(initialPreference);
  }, [initialPreference]);

  useEffect(() => {
    if (initialFontSize != null) setFontSizeState(initialFontSize);
  }, [initialFontSize]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

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

  const setFontSize = useCallback((size: FontSizePreference) => {
    setFontSizeState(size);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, effectiveTheme, setPreference, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Fetches user theme preference and provides ThemeProvider. Use inside AuthProvider. */
export function ThemeProviderWithPrefs({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference | null>(null);
  const [fontSize, setFontSize] = useState<FontSizePreference | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ preferences?: { theme?: string; font_size?: string } }>('/users/me/preferences')
      .then((data) => {
        if (cancelled) return;
        const theme = data?.preferences?.theme;
        const size = data?.preferences?.font_size;
        if (theme === 'light' || theme === 'dark' || theme === 'system') {
          setPreference(theme);
        } else {
          setPreference('system');
        }
        if (size === 'small' || size === 'medium' || size === 'large') {
          setFontSize(size);
        } else {
          setFontSize('medium');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreference('system');
          setFontSize('medium');
        }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <ThemeProvider initialPreference={preference} initialFontSize={fontSize}>
      {children}
    </ThemeProvider>
  );
}
