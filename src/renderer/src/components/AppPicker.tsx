import { useEffect, useState } from 'react'
import type { InstalledApp } from '../../../preload'
import { useI18n } from '../i18n/I18nProvider'

interface AppPickerProps {
  onPick: (launch: string, setDefault: boolean) => void
  onClose: () => void
}

/** Sistemdeki yüklü uygulamaları listeler; biriyle aç + varsayılan yap. */
export function AppPicker({ onPick, onClose }: AppPickerProps): JSX.Element {
  const { t } = useI18n()
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [query, setQuery] = useState('')
  const [makeDefault, setMakeDefault] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.fs
      .listApps()
      .then((list) => setApps(list))
      .catch(() => setApps([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = apps.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))

  const browse = async (): Promise<void> => {
    const picked = await window.api.fs.pickApp()
    if (picked) onPick(picked, makeDefault)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--tall" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">{t('fm.appPickerTitle')}</h3>
        <input
          className="input"
          placeholder={t('fm.searchApps')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="applist">
          {loading ? (
            <p className="submit__none">…</p>
          ) : filtered.length === 0 ? (
            <p className="submit__none">{t('fm.noApps')}</p>
          ) : (
            filtered.map((a) => (
              <button
                key={a.launch}
                className="applist__item"
                onClick={() => onPick(a.launch, makeDefault)}
              >
                {a.name}
              </button>
            ))
          )}
        </div>
        <label className="checkrow">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
          />
          {t('fm.makeDefault')}
        </label>
        <div className="modal__actions">
          <button className="back-btn" onClick={browse}>
            {t('fm.browse')}
          </button>
          <span style={{ flex: 1 }} />
          <button className="back-btn" onClick={onClose}>
            {t('fm.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
