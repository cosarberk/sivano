import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

interface NamePromptProps {
  title: string
  initial?: string
  confirmLabel: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

/** Ad girme modalı (yeni dosya/klasör, yeniden adlandır). */
export function NamePrompt({
  title,
  initial = '',
  confirmLabel,
  onConfirm,
  onCancel
}: NamePromptProps): JSX.Element {
  const { t } = useI18n()
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (): void => {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">{title}</h3>
        <input
          ref={inputRef}
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
        />
        <div className="modal__actions">
          <button className="back-btn" onClick={onCancel}>
            {t('fm.cancel')}
          </button>
          <button className="btn-primary" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
