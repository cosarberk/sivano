import { app, ipcMain, shell, dialog, BrowserWindow, type OpenDialogOptions } from 'electron'
import { promises as fsp } from 'fs'
import { spawn } from 'child_process'
import { join, extname, basename, dirname } from 'path'

export interface InstalledApp {
  name: string
  /** Platforma göre başlatma kimliği: linux .desktop yolu, mac .app yolu, win exe yolu. */
  launch: string
}

/* ---------- varsayılan "birlikte aç" eşlemesi ---------- */
function defaultsFile(): string {
  return join(app.getPath('userData'), 'openwith.json')
}
async function readDefaults(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await fsp.readFile(defaultsFile(), 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}
async function writeDefaults(map: Record<string, string>): Promise<void> {
  await fsp.writeFile(defaultsFile(), JSON.stringify(map, null, 2), 'utf-8')
}

/* ---------- başlatma ---------- */
function launchWithApp(appId: string, filePath: string): void {
  if (process.platform === 'darwin' && appId.endsWith('.app')) {
    spawn('open', ['-a', appId, filePath], { detached: true, stdio: 'ignore' }).unref()
    return
  }
  if (process.platform === 'linux' && appId.endsWith('.desktop')) {
    const child = spawn('gio', ['launch', appId, filePath], { detached: true, stdio: 'ignore' })
    child.on('error', () => {
      // gio yoksa .desktop içindeki Exec'i ayrıştırıp çalıştır
      fsp
        .readFile(appId, 'utf-8')
        .then((c) => {
          const exec = parseDesktopEntry(c).exec
          if (exec) {
            const cmd = exec.replace(/%[a-zA-Z]/g, '').trim()
            spawn('sh', ['-c', `${cmd} "${filePath}"`], { detached: true, stdio: 'ignore' }).unref()
          }
        })
        .catch(() => undefined)
    })
    child.unref()
    return
  }
  spawn(appId, [filePath], { detached: true, stdio: 'ignore' }).unref()
}

/* ---------- uygulama listeleme (platforma göre) ---------- */
function parseDesktopEntry(content: string): {
  name?: string
  exec?: string
  type?: string
  noDisplay?: boolean
} {
  const result: { name?: string; exec?: string; type?: string; noDisplay?: boolean } = {}
  let inEntry = false
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('[')) {
      inEntry = line === '[Desktop Entry]'
      continue
    }
    if (!inEntry || !line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (key === 'Name' && !result.name) result.name = value
    else if (key === 'Exec') result.exec = value
    else if (key === 'Type') result.type = value
    else if (key === 'NoDisplay') result.noDisplay = value.toLowerCase() === 'true'
  }
  return result
}

async function listLinuxApps(): Promise<InstalledApp[]> {
  const base = [
    '/usr/share/applications',
    '/usr/local/share/applications',
    join(app.getPath('home'), '.local/share/applications')
  ]
  const fromXdg = (process.env.XDG_DATA_DIRS ?? '')
    .split(':')
    .filter(Boolean)
    .map((d) => join(d, 'applications'))
  const dirs = [...new Set([...base, ...fromXdg])]

  const byName = new Map<string, InstalledApp>()
  for (const dir of dirs) {
    let files: string[]
    try {
      files = await fsp.readdir(dir)
    } catch {
      continue
    }
    for (const f of files) {
      if (!f.endsWith('.desktop')) continue
      try {
        const entry = parseDesktopEntry(await fsp.readFile(join(dir, f), 'utf-8'))
        if (entry.type !== 'Application' || entry.noDisplay || !entry.name) continue
        if (!byName.has(entry.name)) byName.set(entry.name, { name: entry.name, launch: join(dir, f) })
      } catch {
        /* bozuk .desktop atla */
      }
    }
  }
  return [...byName.values()]
}

async function listMacApps(): Promise<InstalledApp[]> {
  const dirs = ['/Applications', '/System/Applications', join(app.getPath('home'), 'Applications')]
  const byName = new Map<string, InstalledApp>()
  for (const dir of dirs) {
    let files: string[]
    try {
      files = await fsp.readdir(dir)
    } catch {
      continue
    }
    for (const f of files) {
      if (!f.endsWith('.app')) continue
      const name = f.slice(0, -4)
      if (!byName.has(name)) byName.set(name, { name, launch: join(dir, f) })
    }
  }
  return [...byName.values()]
}

