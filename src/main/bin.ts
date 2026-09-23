import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

function platformDir(): string {
  return process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'
}

/** Gömülü ikililerin aranacağı kök klasörler (paketli + dev). */
function roots(): string[] {
  const dir = platformDir()
  const list = [join(process.resourcesPath ?? '', 'bin', dir), join(process.cwd(), 'resources', 'bin', dir)]
  try {
    list.push(join(app.getAppPath(), 'resources', 'bin', dir))
  } catch {
    /* app hazır değilse geç */
  }
  return list
}

/** pandoc/pdftotext gibi tek isimli ikililer: gömülü varsa onu, yoksa sistem PATH. */
export function resolveBin(name: string): string {
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  for (const r of roots()) {
    const p = join(r, exe)
    try {
      if (existsSync(p)) return p
    } catch {
      /* geç */
    }
  }
  return name
}

let gitCache: string | null = null

/** git: gömülü (Windows'ta MinGit alt yolları dahil) varsa onu, yoksa sistem git. */
export function resolveGit(): string {
  if (gitCache) return gitCache
  const win = process.platform === 'win32'
  const exe = win ? 'git.exe' : 'git'
  const candidates: string[] = []
  for (const r of roots()) {
    candidates.push(join(r, exe))
    candidates.push(join(r, 'git', 'cmd', 'git.exe'))
    candidates.push(join(r, 'git', 'bin', exe))
  }
  for (const c of candidates) {
    try {
      if (existsSync(c)) {
        gitCache = c
        return c
      }
    } catch {
      /* geç */
    }
  }
  gitCache = 'git'
  return 'git'
}
