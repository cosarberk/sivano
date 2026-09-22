import type { CSSProperties } from 'react'
import type { ScreenId } from './types'
import { useI18n } from '../i18n/I18nProvider'
import { useTheme } from '../theme/ThemeProvider'
import {
  BrandMark,
  FilesIcon,
  SendIcon,
  HistoryIcon,
  SettingsIcon,
  ProfileIcon,
  ContrastIcon,
  GlobeIcon,
  PinIcon
} from '../components/icons'

function activeProjectName(): string | null {
  try {
    const p = localStorage.getItem('sivano.project')
    if (!p) return null
    return p.split(/[\\/]/).filter(Boolean).pop() ?? p
  } catch {
    return null
  }
}

interface Tile {
  id: ScreenId
  titleKey: string
  descKey: string
  icon: JSX.Element
  hue: string
}

const TILES: Tile[] = [
  { id: 'files', titleKey: 'nav.files', descKey: 'desc.files', icon: <FilesIcon size={30} />, hue: '#e0762e' },
  { id: 'submit', titleKey: 'nav.submit', descKey: 'desc.submit', icon: <SendIcon size={30} />, hue: '#d6425a' },
  { id: 'history', titleKey: 'nav.history', descKey: 'desc.history', icon: <HistoryIcon size={30} />, hue: '#3f9d8f' },
  { id: 'settings', titleKey: 'nav.settings', descKey: 'desc.settings', icon: <SettingsIcon size={30} />, hue: '#8b6fc4' },
  { id: 'profile', titleKey: 'nav.profile', descKey: 'desc.profile', icon: <ProfileIcon size={30} />, hue: '#c9973f' }
]

interface LandingProps {
  onOpen: (id: ScreenId) => void
}

export function Landing({ onOpen }: LandingProps): JSX.Element {
  const { t, setLocale, locale } = useI18n()
  const { cycleTheme } = useTheme()
  const projectName = activeProjectName()

  return (
    <div className="landing">
      <header className="landing__bar">
        <div className="landing__brand">
          <span className="landing__mark">
            <BrandMark size={28} />
          </span>
          <div className="landing__brandText">
            <span className="landing__name">Sivano</span>
            <span className="landing__tag">{t('app.tagline')}</span>
          </div>
        </div>
        <div className="landing__controls">
          <button className="icon-btn" onClick={cycleTheme} title={t('settings.theme')}>
            <ContrastIcon />
          </button>
          <button
            className="icon-btn"
            onClick={() => setLocale(locale === 'tr' ? 'en' : 'tr')}
            title={t('settings.language')}
          >
            <GlobeIcon />
            <span className="icon-btn__tag">{locale.toUpperCase()}</span>
          </button>
        </div>
      </header>

      <main className="landing__main">
        <div className="landing__head">
          <p className="landing__subtitle">{t('landing.subtitle')}</p>
          {projectName ? (
            <span className="landing__proj">
              <PinIcon size={13} /> {projectName}
            </span>
          ) : (
            <button className="landing__pick" onClick={() => onOpen('files')}>
              {t('landing.pickProject')}
            </button>
          )}
        </div>
        <div className="tiles">
          {TILES.map((tile, i) => (
            <button
              key={tile.id}
              className="tile"
              style={{ '--hue': tile.hue, '--i': i } as CSSProperties}
              onClick={() => onOpen(tile.id)}
            >
              <span className="tile__glyph">{tile.icon}</span>
              <span className="tile__body">
                <span className="tile__title">{t(tile.titleKey)}</span>
                <span className="tile__desc">{t(tile.descKey)}</span>
              </span>
              <span className="tile__bar" />
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
