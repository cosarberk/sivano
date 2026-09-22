import { app, ipcMain } from 'electron'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { promises as fsp, existsSync } from 'fs'
import { join, extname, dirname } from 'path'
import { tmpdir } from 'os'
import * as XLSX from 'xlsx'

/** Türev metin dosyalarının tutulduğu klasör (repo içinde, gizli, app'te görünmez). */
export const DERIVED_DIR = '.derived'

const exec = promisify(execFile)

export type FileDiffMode = 'text' | 'converted' | 'unsupported' | 'missing'
export interface FileDiff {
  mode: FileDiffMode
  old?: string
  new?: string
  converter?: string
}

/** Gömülü ikili yolunu çözer; yoksa sistem PATH'ine düşer (dev). */
function binPath(name: string): string {
  const platform =
    process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  const candidates = [
    join(process.resourcesPath ?? '', 'bin', platform, exe),
    join(app.getAppPath(), 'resources', 'bin', platform, exe),
    join(process.cwd(), 'resources', 'bin', platform, exe)
  ]
  for (const c of candidates) {
    try {
      if (existsSync(c)) return c
    } catch {
      /* geç */
    }
  }
  return name // sistem PATH (dev)
}

const MAX = 1024 * 1024 * 64

interface Converter {
  /** Harici ikili adı (varsa). SheetJS gibi saf-JS dönüştürücülerde yok. */
  bin?: string
  run: (file: string) => Promise<string>
}

const PANDOC_EXT = new Set(['docx', 'odt', 'pptx', 'rtf', 'epub'])
const XLSX_EXT = new Set(['xlsx', 'xls', 'xlsm', 'ods'])
const UNSUPPORTED_EXT = new Set([
  'doc', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp',
  'zip', 'rar', '7z', 'gz', 'mp4', 'mp3', 'mov', 'exe', 'bin'
])

/** Excel/ODS → metin. Her sayfa (çok sayfalı belgeler için) ayrı bölüm olarak yazılır. */
function spreadsheetToText(file: string): string {
  const wb = XLSX.readFile(file)
  const parts: string[] = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const csv = ws ? XLSX.utils.sheet_to_csv(ws) : ''
    parts.push(`### ${name}\n\n${csv.trimEnd()}`)
  }
  return parts.join('\n\n')
}

function converterFor(ext: string): Converter | null {
  if (PANDOC_EXT.has(ext)) {
    return {
      bin: 'pandoc',
      run: async (file) =>
        (await exec(binPath('pandoc'), [file, '-t', 'gfm', '--wrap=none'], { maxBuffer: MAX }))
          .stdout
    }
  }
  if (ext === 'pdf') {
    return {
      bin: 'pdftotext',
      run: async (file) =>
        (await exec(binPath('pdftotext'), ['-layout', file, '-'], { maxBuffer: MAX })).stdout
    }
  }
  if (XLSX_EXT.has(ext)) {
    // Saf-JS (SheetJS): gömülü ikili gerekmez, çok sayfa destekli.
    return { run: async (file) => spreadsheetToText(file) }
  }
  return null
}

/** HEAD'deki dosya içeriğini binary-güvenli şekilde Buffer olarak alır. */
function gitShowBuffer(repo: string, ref: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    const p = spawn('git', ['show', ref], { cwd: repo })
    p.stdout.on('data', (d: Buffer) => chunks.push(d))
    p.on('error', () => resolve(null))
    p.on('close', (code) => resolve(code === 0 ? Buffer.concat(chunks) : null))
  })
}

async function convertOrMissing(
  conv: Converter,
  file: string
): Promise<{ text?: string; missing?: boolean }> {
  try {
    return { text: await conv.run(file) }
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return { missing: true }
    return { text: '' }
  }
}

/** Bir dosyanın git-yolu için türev md yolunu döner (forward-slash). */
export function derivedPathFor(file: string): string {
  return `${DERIVED_DIR}/${file}.md`
}

/**
 * Dosyayı metne çevirip `.derived/<file>.md` altına yazar; commit'lenip GitLab'da
 * okunur diff sağlar. Dönüştürülemeyen/eksik ikili → null.
 */
export async function writeDerived(repo: string, file: string): Promise<string | null> {
  const ext = extname(file).slice(1).toLowerCase()
  const conv = converterFor(ext)
  if (!conv) return null
  const abs = join(repo, file)
  if (!existsSync(abs)) return null
  let text: string
  try {
    text = await conv.run(abs)
  } catch {
    return null // ikili yoksa/başarısızsa türev yazma
  }
  const rel = derivedPathFor(file)
  const outAbs = join(repo, rel)
  await fsp.mkdir(dirname(outAbs), { recursive: true })
  await fsp.writeFile(outAbs, text, 'utf8')
  return rel
}

export async function fileDiffData(repo: string, file: string): Promise<FileDiff> {
    const ext = extname(file).slice(1).toLowerCase()
    const conv = converterFor(ext)

    if (conv) {
      // Yeni (çalışma dizini)
      let newText = ''
      if (existsSync(join(repo, file))) {
        const r = await convertOrMissing(conv, join(repo, file))
        if (r.missing) return { mode: 'missing', converter: conv.bin }
        newText = r.text ?? ''
      }
      // Eski (HEAD) — geçici dosyaya yazıp dönüştür
      let oldText = ''
      const buf = await gitShowBuffer(repo, `HEAD:${file}`)
      if (buf) {
        const tmp = join(tmpdir(), `sivano-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`)
        await fsp.writeFile(tmp, buf)
        const r = await convertOrMissing(conv, tmp)
        await fsp.unlink(tmp).catch(() => undefined)
        if (r.missing) return { mode: 'missing', converter: conv.bin }
        oldText = r.text ?? ''
      }
      return { mode: 'converted', old: oldText, new: newText, converter: conv.bin }
    }

    if (UNSUPPORTED_EXT.has(ext)) return { mode: 'unsupported' }

    // Metin dosyası: ham içerik
    let oldText = ''
    const buf = await gitShowBuffer(repo, `HEAD:${file}`)
    if (buf) oldText = buf.toString('utf8')
    let newText = ''
    try {
      newText = await fsp.readFile(join(repo, file), 'utf8')
    } catch {
      newText = ''
    }
    return { mode: 'text', old: oldText, new: newText }
}

export function registerConvertIpc(): void {
  ipcMain.handle('convert:fileDiff', (_event, repo: string, file: string): Promise<FileDiff> =>
    fileDiffData(repo, file)
  )
}
