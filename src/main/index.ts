import { app, shell, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import { join, extname, dirname } from 'path'
import { promises as fsp } from 'fs'
import { registerConnectionsIpc } from './connections'
import { registerGitIpc } from './git'
import { registerFsManagerIpc } from './fsmanager'
import { registerRepoIpc } from './repo'
import { registerConvertIpc } from './convert'

/** Uygulama meta bilgisi (Ayarlar > Hakkında için). */
const APP_META = {
  repository: 'https://github.com/cosarberk/sivano',
  author: 'Relteco',
  license: 'UNLICENSED'
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: 'Sivano',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Dış bağlantılar sistem tarayıcısında açılsın.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Renderer'ın kullandığı IPC uçları. */
function registerIpc(): void {
  ipcMain.handle('app:getInfo', () => ({
    name: 'Sivano',
    version: app.getVersion(),
    repository: APP_META.repository,
    author: APP_META.author,
    license: APP_META.license,
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome
    },
    platform: process.platform,
    arch: process.arch
  }))

  // İşletim sisteminin kendi bildirim sistemi (app-içi değil).
  ipcMain.handle('notify:show', (_event, title: string, body: string) => {
    try {
      if (Notification.isSupported()) new Notification({ title, body }).show()
    } catch {
      /* bildirim başarısızsa yoksay */
    }
  })

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      return shell.openExternal(url)
    }
    return undefined
  })

  // --- Dosya sistemi ---
  ipcMain.handle('fs:home', () => app.getPath('home'))

  ipcMain.handle('fs:parent', (_event, target: string) => dirname(target))

  ipcMain.handle('fs:pickFolder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('fs:list', async (_event, dirPath: string) => {
    const dirents = await fsp.readdir(dirPath, { withFileTypes: true })
    return Promise.all(
      dirents
        .filter((d) => !d.name.startsWith('.'))
        .map(async (d) => {
          const full = join(dirPath, d.name)
          const isDir = d.isDirectory()
          let size = 0
          let mtimeMs = 0
          try {
            const st = await fsp.stat(full)
            size = st.size
            mtimeMs = st.mtimeMs
          } catch {
            /* erişilemeyen öğeyi atla */
          }
          return {
            name: d.name,
            path: full,
            isDir,
            size,
            mtimeMs,
            ext: isDir ? '' : extname(d.name).slice(1).toLowerCase()
          }
        })
    )
  })
}

app.whenReady().then(() => {
  registerIpc()
  registerConnectionsIpc()
  registerGitIpc()
  registerFsManagerIpc()
  registerRepoIpc()
  registerConvertIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
