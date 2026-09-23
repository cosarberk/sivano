import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { BrandMark } from '../components/icons'

interface SplashProps {
  onDone: () => void
}

type ToolKey = 'git' | 'pandoc' | 'pdftotext'
const CHECKS: { key: ToolKey; label: string }[] = [
  { key: 'git', label: 'Git' },
  { key: 'pandoc', label: 'Pandoc (Word · ODT · PPTX)' },
  { key: 'pdftotext', label: 'pdftotext (PDF)' }
]

interface Line {
  label: string
  state: 'run' | 'ok' | 'warn'
  detail?: string
}

/** Havalı açılış + gerçek başlangıç kontrolleri (git/pandoc/pdftotext). */
export function Splash({ onDone }: SplashProps): JSX.Element {
  const { t } = useI18n()
  const fired = useRef(false)
  const [lines, setLines] = useState<Line[]>([])
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [hasWarn, setHasWarn] = useState(false)

  const finish = (): void => {
    if (fired.current) return
    fired.current = true
    onDone()
  }

  useEffect(() => {
    let alive = true
    let warned = false
    ;(async () => {
      for (let i = 0; i < CHECKS.length; i++) {
        if (!alive) return
        const c = CHECKS[i]
        setLines((prev) => [...prev, { label: c.label, state: 'run' }])
        await new Promise((r) => setTimeout(r, 280)) // yükleniyor hissi
        let res: Awaited<ReturnType<typeof window.api.diag.check>> | null = null
        try {
          res = await window.api.diag.check(c.key)
        } catch {
          res = null
        }
        if (!alive) return
        const ok = !!res?.ok
        const src = res?.source === 'bundled' ? t('splash.bundled') : t('splash.system')
        const detail = ok ? `${res?.version ?? ''} · ${src}`.trim() : t('splash.missing')
        setLines((prev) =>
          prev.map((l, idx) =>
            idx === prev.length - 1 ? { ...l, state: ok ? 'ok' : 'warn', detail } : l
          )
        )
        if (!ok) {
          warned = true
          setHasWarn(true)
        }
        setProgress((i + 1) / CHECKS.length)
      }
      if (!alive) return
      setDone(true)
      if (!warned) {
        await new Promise((r) => setTimeout(r, 700))
        if (alive) finish()
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="splash">
      <span className="splash__glow splash__glow--a" />
      <span className="splash__glow splash__glow--b" />

      <div className="splash__center">
        <span className="splash__mark">
          <BrandMark size={68} />
        </span>
        <h1 className="splash__word">SIVANO</h1>
        <span className="splash__rule" />
        <p className="splash__tag">{t('app.tagline')}</p>
      </div>

      <div className="splash__boot">
        <div className="splash__progress">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <ul className="splash__log">
          {lines.map((l, i) => (
            <li key={i} className={`boot boot--${l.state}`}>
              <span className="boot__ic">{l.state === 'run' ? '›' : l.state === 'ok' ? '✓' : '!'}</span>
              <span className="boot__label">
                {l.label}
                {l.state === 'run' ? ` ${t('splash.checking')}…` : ''}
              </span>
              {l.detail ? <span className="boot__detail">{l.detail}</span> : null}
            </li>
          ))}
        </ul>
        {done && hasWarn ? (
          <div className="splash__warn">
            <p>{t('splash.warnNote')}</p>
            <button className="btn-primary" onClick={finish}>
              {t('splash.continue')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
