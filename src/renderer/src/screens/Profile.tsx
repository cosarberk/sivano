import { useEffect, useState, type CSSProperties } from 'react'
import type { ConnectionStatus, Provider } from '../../../preload'
import { useI18n } from '../i18n/I18nProvider'
import { GithubIcon, GitLabIcon, JiraIcon, CheckIcon } from '../components/icons'

interface ProviderMeta {
  id: Provider
  name: string
  icon: JSX.Element
  brand: string
  selfHosted: boolean
}

const PROVIDERS: ProviderMeta[] = [
  { id: 'gitlab', name: 'GitLab', icon: <GitLabIcon size={24} />, brand: '#fc6d26', selfHosted: true },
  { id: 'github', name: 'GitHub', icon: <GithubIcon size={22} />, brand: '#8b949e', selfHosted: false },
  { id: 'jira', name: 'Jira', icon: <JiraIcon size={22} />, brand: '#2684ff', selfHosted: true }
]

export function Profile(): JSX.Element {
  const [statuses, setStatuses] = useState<ConnectionStatus[]>([])

  useEffect(() => {
    window.api.conn.list().then(setStatuses).catch(() => setStatuses([]))
  }, [])

  const statusOf = (id: Provider): ConnectionStatus =>
    statuses.find((s) => s.provider === id) ?? { provider: id, connected: false }

  return (
    <div className="profile">
      {PROVIDERS.map((p) => (
        <ConnectionCard key={p.id} meta={p} status={statusOf(p.id)} onChanged={setStatuses} />
      ))}
    </div>
  )
}

interface CardProps {
  meta: ProviderMeta
  status: ConnectionStatus
  onChanged: (statuses: ConnectionStatus[]) => void
}

function ConnectionCard({ meta, status, onChanged }: CardProps): JSX.Element {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [issueType, setIssueType] = useState('Analiz')
  const [doneTransition, setDoneTransition] = useState('Done')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [detail, setDetail] = useState(false)

  const isJira = meta.id === 'jira'
  const tokenHint = isJira
    ? t('profile.hintTokenJira')
    : meta.id === 'github'
      ? t('profile.hintTokenGithub')
      : t('profile.hintTokenGitlab')
  // Düzenlemede (bağlıyken) token boş bırakılabilir → mevcut korunur.
  const hasToken = token.trim().length > 0 || status.connected
  const canConnect = isJira ? !!(hasToken && baseUrl.trim() && projectKey.trim()) : hasToken

  const startEdit = (): void => {
    setBaseUrl(status.baseUrl ?? '')
    setProjectKey(status.projectKey ?? '')
    setIssueType(status.issueType ?? 'Analiz')
    setDoneTransition(status.doneTransition ?? 'Done')
    setToken('')
    setErr(null)
    setDetail(false)
    setOpen(true)
  }

  const connect = async (): Promise<void> => {
    setBusy(true)
    setErr(null)
    const res = await window.api.conn.connect({
      provider: meta.id,
      method: 'token',
      baseUrl: baseUrl.trim() || undefined,
      token,
      ...(isJira
        ? {
            projectKey: projectKey.trim(),
            issueType: issueType.trim() || 'Analiz',
            doneTransition: doneTransition.trim() || 'Done'
          }
        : {})
    })
    setBusy(false)
    if (res.ok) {
      const list = await window.api.conn.list()
      onChanged(list)
      setOpen(false)
      setToken('')
    } else {
      setErr(res.error ?? 'Bağlanılamadı')
    }
  }

  const disconnect = async (): Promise<void> => {
    const list = await window.api.conn.disconnect(meta.id)
    onChanged(list)
  }

  return (
    <div className="conn-card" style={{ '--brand': meta.brand } as CSSProperties}>
      <div className="conn-card__head">
        <span className="conn-card__icon">{meta.icon}</span>
        <div className="conn-card__meta">
          <span className="conn-card__name">{meta.name}</span>
          {status.connected ? (
            <span className="conn-card__status conn-card__status--on">
              <CheckIcon size={14} />
              {t('profile.connected')} · @{status.account}
            </span>
          ) : (
            <span className="conn-card__status">{t('profile.notConnected')}</span>
          )}
        </div>
        <span className="conn-card__spacer" />
        {status.connected ? (
          <div className="conn-card__actions">
            <button className="chip-btn" onClick={() => setDetail((d) => !d)}>
              {t('profile.detail')}
            </button>
            <button className="chip-btn" onClick={startEdit}>
              {t('profile.edit')}
            </button>
            <button className="back-btn" onClick={disconnect}>
              {t('profile.disconnect')}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
            {t('profile.connect')}
          </button>
        )}
      </div>

      {detail && status.connected ? (
        <div className="conn-card__detail">
          <div>
            <span>{t('profile.jiraUrl')}</span>
            <span className="mono">{status.baseUrl || '—'}</span>
          </div>
          <div>
            <span>{t('profile.account')}</span>
            <span className="mono">@{status.account}</span>
          </div>
          {isJira ? (
            <>
              <div>
                <span>{t('profile.projectKey')}</span>
                <span className="mono">{status.projectKey || '—'}</span>
              </div>
              <div>
                <span>{t('profile.issueType')}</span>
                <span className="mono">{status.issueType || '—'}</span>
              </div>
              <div>
                <span>{t('profile.doneTransition')}</span>
                <span className="mono">{status.doneTransition || '—'}</span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <div className="conn-card__form">
          {meta.selfHosted ? (
            <label className="ffield">
              <span className="ffield__label">
                {isJira ? t('profile.jiraUrl') : t('profile.baseUrl')}
              </span>
              <input
                className="input"
                placeholder="https://..."
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <span className="ffield__hint">
                {isJira ? t('profile.hintBaseJira') : t('profile.hintBaseGitlab')}
              </span>
            </label>
          ) : null}

          <label className="ffield">
            <span className="ffield__label">{t('profile.tokenLabel')}</span>
            <input
              className="input"
              type="password"
              placeholder={status.connected ? t('profile.tokenKeep') : t('profile.tokenPlaceholder')}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <span className="ffield__hint">{tokenHint}</span>
          </label>

          {isJira ? (
            <>
              <label className="ffield">
                <span className="ffield__label">{t('profile.projectKey')}</span>
                <input
                  className="input"
                  placeholder="ANLZ"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value)}
                />
                <span className="ffield__hint">{t('profile.hintProjectKey')}</span>
              </label>
              <label className="ffield">
                <span className="ffield__label">{t('profile.issueType')}</span>
                <input
                  className="input"
                  placeholder="Analiz"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                />
                <span className="ffield__hint">{t('profile.hintIssueType')}</span>
              </label>
              <label className="ffield">
                <span className="ffield__label">{t('profile.doneTransition')}</span>
                <input
                  className="input"
                  placeholder="Done"
                  value={doneTransition}
                  onChange={(e) => setDoneTransition(e.target.value)}
                />
                <span className="ffield__hint">{t('profile.hintDoneTransition')}</span>
              </label>
            </>
          ) : null}

          {err ? <p className="form-err">{err}</p> : null}

          <button className="btn-primary" onClick={connect} disabled={busy || !canConnect}>
            {busy ? t('profile.connecting') : t('profile.connect')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
