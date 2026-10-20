import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AppTheme, ThemeId } from './types';
import { THEMES, DEFAULT_THEME_ID } from './themes';
import { getSecureItem, setSecureItem } from '../services/storage/secureStore';

const THEME_STORAGE_KEY = 'pocketpick_theme_preference';

export interface ThemeContextValue {
  theme: AppTheme;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[DEFAULT_THEME_ID],
  themeId: DEFAULT_THEME_ID,
  setTheme: () => {},
  isDark: THEMES[DEFAULT_THEME_ID].isDark,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    getSecureItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (
          stored &&
          (stored === 'classic-ios' || stored === 'sakura-pink' || stored === 'cyber')
        ) {
          setThemeIdState(stored as ThemeId);
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    setSecureItem(THEME_STORAGE_KEY, id).catch(() => {});
  }, []);

  const activeTheme = useMemo(() => THEMES[themeId] ?? THEMES[DEFAULT_THEME_ID], [themeId]);

  const value = useMemo(
    () => ({
      theme: activeTheme,
      themeId,
      setTheme,
      isDark: activeTheme.isDark,
    }),
    [activeTheme, themeId, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  return (
    context ?? {
      theme: THEMES[DEFAULT_THEME_ID],
      themeId: DEFAULT_THEME_ID,
      setTheme: () => {},
      isDark: THEMES[DEFAULT_THEME_ID].isDark,
    }
  );
}
