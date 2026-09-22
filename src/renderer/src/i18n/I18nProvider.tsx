import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { MESSAGES, type Locale } from './messages'

const STORAGE_KEY = 'sivano.locale'

function readStoredLocale(): Locale {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'tr' || value === 'en') return value
  } catch {
    /* localStorage erişilemeyebilir; varsayılana düş. */
  }
  return 'tr'
}

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* yoksay */
    }
  }, [])

  const t = useCallback(
    (key: string) => MESSAGES[locale][key] ?? MESSAGES.tr[key] ?? key,
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n, I18nProvider içinde kullanılmalı')
  return ctx
}
