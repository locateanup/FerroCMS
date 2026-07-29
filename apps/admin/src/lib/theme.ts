import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ferrocms-theme';

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** Sets the `data-theme` attribute the CSS in styles.css keys off of. `'system'` clears it, deferring to `prefers-color-scheme`. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function setStoredTheme(theme: Theme): void {
  if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/** Reads/writes the theme preference, kept in sync with localStorage across tabs. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setThemeState(getStoredTheme());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function setTheme(next: Theme) {
    setStoredTheme(next);
    setThemeState(next);
  }

  return [theme, setTheme];
}
