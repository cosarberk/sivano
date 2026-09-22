export type ThemeId = 'noir' | 'linen' | 'abyss'

export interface ThemeMeta {
  id: ThemeId
  labelKey: string
  swatch: { bg: string; surface: string; accent: string }
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'noir',
    labelKey: 'theme.noir',
    swatch: { bg: '#100b09', surface: '#211915', accent: '#ff6a3d' }
  },
  {
    id: 'linen',
    labelKey: 'theme.linen',
    swatch: { bg: '#f2ebdd', surface: '#fbf6ec', accent: '#d9532a' }
  },
  {
    id: 'abyss',
    labelKey: 'theme.abyss',
    swatch: { bg: '#08110f', surface: '#10201d', accent: '#f0b64a' }
  }
]

export const DEFAULT_THEME: ThemeId = 'noir'
