import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { promises as fsp } from 'fs'
import { join } from 'path'
import { resolveGit } from './bin'

const exec = promisify(execFile)

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'

export interface GitFile {
  path: string
  status: GitFileStatus
}

export interface GitDiff {
  old: string
  new: string
}

export interface Commit {
  hash: string
  short: string
  author: string
  date: string
  subject: string
  files: string[]
  tags: string[]
}

async function git(repo: string, args: string[]): Promise<string> {
  const { stdout } = await exec(resolveGit(), args, {
    cwd: repo,
    maxBuffer: 1024 * 1024 * 32
  })
  return stdout
}

function mapStatus(xy: string): GitFileStatus {
  if (xy === '??') return 'untracked'
  const code = xy.replace(/\s/g, '')[0]
  if (code === 'A') return 'added'
  if (code === 'D') return 'deleted'
  if (code === 'R') return 'renamed'
  return 'modified'
}

export function registerGitIpc(): void {
  ipcMain.handle('git:isRepo', async (_event, repo: string): Promise<boolean> => {
    try {
      const out = await git(repo, ['rev-parse', '--is-inside-work-tree'])
      return out.trim() === 'true'
    } catch {
      return false
    }
  })

  ipcMain.handle('git:status', async (_event, repo: string): Promise<GitFile[]> => {
    // --untracked-files=all: yeni klasörlerin içindeki dosyaları da tek tek listeler.
    const out = await git(repo, ['status', '--porcelain', '--untracked-files=all'])
    const files: GitFile[] = []
    for (const line of out.split('\n')) {
      if (!line.trim()) continue
      const xy = line.slice(0, 2)
      // Yeniden adlandırmada "eski -> yeni" olur; yeni adı al.
      const rest = line.slice(3)
      const path = rest.includes(' -> ') ? rest.split(' -> ')[1].trim() : rest.trim()
      const base = path.split('/').pop() ?? path
      // Gizli/kilit/geçici dosyaları gösterme: dotfile'lar (.~lock. dahil),
      // Office temp (~$...), kilit dosyaları (...#).
      if (base.startsWith('.') || base.startsWith('~$') || base.endsWith('#')) continue
      // Türev klasörü (otomatik üretilir, kullanıcı görmesin).
      if (path === '.derived' || path.startsWith('.derived/')) continue
      files.push({ path, status: mapStatus(xy) })
    }
    return files
  })

  // Şu an takip edilen (mevcut) dosyalar — silinmişleri ayırt etmek için.
  ipcMain.handle('git:trackedFiles', async (_event, repo: string): Promise<string[]> => {
    try {
      const out = await git(repo, ['ls-files'])
      return out
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((f) => f !== '.derived' && !f.startsWith('.derived/'))
    } catch {
      return []
    }
  })

  ipcMain.handle('git:log', async (_event, repo: string, limit = 300): Promise<Commit[]> => {
    try {
      const fmt = `%x1e%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1f%D`
      const out = await git(repo, [
        'log',
        '--no-color',
        `--pretty=format:${fmt}`,
        '--name-only',
        '-n',
        String(limit)
      ])
      const commits: Commit[] = []
      for (const chunk of out.split('\x1e')) {
        if (!chunk.trim()) continue
        const lines = chunk.split('\n')
        const [hash, short, author, date, subject, refs = ''] = lines[0].split('\x1f')
        const files = lines
          .slice(1)
          .map((l) => l.trim())
          .filter(Boolean)
          .filter((f) => f !== '.derived' && !f.startsWith('.derived/'))
        const tags = refs
          .split(',')
          .map((r) => r.trim())
          .filter((r) => r.startsWith('tag: '))
          .map((r) => r.slice(5))
        commits.push({ hash, short, author, date, subject, files, tags })
      }
      return commits
    } catch {
      return []
    }
  })

  // Bir dosyanın bağımsız sürümü = o yola dokunan commit sayısı.
  ipcMain.handle('git:fileVersion', async (_event, repo: string, file: string): Promise<number> => {
    try {
      const out = await git(repo, ['rev-list', '--count', 'HEAD', '--', file])
      return Number.parseInt(out.trim(), 10) || 0
    } catch {
      return 0
    }
  })

  // Eski (HEAD) ve yeni (çalışma dizini) içeriğini döner; farkı renderer hesaplar.
  ipcMain.handle('git:diff', async (_event, repo: string, file: string): Promise<GitDiff> => {
    let oldText = ''
    try {
      oldText = await git(repo, ['show', `HEAD:${file}`])
    } catch {
      oldText = '' // yeni dosya: HEAD'de yok
    }
    let newText = ''
    try {
      newText = await fsp.readFile(join(repo, file), 'utf-8')
    } catch {
      newText = '' // silinmiş dosya: çalışma dizininde yok
    }
    return { old: oldText, new: newText }
  })
}
