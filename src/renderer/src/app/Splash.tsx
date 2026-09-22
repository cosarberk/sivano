import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { BrandMark } from '../components/icons'

const DURATION = 2600

interface SplashProps {
  onDone: () => void
}

/** Havalı açılış ekranı — animasyon bitince (veya tıklayınca) landing'e geçer. */
export function Splash({ onDone }: SplashProps): JSX.Element {
  const { t } = useI18n()
  const fired = useRef(false)

  const finish = (): void => {
    if (fired.current) return
    fired.current = true
    onDone()
  }

  useEffect(() => {
    const timer = window.setTimeout(finish, DURATION)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="splash" onClick={finish}>
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

      <div className="splash__progress">
        <span />
      </div>
    </div>
  )
}
