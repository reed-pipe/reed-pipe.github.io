import { useState, useEffect, useMemo } from 'react'
import { create } from 'zustand'
import {
  colors, gradients, shadows, glass, antThemeToken,
  darkColors, darkGradients, darkShadows, darkGlass, darkAntThemeToken,
} from '@/shared/theme'

// --- Types ---
export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

// --- Zustand store with localStorage persistence ---
const STORAGE_KEY = 'theme-mode'

function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // ignore
  }
  return 'light'
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: getStoredMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // ignore
    }
    set({ mode })
  },
}))

// --- useTheme hook ---
export function useTheme() {
  const { mode, setMode } = useThemeStore()
  const systemDark = useSystemDark(mode)

  const isDark = mode === 'dark' || (mode === 'system' && systemDark)

  return {
    isDark,
    mode,
    setMode,
    colors: isDark ? darkColors : colors,
    gradients: isDark ? darkGradients : gradients,
    shadows: isDark ? darkShadows : shadows,
    glass: isDark ? darkGlass : glass,
    antThemeToken: isDark ? darkAntThemeToken : antThemeToken,
  }
}

/**
 * Subscribes to system color-scheme changes.
 * Only actively listens when mode is 'system'.
 */
function useSystemDark(mode: ThemeMode): boolean {
  const mql = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)'), [])
  const [systemDark, setSystemDark] = useState(() => mql.matches)

  useEffect(() => {
    if (mode !== 'system') return
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mql.addEventListener('change', handler)
    // Sync current value in case it changed while not listening
    setSystemDark(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [mode, mql])

  return systemDark
}
