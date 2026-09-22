import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileDiff, GitFile } from '../../../preload'
import { useI18n } from '../i18n/I18nProvider'
import { DiffView } from '../components/DiffView'
import { FilesIcon, FolderIcon, RefreshIcon } from '../components/icons'

const STORAGE_KEY = 'sivano.project'
const POLL_MS = 2500

interface SendStep {
  file: GitFile
  version: number
  note: string
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export function Submit(): JSX.Element {
  const { t } = useI18n()
  const [repo, setRepo] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [isRepo, setIsRepo] = useState<boolean | null>(null)
  const [files, setFiles] = useState<GitFile[]>([])
  const [selected, setSelected] = useState<GitFile | null>(null)
  const [diff, setDiff] = useState<FileDiff | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showSend, setShowSend] = useState(false)
  const [sending, setSending] = useState(false)
  const [wizard, setWizard] = useState<SendStep[] | null>(null)
  const [step, setStep] = useState(0)
  const [sendErr, setSendErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const showToast = (msg: string): void => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3500)
  }

  /** git status'u ve seçili dosyanın farkını tazeler (canlı izleme). */
  const refresh = useCallback(async () => {
    if (!repo) return
    const ok = await window.api.git.isRepo(repo)
    setIsRepo(ok)
    if (!ok) {
      setFiles([])
      return
    }
    try {
      setFiles(await window.api.git.status(repo))
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [repo])

  // İlk yükleme + canlı: periyodik yoklama + pencere odağı.
  useEffect(() => {
    if (!repo) return
    refresh()
    const onFocus = (): void => {
      refresh()
    }
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(refresh, POLL_MS)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(id)
    }
  }, [repo, refresh])

  const doPull = async (): Promise<void> => {
    if (!repo) return
    const res = await window.api.repo.pull(repo)
    if (res.ok) {
      showToast(res.updated ? t('submit.pulled') : t('submit.upToDate'))
      refresh()
    } else {
      showToast(res.error ?? 'Güncellenemedi')
    }
  }

  const openSend = async (): Promise<void> => {
    if (!repo || files.length === 0) return
    const steps: SendStep[] = []
    for (const f of files) {
      let v = 0
      try {
        v = await window.api.git.fileVersion(repo, f.path)
      } catch {
        v = 0
      }
      steps.push({ file: f, version: v + 1, note: '' })
    }
    setWizard(steps)
    setStep(0)
    setSendErr(null)
    setShowSend(true)
  }

  const setNote = (value: string): void => {
    setWizard((w) => (w ? w.map((s, i) => (i === step ? { ...s, note: value } : s)) : w))
  }

  const closeSend = (): void => {
    setShowSend(false)
    setWizard(null)
  }

  const buildMessage = (s: SendStep): string => {
    const name = s.file.path.split(/[\\/]/).pop() ?? s.file.path
    const type = t(`submit.status.${s.file.status}`)
    const subject = `${name} — ${type} (v${s.version})`
    const body = `${t('submit.mFile')}: ${s.file.path}\n${t('submit.mVersion')}: v${s.version}`
    const note = s.note.trim()
    return `${subject}\n\n${body}${note ? `\n\n${t('submit.mNote')}: ${note}` : ''}`
  }

  const doSend = async (): Promise<void> => {
    if (!repo || !wizard) return
    setSending(true)
    setSendErr(null)
    const items = wizard.map((s) => ({
      path: s.file.path,
      message: buildMessage(s),
      note: s.note.trim() || undefined
    }))
    const res = await window.api.repo.send(repo, items)
    setSending(false)
    if (res.ok) {
      closeSend()
      const jiraNote = res.jira && res.jira.created > 0 ? ` · Jira: ${res.jira.created}` : ''
      showToast(`${t('submit.sent')} · ${res.tag}${jiraNote}`)
      window.api.notify.show(t('notif.pushTitle'), `${res.tag}${jiraNote}`)
      setSelected(null)
      setDiff(null)
      refresh()
    } else {
      setSendErr(res.error ?? 'Gönderilemedi')
    }
  }

  const select = async (file: GitFile): Promise<void> => {
    setSelected(file)
    setDiff(null)
    if (!repo) return
    setDiff(await window.api.convert.fileDiff(repo, file.path))
  }

  if (!repo) {
    return (
      <div className="empty">
        <span className="empty__icon">
          <FilesIcon size={36} />
        </span>
        <p className="empty__title">{t('submit.noProjectTitle')}</p>
        <p className="empty__desc">{t('submit.noProjectDesc')}</p>
      </div>
    )
  }

  return (
    <div className="submit">
      <aside className="submit__side">
        <div className="submit__repobar">
          <span className="submit__repoicon">
            <FolderIcon size={16} />
          </span>
          <span className="submit__reponame" title={repo}>
            {baseName(repo)}
          </span>
          <button className="chip-btn" onClick={refresh} title={t('submit.refresh')}>
            <RefreshIcon size={14} />
          </button>
          <button className="chip-btn" onClick={doPull}>
            {t('submit.pull')}
          </button>
        </div>

        {isRepo === false ? (
          <p className="submit__none">{t('submit.notRepo')}</p>
        ) : (
          <>
            <div className="submit__sideHead">{t('submit.changed')}</div>
            <div className="submit__files">
              {files.length === 0 ? (
                <p className="submit__none">{t('submit.noChanges')}</p>
              ) : (
                files.map((f) => (
                  <button
                    key={f.path}
                    className={`sfile ${selected?.path === f.path ? 'sfile--active' : ''}`}
                    onClick={() => select(f)}
                    title={f.path}
                  >
                    <span className={`sfile__dot sfile__dot--${f.status}`} />
                    <span className="sfile__name">{f.path}</span>
                    <span className={`sfile__badge sfile__badge--${f.status}`}>
                      {t(`submit.status.${f.status}`)}
                    </span>
                  </button>
                ))
              )}
            </div>
            {files.length > 0 ? (
              <div className="submit__sendbar">
                <button className="btn-primary" onClick={openSend}>
                  {t('submit.send')}
                </button>
              </div>
            ) : null}
          </>
        )}
      </aside>

      <section className="submit__main">
        {err ? (
          <div className="empty">
            <p className="empty__desc">{err}</p>
          </div>
        ) : !selected ? (
          <div className="empty">
            <p className="empty__desc">{t('submit.selectFile')}</p>
          </div>
        ) : !diff ? null : diff.mode === 'unsupported' ? (
          <div className="empty">
            <p className="empty__title">{selected.path}</p>
            <p className="empty__desc">{t('submit.binaryNote')}</p>
          </div>
        ) : diff.mode === 'missing' ? (
          <div className="empty">
            <p className="empty__title">{selected.path}</p>
            <p className="empty__desc">
              {diff.converter} {t('submit.missing')}
            </p>
          </div>
        ) : (
          <>
            <div className="submit__diffHead">
              <span>{selected.path}</span>
              {diff.mode === 'converted' ? (
                <span className="submit__convtag">{t('submit.convertedNote')}</span>
              ) : null}
            </div>
            <div className="submit__diffWrap">
              <DiffView oldText={diff.old ?? ''} newText={diff.new ?? ''} />
            </div>
          </>
        )}
      </section>

      {toast ? <div className="app-toast">{toast}</div> : null}

      {showSend && wizard ? (
        <div className="modal-overlay" onClick={sending ? undefined : closeSend}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">
              {t('submit.sendTitle')} · {step + 1}/{wizard.length}
            </h3>

            <div className="send-file">
              <span className="send-file__name">
                {wizard[step].file.path.split(/[\\/]/).pop()}
              </span>
              <span className="send-file__ver">v{wizard[step].version}</span>
              <span className={`sfile__badge sfile__badge--${wizard[step].file.status}`}>
                {t(`submit.status.${wizard[step].file.status}`)}
              </span>
            </div>
            <div className="send-path">{wizard[step].file.path}</div>

            <label className="field__label">
              {t('submit.noteLabel')}{' '}
              <span className="send-optional">({t('submit.optional')})</span>
            </label>
            <textarea
              className="input"
              rows={3}
              value={wizard[step].note}
              placeholder={t('submit.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />

            {sendErr ? <p className="form-err">{sendErr}</p> : null}

            <div className="modal__actions">
              {step > 0 ? (
                <button className="back-btn" onClick={() => setStep(step - 1)} disabled={sending}>
                  {t('submit.back')}
                </button>
              ) : (
                <button className="back-btn" onClick={closeSend} disabled={sending}>
                  {t('fm.cancel')}
                </button>
              )}
              <span style={{ flex: 1 }} />
              {step < wizard.length - 1 ? (
                <button className="btn-primary" onClick={() => setStep(step + 1)}>
                  {t('submit.next')}
                </button>
              ) : (
                <button className="btn-primary" onClick={doSend} disabled={sending}>
                  {sending ? t('submit.sending') : t('submit.send')}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
