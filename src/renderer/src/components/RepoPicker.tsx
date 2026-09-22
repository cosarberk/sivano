import { useEffect, useState } from 'react'
import type { GitProject } from '../../../preload'
import { useI18n } from '../i18n/I18nProvider'

interface RepoPickerProps {
  /** Dosya yöneticisinde o an açık klasör (varsayılan hedef). */
  currentDir?: string | null
  onDone: (path: string) => void
  onClose: () => void
}

/** GitLab projelerini listeler; konum seçtirir; seçilen projeyi klonlar. */
export function RepoPicker({ currentDir, onDone, onClose }: RepoPickerProps): JSX.Element {
  const { t } = useI18n()
  const [projects, setProjects] = useState<GitProject[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [cloning, setCloning] = useState<string | null>(null)
  const [dest, setDest] = useState<string | null>(currentDir ?? null)

  useEffect(() => {
    window.api.repo
      .listProjects('gitlab')
      .then((list) => setProjects(list))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter((p) =>
    p.pathWithNamespace.toLowerCase().includes(query.toLowerCase())
  )

  const pickDest = async (): Promise<void> => {
    const picked = await window.api.fs.pickFolder()
    if (picked) setDest(picked)
  }

  const clone = async (p: GitProject): Promise<void> => {
    setCloning(p.pathWithNamespace)
    setErr(null)
    const res = await window.api.repo.clone('gitlab', p.httpUrl, p.pathWithNamespace, dest ?? undefined)
    setCloning(null)
    if (res.ok && res.path) onDone(res.path)
    else setErr(res.error ?? 'Klonlanamadı')
  }

  const busy = cloning !== null

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal modal--tall" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">{t('repo.pickTitle')}</h3>

        <div className="repo-dest">
          <span>{t('repo.location')}:</span>
          <span className="repo-dest__path" title={dest ?? undefined}>
            {dest ?? t('repo.defaultLoc')}
          </span>
          {currentDir && dest !== currentDir ? (
            <button className="chip-btn" onClick={() => setDest(currentDir)} disabled={busy}>
              {t('repo.here')}
            </button>
          ) : null}
          <button className="chip-btn" onClick={pickDest} disabled={busy}>
            {t('repo.chooseLoc')}
          </button>
        </div>

        <input
          className="input"
          placeholder={t('repo.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={busy}
          autoFocus
        />
        {err ? <p className="form-err">{err}</p> : null}

        <div className="applist">
          {loading ? (
            <div className="loadingrow">
              <span className="spinner" />
              {t('repo.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <p className="submit__none">{t('repo.none')}</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                className="applist__item repo-item"
                onClick={() => clone(p)}
                disabled={busy}
              >
                <span className="repo-name">{p.name}</span>
                <span className="repo-sub">
                  {cloning === p.pathWithNamespace ? (
                    <>
                      <span className="spinner spinner--sm" /> {t('repo.cloning')}
                    </>
                  ) : (
                    p.pathWithNamespace
                  )}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="modal__actions">
          <span style={{ flex: 1 }} />
          <button className="back-btn" onClick={onClose} disabled={busy}>
            {t('fm.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
