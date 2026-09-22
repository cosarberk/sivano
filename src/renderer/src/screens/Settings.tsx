import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../preload'
import { useI18n } from '../i18n/I18nProvider'
import { LOCALES } from '../i18n/messages'
import { useTheme } from '../theme/ThemeProvider'
import { THEMES } from '../theme/themes'
import { CheckIcon, ExternalIcon, GithubIcon } from '../components/icons'
import type { CSSProperties } from 'react'

export function Settings(): JSX.Element {
  const { t, locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.api?.getAppInfo().then(setInfo).catch(() => setInfo(null))
  }, [])

  return (
    <div className="settings">
      {/* Görünüm */}
      <section className="panel">
            <h3 className="panel__title">{t('settings.appearance')}</h3>

            <div className="field">
              <label className="field__label">{t('settings.theme')}</label>
              <div className="theme-grid">
                {THEMES.map((th) => (
                  <button
                    key={th.id}
                    className={`theme-card ${theme === th.id ? 'theme-card--active' : ''}`}
                    onClick={() => setTheme(th.id)}
                  >
                    <span
                      className="theme-card__preview"
                      style={
                        {
                          '--p-bg': th.swatch.bg,
                          '--p-surface': th.swatch.surface,
                          '--p-accent': th.swatch.accent
                        } as CSSProperties
                      }
                    >
                      <span className="theme-card__bar" />
                      <span className="theme-card__dot" />
                    </span>
                    <span className="theme-card__name">
                      {t(th.labelKey)}
                      {theme === th.id ? <CheckIcon size={15} /> : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field__label">{t('settings.language')}</label>
              <div className="segmented">
                {LOCALES.map((l) => (
                  <button
                    key={l.id}
                    className={`segmented__item ${locale === l.id ? 'segmented__item--active' : ''}`}
                    onClick={() => setLocale(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Hakkında */}
          <section className="panel">
            <h3 className="panel__title">{t('settings.about')}</h3>

            <dl className="info-list">
              <div className="info-row">
                <dt>{t('settings.version')}</dt>
                <dd className="mono">{info?.version ?? '—'}</dd>
              </div>
              <div className="info-row">
                <dt>{t('settings.author')}</dt>
                <dd>{info?.author ?? '—'}</dd>
              </div>
              <div className="info-row">
                <dt>{t('settings.license')}</dt>
                <dd>{info?.license ?? '—'}</dd>
              </div>
              <div className="info-row">
                <dt>{t('settings.repository')}</dt>
                <dd>
                  {info?.repository ? (
                    <button
                      className="link-btn"
                      onClick={() => window.api?.openExternal(info.repository)}
                    >
                      <GithubIcon size={16} />
                      {info.repository.replace('https://', '')}
                      <ExternalIcon />
                    </button>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>

            <h4 className="panel__subtitle">{t('settings.runtime')}</h4>
            <div className="chips">
              <span className="chip">Electron {info?.versions.electron ?? '—'}</span>
              <span className="chip">Node {info?.versions.node ?? '—'}</span>
              <span className="chip">Chromium {info?.versions.chrome ?? '—'}</span>
              <span className="chip">
                {info ? `${info.platform} · ${info.arch}` : '—'}
              </span>
            </div>
      </section>
    </div>
  )
}
