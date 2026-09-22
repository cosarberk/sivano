import { app, ipcMain, safeStorage } from 'electron'
import { promises as fsp } from 'fs'
import { join } from 'path'

export type Provider = 'gitlab' | 'github' | 'jira'
export type AuthMethod = 'oauth' | 'token' | 'password'

export interface ConnectionStatus {
  provider: Provider
  connected: boolean
  method?: AuthMethod
  account?: string
  baseUrl?: string
  connectedAt?: number
  projectKey?: string
  issueType?: string
  doneTransition?: string
}

export interface ConnectInput {
  provider: Provider
  method: AuthMethod
  baseUrl?: string
  token?: string
  username?: string
  password?: string
  // Jira'ya özel
  projectKey?: string
  issueType?: string
  doneTransition?: string
}

export interface ConnectResult {
  ok: boolean
  status?: ConnectionStatus
  error?: string
}

interface StoredConn {
  method: AuthMethod
  baseUrl?: string
  account?: string
  connectedAt: number
  secret: string
  enc: boolean
  projectKey?: string
  issueType?: string
  doneTransition?: string
}

type Store = Partial<Record<Provider, StoredConn>>

const PROVIDERS: Provider[] = ['gitlab', 'github', 'jira']

function storeFile(): string {
  return join(app.getPath('userData'), 'connections.json')
}

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await fsp.readFile(storeFile(), 'utf-8')) as Store
  } catch {
    return {}
  }
}

async function writeStore(store: Store): Promise<void> {
  await fsp.writeFile(storeFile(), JSON.stringify(store, null, 2), 'utf-8')
}

/** Sırrı OS kasasıyla şifreler; kasa yoksa base64 (daha az güvenli) saklar. */
function encryptSecret(value: string): { secret: string; enc: boolean } {
  if (safeStorage.isEncryptionAvailable()) {
    return { secret: safeStorage.encryptString(value).toString('base64'), enc: true }
  }
  return { secret: Buffer.from(value, 'utf-8').toString('base64'), enc: false }
}

function toStatus(provider: Provider, conn?: StoredConn): ConnectionStatus {
  if (!conn) return { provider, connected: false }
  return {
    provider,
    connected: true,
    method: conn.method,
    account: conn.account,
    baseUrl: conn.baseUrl,
    connectedAt: conn.connectedAt,
    projectKey: conn.projectKey,
    issueType: conn.issueType,
    doneTransition: conn.doneTransition
  }
}

/** Token'ı sağlayıcı API'sine sorar, geçerliyse hesabı ve base URL'i döner. */
async function validateToken(
  input: ConnectInput
): Promise<{ account: string; baseUrl: string }> {
  if (input.provider === 'github') {
    const baseUrl = (input.baseUrl?.trim() || 'https://api.github.com').replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/user`, {
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Sivano'
      }
    })
    if (!res.ok) throw new Error(`GitHub reddetti (${res.status})`)
    const data = (await res.json()) as { login: string }
    return { account: data.login, baseUrl }
  }

  if (input.provider === 'gitlab') {
    const baseUrl = (input.baseUrl?.trim() || 'https://gitlab.com').replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/api/v4/user`, {
      headers: { 'PRIVATE-TOKEN': input.token ?? '' }
    })
    if (!res.ok) throw new Error(`GitLab reddetti (${res.status})`)
    const data = (await res.json()) as { username: string }
    return { account: data.username, baseUrl }
  }

  if (input.provider === 'jira') {
    const baseUrl = (input.baseUrl?.trim() ?? '').replace(/\/$/, '')
    if (!baseUrl) throw new Error('Jira sunucu adresi gerekli')
    const res = await fetch(`${baseUrl}/rest/api/2/myself`, {
      headers: { Authorization: `Bearer ${input.token}`, Accept: 'application/json' }
    })
    if (!res.ok) throw new Error(`Jira reddetti (${res.status})`)
    const data = (await res.json()) as { name?: string; key?: string; displayName?: string }
    return { account: data.name ?? data.key ?? data.displayName ?? 'jira', baseUrl }
  }

  throw new Error('Bu sağlayıcı desteklenmiyor')
}

/** Kayıtlı bağlantının çözülmüş token'ını ve base URL'ini döner (git/API için). */
export async function getSecret(
  provider: Provider
): Promise<{ token: string; baseUrl?: string } | null> {
  const store = await readStore()
  const conn = store[provider]
  if (!conn) return null
  try {
    const token = conn.enc
      ? safeStorage.decryptString(Buffer.from(conn.secret, 'base64'))
      : Buffer.from(conn.secret, 'base64').toString('utf-8')
    return { token, baseUrl: conn.baseUrl }
  } catch {
    return null
  }
}

export interface JiraSettings {
  token: string
  baseUrl: string
  projectKey: string
  issueType: string
  doneTransition: string
  account: string
}

/** Jira gönderimi için gerekli tüm ayarlar (token çözülmüş). Bağlı değilse null. */
export async function getJiraSettings(): Promise<JiraSettings | null> {
  const store = await readStore()
  const c = store.jira
  if (!c) return null
  try {
    const token = c.enc
      ? safeStorage.decryptString(Buffer.from(c.secret, 'base64'))
      : Buffer.from(c.secret, 'base64').toString('utf-8')
    return {
      token,
      baseUrl: c.baseUrl ?? '',
      projectKey: c.projectKey ?? '',
      issueType: c.issueType ?? 'Analiz',
      doneTransition: c.doneTransition ?? 'Done',
      account: c.account ?? ''
    }
  } catch {
    return null
  }
}

export function registerConnectionsIpc(): void {
  ipcMain.handle('conn:list', async (): Promise<ConnectionStatus[]> => {
    const store = await readStore()
    return PROVIDERS.map((p) => toStatus(p, store[p]))
  })

  ipcMain.handle('conn:connect', async (_event, input: ConnectInput): Promise<ConnectResult> => {
    try {
      if (input.method !== 'token') {
        return {
          ok: false,
          error: 'Şimdilik yalnızca token ile bağlanılabilir. OAuth ve parola yakında.'
        }
      }
      // Token boşsa (düzenleme): mevcut kayıtlı token'ı koru.
      let token = input.token?.trim() ?? ''
      if (!token) {
        const existing = await getSecret(input.provider)
        if (existing?.token) token = existing.token
        else return { ok: false, error: 'Token gerekli' }
      }

      const { account, baseUrl } = await validateToken({ ...input, token })
      const { secret, enc } = encryptSecret(token)
      const store = await readStore()
      const connectedAt = Date.now()
      store[input.provider] = {
        method: 'token',
        baseUrl,
        account,
        connectedAt,
        secret,
        enc,
        ...(input.provider === 'jira'
          ? {
              projectKey: input.projectKey?.trim(),
              issueType: input.issueType?.trim() || 'Analiz',
              doneTransition: input.doneTransition?.trim() || 'Done'
            }
          : {})
      }
      await writeStore(store)

      return { ok: true, status: toStatus(input.provider, store[input.provider]) }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('conn:disconnect', async (_event, provider: Provider): Promise<ConnectionStatus[]> => {
    const store = await readStore()
    delete store[provider]
    await writeStore(store)
    return PROVIDERS.map((p) => toStatus(p, store[p]))
  })
}