async function walkLnk(dir: string, out: Map<string, InstalledApp>, depth: number): Promise<void> {
  if (depth > 4) return
  let items: import('fs').Dirent[]
  try {
    items = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const it of items) {
    const full = join(dir, it.name)
    if (it.isDirectory()) {
      await walkLnk(full, out, depth + 1)
    } else if (it.name.toLowerCase().endsWith('.lnk')) {
      try {
        const link = shell.readShortcutLink(full)
        if (link.target && /\.exe$/i.test(link.target)) {
          const name = it.name.replace(/\.lnk$/i, '')
          if (!out.has(name)) out.set(name, { name, launch: link.target })
        }
      } catch {
        /* çözülemeyen kısayolu atla */
      }
    }
  }
}

async function listWinApps(): Promise<InstalledApp[]> {
  const dirs = [
    join(process.env.ProgramData ?? '', 'Microsoft/Windows/Start Menu/Programs'),
    join(process.env.APPDATA ?? '', 'Microsoft/Windows/Start Menu/Programs')
  ].filter(Boolean)
  const byName = new Map<string, InstalledApp>()
  for (const dir of dirs) await walkLnk(dir, byName, 0)
  return [...byName.values()]
}

async function listApps(): Promise<InstalledApp[]> {
  let apps: InstalledApp[]
  if (process.platform === 'linux') apps = await listLinuxApps()
  else if (process.platform === 'darwin') apps = await listMacApps()
  else apps = await listWinApps()
  return apps.sort((a, b) => a.name.localeCompare(b.name))
}

/** Hedefte aynı isim varsa "ad (kopya)", "ad (kopya 2)"… üretir. */
async function uniqueDest(destDir: string, name: string): Promise<string> {
  const ext = extname(name)
  const stem = ext ? basename(name, ext) : name
  let candidate = join(destDir, name)
  let i = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fsp.access(candidate)
    } catch {
      return candidate // yok → kullanılabilir
    }
    i++
    const suffix = i === 1 ? ' (kopya)' : ` (kopya ${i})`
    candidate = join(destDir, `${stem}${suffix}${ext}`)
  }
}

/* ---------- IPC ---------- */
export function registerFsManagerIpc(): void {
  ipcMain.handle('fs:open', async (_event, filePath: string): Promise<string> => {
    const ext = extname(filePath).slice(1).toLowerCase()
    const defaults = await readDefaults()
    if (defaults[ext]) {
      try {
        launchWithApp(defaults[ext], filePath)
        return ''
      } catch (e) {
        return e instanceof Error ? e.message : String(e)
      }
    }
    return shell.openPath(filePath)
  })

  ipcMain.handle('fs:listApps', (): Promise<InstalledApp[]> => listApps())

  ipcMain.handle(
    'fs:openWith',
    async (_event, filePath: string, appLaunch: string, setDefault: boolean): Promise<string> => {
      try {
        launchWithApp(appLaunch, filePath)
        if (setDefault) {
          const ext = extname(filePath).slice(1).toLowerCase()
          const map = await readDefaults()
          map[ext] = appLaunch
          await writeDefaults(map)
        }
        return ''
      } catch (e) {
        return e instanceof Error ? e.message : String(e)
      }
    }
  )

  ipcMain.handle('fs:pickApp', async (): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = { properties: ['openFile'], title: 'Uygulama seç' }
    const res = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle('fs:createFile', async (_event, dir: string, name: string): Promise<string> => {
    const target = join(dir, name)
    await fsp.writeFile(target, '', { flag: 'wx' })
    return target
  })

  ipcMain.handle('fs:createFolder', async (_event, dir: string, name: string): Promise<string> => {
    const target = join(dir, name)
    await fsp.mkdir(target)
    return target
  })

  ipcMain.handle('fs:rename', async (_event, target: string, newName: string): Promise<string> => {
    const next = join(dirname(target), newName)
    await fsp.rename(target, next)
    return next
  })

  ipcMain.handle('fs:trash', async (_event, target: string): Promise<boolean> => {
    await shell.trashItem(target)
    return true
  })

  ipcMain.handle('fs:copy', async (_event, src: string, destDir: string): Promise<string> => {
    const dest = await uniqueDest(destDir, basename(src))
    await fsp.cp(src, dest, { recursive: true })
    return dest
  })

  ipcMain.handle('fs:move', async (_event, src: string, destDir: string): Promise<string> => {
    const dest = await uniqueDest(destDir, basename(src))
    try {
      await fsp.rename(src, dest)
    } catch {
      await fsp.cp(src, dest, { recursive: true, force: true })
      await fsp.rm(src, { recursive: true, force: true })
    }
    return dest
  })
}
