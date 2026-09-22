import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { DEFAULT_THEME, THEMES, type ThemeId } from './themes'

const STORAGE_KEY = 'sivano.theme'
const VALID = THEMES.map((t) => t.id)

function readStoredTheme(): ThemeId {
  try {
    const value = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    if (value && VALID.includes(value)) return value
  } catch {
    /* yoksay */
  }
  return DEFAULT_THEME
}

interface ThemeContextValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* yoksay */
    }
  }, [])

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const idx = VALID.indexOf(current)
      const next = VALID[(idx + 1) % VALID.length]
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* yoksay */
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ theme, setTheme, cycleTheme }), [theme, setTheme, cycleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme, ThemeProvider içinde kullanılmalı')
  return ctx
}
