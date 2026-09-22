import { app, ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { promises as fsp, existsSync } from 'fs'
import { join } from 'path'
import { getSecret, type Provider } from './connections'
import { writeDerived, derivedPathFor, fileDiffData } from './convert'
import { sendAnalyses, type AnalysisEntry } from './jira'

const exec = promisify(execFile)

export interface GitProject {
  id: number
  name: string
  pathWithNamespace: string
  httpUrl: string
  lastActivityAt?: string
  description?: string
}

export interface CloneResult {
  ok: boolean
  path?: string
  error?: string
}

export interface SendResult {
  ok: boolean
  tag?: string
  error?: string
  jira?: { created: number; failed: number }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

async function runGit(repo: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd: repo, maxBuffer: 1024 * 1024 * 32 })
  return stdout
}

async function currentBranch(repo: string): Promise<string> {
  return (await runGit(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
}

/** fetch/push hedefi: HTTPS ise token'lı URL, SSH ise 'origin' (anahtar). */
async function remoteTarget(repo: string): Promise<string> {
  const originUrl = (await runGit(repo, ['remote', 'get-url', 'origin'])).trim()
  if (/^https?:\/\//.test(originUrl)) {
    const cred = await getSecret('gitlab')
    if (cred) {
      return originUrl.replace(/^https:\/\//, `https://oauth2:${encodeURIComponent(cred.token)}@`)
    }
  }
  return 'origin'
}

/** origin URL'inden (SSH ya da HTTPS) web adresini üretir. */
function webBaseFromOrigin(origin: string): string | null {
  const u = origin.trim().replace(/\.git$/, '')
  const ssh = u.match(/^git@([^:]+):(.+)$/)
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`
  if (/^https?:\/\//.test(u)) return u.replace(/^(https?:\/\/)[^@/]+@/, '$1')
  return null
}

/** Dosyanın commit'teki kalıcı bağlantısı (silinmişse commit sayfası). */
function fileUrl(web: string, commit: string, path: string, deleted: boolean): string {
  let host = ''
  try {
    host = new URL(web).hostname
  } catch {
    /* geç */
  }
  const isGithub = host === 'github.com'
  const enc = path.split('/').map(encodeURIComponent).join('/')
  if (deleted) return isGithub ? `${web}/commit/${commit}` : `${web}/-/commit/${commit}`
  return isGithub ? `${web}/blob/${commit}/${enc}` : `${web}/-/blob/${commit}/${enc}`
}

async function countBehindAhead(
  repo: string,
  branch: string
): Promise<{ behind: number; ahead: number }> {
  const behind =
    Number.parseInt(
      (await runGit(repo, ['rev-list', '--count', `${branch}..refs/remotes/origin/${branch}`])).trim(),
      10
    ) || 0
  const ahead =
    Number.parseInt(
      (await runGit(repo, ['rev-list', '--count', `refs/remotes/origin/${branch}..${branch}`])).trim(),
      10
    ) || 0
  return { behind, ahead }
}

function workspacesDir(): string {
  return join(app.getPath('userData'), 'workspaces')
}

async function listGitlabProjects(): Promise<GitProject[]> {
  const cred = await getSecret('gitlab')
  if (!cred) throw new Error('Önce Profil’den GitLab’a bağlan.')
  const base = (cred.baseUrl ?? 'https://gitlab.com').replace(/\/$/, '')
  const url = `${base}/api/v4/projects?membership=true&min_access_level=30&per_page=100&order_by=last_activity_at&simple=true`
  const res = await fetch(url, { headers: { 'PRIVATE-TOKEN': cred.token } })
  if (!res.ok) throw new Error(`GitLab: ${res.status}`)
  const data = (await res.json()) as Array<{
    id: number
    name: string
    path_with_namespace: string
    http_url_to_repo: string
    last_activity_at?: string
    description?: string
  }>
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    pathWithNamespace: p.path_with_namespace,
    httpUrl: p.http_url_to_repo,
    lastActivityAt: p.last_activity_at,
    description: p.description ?? undefined
  }))
}

/** Token'ı HTTPS URL'ine gömer (klonlama için geçici). */
function urlWithToken(httpUrl: string, token: string): string {
  return httpUrl.replace(/^https:\/\//, `https://oauth2:${encodeURIComponent(token)}@`)
}

export function registerRepoIpc(): void {
  ipcMain.handle('repo:listProjects', async (_event, provider: Provider): Promise<GitProject[]> => {
    if (provider === 'gitlab') return listGitlabProjects()
    throw new Error('Şimdilik yalnızca GitLab destekleniyor')
  })

  ipcMain.handle(
    'repo:clone',
    async (
      _event,
      provider: Provider,
      httpUrl: string,
      pathWithNamespace: string,
      destBase?: string
    ): Promise<CloneResult> => {
      try {
        const cred = await getSecret(provider)
        if (!cred) return { ok: false, error: 'Bağlantı yok — önce Profil’den bağlan.' }

        // Konum: verilmişse oraya <repo-adı>, yoksa app workspace'i.
        const repoName = (pathWithNamespace.split('/').pop() ?? 'repo').replace(
          /[^a-zA-Z0-9._-]/g,
          '__'
        )
        const base = destBase && destBase.trim() ? destBase : workspacesDir()
        const dest = join(base, repoName)
        await fsp.mkdir(base, { recursive: true })

        // Zaten klonluysa onu kullan.
        try {
          await fsp.access(join(dest, '.git'))
          return { ok: true, path: dest }
        } catch {
          /* yok, klonla */
        }

        await exec('git', ['clone', urlWithToken(httpUrl, cred.token), dest], {
          maxBuffer: 1024 * 1024 * 64
        })
        // Token'ı .git/config'de bırakma — temiz URL'ye çevir (push'ta yeniden enjekte edilecek).
        await exec('git', ['remote', 'set-url', 'origin', httpUrl], { cwd: dest })
        return { ok: true, path: dest }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  // Onayla ve Gönder: her dosya AYRI commit → toplu sürüm tag'i → push.
  ipcMain.handle(
    'repo:send',
    async (
      _event,
      repoPath: string,
      items: Array<{ path: string; message: string; note?: string }>
    ): Promise<SendResult> => {
      try {
        const status = await runGit(repoPath, ['status', '--porcelain'])
        if (!status.trim()) return { ok: false, error: 'Gönderilecek değişiklik yok.' }
        if (!items || items.length === 0) return { ok: false, error: 'Gönderilecek dosya yok.' }

        // Jira için: commit'lemeden ÖNCE eski(HEAD)/yeni farkını ve sürümü topla.
        const analyses: AnalysisEntry[] = []
        for (const it of items) {
          const exists = existsSync(join(repoPath, it.path))
          let version = 1
          try {
            version =
              (Number.parseInt(
                (await runGit(repoPath, ['rev-list', '--count', 'HEAD', '--', it.path])).trim(),
                10
              ) || 0) + 1
          } catch {
            version = 1
          }
          const diff = await fileDiffData(repoPath, it.path)
          const st: AnalysisEntry['status'] = !exists ? 'deleted' : !diff.old ? 'added' : 'modified'
          analyses.push({
            path: it.path,
            version,
            status: st,
            note: it.note,
            old: diff.old ?? '',
            new: diff.new ?? ''
          })
        }

        // Her dosya: türevini (.derived/…) üret, orijinal + türev birlikte AYRI commit.
        const commitByPath: Record<string, string> = {}
        for (const it of items) {
          const paths = [it.path]
          if (existsSync(join(repoPath, it.path))) {
            const derived = await writeDerived(repoPath, it.path)
            if (derived) paths.push(derived)
          } else {
            // Silinen dosyanın türevini de sil.
            const derived = derivedPathFor(it.path)
            try {
              await fsp.rm(join(repoPath, derived))
              paths.push(derived)
            } catch {
              /* türev yoktu */
            }
          }
          for (const p of paths) await runGit(repoPath, ['add', '-A', '--', p])
          await runGit(repoPath, [
            'commit',
            '-m',
            it.message.trim() || `${it.path} güncellendi`,
            '--',
            ...paths
          ])
          commitByPath[it.path] = (await runGit(repoPath, ['rev-parse', 'HEAD'])).trim()
        }

        // Sürüm etiketi: vYYYY.MM.DD-N (o güne ait sıra)
        const d = new Date()
        const prefix = `v${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`
        let sameDay: string[] = []
        try {
          sameDay = (await runGit(repoPath, ['tag', '--list', `${prefix}-*`]))
            .split('\n')
            .filter(Boolean)
        } catch {
          /* etiket yok */
        }
        const tag = `${prefix}-${sameDay.length + 1}`
        await runGit(repoPath, ['tag', tag])

        // Push hedefi: HTTPS ise token enjekte et, SSH ise origin (anahtar).
        const originUrl = (await runGit(repoPath, ['remote', 'get-url', 'origin'])).trim()
        let target = 'origin'
        if (/^https?:\/\//.test(originUrl)) {
          const cred = await getSecret('gitlab')
          if (!cred) return { ok: false, error: 'HTTPS push için Profil’den GitLab’a bağlan.' }
          target = originUrl.replace(/^https:\/\//, `https://oauth2:${encodeURIComponent(cred.token)}@`)
        }
        await runGit(repoPath, ['push', target, 'HEAD'])
        await runGit(repoPath, ['push', target, tag])

        // Analizlere repodaki kalıcı bağlantıyı ekle (commit permalink).
        const web = webBaseFromOrigin(originUrl)
        if (web) {
          for (const a of analyses) {
            const h = commitByPath[a.path]
            if (h) a.url = fileUrl(web, h, a.path, a.status === 'deleted')
          }
        }

        // Jira: her analiz için issue aç + kendine ata + Done (best-effort, push'u bloklamaz).
        let jira = { created: 0, failed: 0 }
        try {
          jira = await sendAnalyses(analyses)
        } catch {
          /* Jira erişilemezse doküman gönderimi zaten tamam */
        }

        return { ok: true, tag, jira }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  // Uzak durum: fetch + kaç commit geride/ileride.
  ipcMain.handle(
    'repo:remoteStatus',
    async (_event, repoPath: string): Promise<{ ahead: number; behind: number } | null> => {
      try {
        const branch = await currentBranch(repoPath)
        const target = await remoteTarget(repoPath)
        await runGit(repoPath, [
          'fetch',
          target,
          `+refs/heads/${branch}:refs/remotes/origin/${branch}`
        ])
        return await countBehindAhead(repoPath, branch)
      } catch {
        return null
      }
    }
  )

  // Güncelle (pull, ff-only).
  ipcMain.handle(
    'repo:pull',
    async (
      _event,
      repoPath: string
    ): Promise<{ ok: boolean; updated: boolean; error?: string }> => {
      try {
        const branch = await currentBranch(repoPath)
        const target = await remoteTarget(repoPath)
        await runGit(repoPath, [
          'fetch',
          target,
          `+refs/heads/${branch}:refs/remotes/origin/${branch}`
        ])
        const { behind } = await countBehindAhead(repoPath, branch)
        if (behind === 0) return { ok: true, updated: false }
        await runGit(repoPath, ['merge', '--ff-only', `refs/remotes/origin/${branch}`])
        return { ok: true, updated: true }
      } catch (e) {
        return { ok: false, updated: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )
}
