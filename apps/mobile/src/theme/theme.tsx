import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type Theme } from './tokens';

const ThemeContext = createContext<Theme>({ dark: false, colors: lightColors });

/** Light/dark from the OS setting (dark mode from day one — CLAUDE.md). */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo<Theme>(() => (scheme === 'dark' ? { dark: true, colors: darkColors } : { dark: false, colors: lightColors }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): Theme {
  return useContext(ThemeContext);
}
