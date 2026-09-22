import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n/I18nProvider'

const CHECK_MS = 180000 // 3 dakika

/** Aktif repoda uzak güncelleme olup olmadığını periyodik kontrol eder,
 *  varsa işletim sisteminin kendi bildirimini gönderir. Görünür bir şey çizmez. */
export function RemoteWatcher(): null {
  const { t } = useI18n()
  const lastBehind = useRef(-1)

  useEffect(() => {
    let alive = true

    const activeRepo = (): string | null => {
      try {
        return localStorage.getItem('sivano.repoPath') ?? localStorage.getItem('sivano.filesPath')
      } catch {
        return null
      }
    }

    const check = async (): Promise<void> => {
      const repo = activeRepo()
      if (!repo) return
      const st = await window.api.repo.remoteStatus(repo).catch(() => null)
      if (!alive || !st) return
      if (st.behind > 0 && st.behind !== lastBehind.current) {
        window.api.notify.show(t('notif.remoteTitle'), `${st.behind} ${t('notif.remoteBody')}`)
      }
      lastBehind.current = st.behind
    }

    check()
    const id = window.setInterval(check, CHECK_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [t])

  return null
}
