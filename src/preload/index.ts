import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConnectInput,
  ConnectResult,
  ConnectionStatus,
  Provider
} from '../main/connections'

export type { ConnectInput, ConnectResult, ConnectionStatus, Provider, AuthMethod } from '../main/connections'
export type { GitFile, GitFileStatus, GitDiff, Commit } from '../main/git'
export type { InstalledApp } from '../main/fsmanager'
export type { GitProject, CloneResult, SendResult } from '../main/repo'
export type { FileDiff, FileDiffMode } from '../main/convert'

import type { GitFile, GitDiff, Commit } from '../main/git'
import type { GitProject, CloneResult, SendResult } from '../main/repo'
import type { FileDiff } from '../main/convert'

export interface AppInfo {
  name: string
  version: string
  repository: string
  author: string
  license: string
  versions: { electron: string; node: string; chrome: string }
  platform: string
  arch: string
}

/**
 * Renderer'a açılan güvenli köprü. Dosya yöneticisi, git, pandoc, bildirim ve
 * OAuth uçları ilerleyen adımlarda buraya eklenecek.
 */
export interface FsEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  mtimeMs: number
  ext: string
}

const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:getInfo'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  fs: {
    home: (): Promise<string> => ipcRenderer.invoke('fs:home'),
    parent: (target: string): Promise<string> => ipcRenderer.invoke('fs:parent', target),
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke('fs:pickFolder'),
    list: (dirPath: string): Promise<FsEntry[]> => ipcRenderer.invoke('fs:list', dirPath),
    open: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:open', filePath),
    listApps: (): Promise<import('../main/fsmanager').InstalledApp[]> =>
      ipcRenderer.invoke('fs:listApps'),
    openWith: (filePath: string, appLaunch: string, setDefault: boolean): Promise<string> =>
      ipcRenderer.invoke('fs:openWith', filePath, appLaunch, setDefault),
    pickApp: (): Promise<string | null> => ipcRenderer.invoke('fs:pickApp'),
    createFile: (dir: string, name: string): Promise<string> =>
      ipcRenderer.invoke('fs:createFile', dir, name),
    createFolder: (dir: string, name: string): Promise<string> =>
      ipcRenderer.invoke('fs:createFolder', dir, name),
    rename: (target: string, newName: string): Promise<string> =>
      ipcRenderer.invoke('fs:rename', target, newName),
    trash: (target: string): Promise<boolean> => ipcRenderer.invoke('fs:trash', target),
    copy: (src: string, destDir: string): Promise<string> =>
      ipcRenderer.invoke('fs:copy', src, destDir),
    move: (src: string, destDir: string): Promise<string> =>
      ipcRenderer.invoke('fs:move', src, destDir)
  },
  conn: {
    list: (): Promise<ConnectionStatus[]> => ipcRenderer.invoke('conn:list'),
    connect: (input: ConnectInput): Promise<ConnectResult> =>
      ipcRenderer.invoke('conn:connect', input),
    disconnect: (provider: Provider): Promise<ConnectionStatus[]> =>
      ipcRenderer.invoke('conn:disconnect', provider)
  },
  git: {
    isRepo: (repo: string): Promise<boolean> => ipcRenderer.invoke('git:isRepo', repo),
    status: (repo: string): Promise<GitFile[]> => ipcRenderer.invoke('git:status', repo),
    diff: (repo: string, file: string): Promise<GitDiff> =>
      ipcRenderer.invoke('git:diff', repo, file),
    fileVersion: (repo: string, file: string): Promise<number> =>
      ipcRenderer.invoke('git:fileVersion', repo, file),
    log: (repo: string, limit?: number): Promise<Commit[]> =>
      ipcRenderer.invoke('git:log', repo, limit),
    trackedFiles: (repo: string): Promise<string[]> =>
      ipcRenderer.invoke('git:trackedFiles', repo)
  },
  repo: {
    listProjects: (provider: Provider): Promise<GitProject[]> =>
      ipcRenderer.invoke('repo:listProjects', provider),
    clone: (
      provider: Provider,
      httpUrl: string,
      pathWithNamespace: string,
      destBase?: string
    ): Promise<CloneResult> =>
      ipcRenderer.invoke('repo:clone', provider, httpUrl, pathWithNamespace, destBase),
    send: (
      repoPath: string,
      items: Array<{ path: string; message: string; note?: string }>
    ): Promise<SendResult> => ipcRenderer.invoke('repo:send', repoPath, items),
    pull: (repoPath: string): Promise<{ ok: boolean; updated: boolean; error?: string }> =>
      ipcRenderer.invoke('repo:pull', repoPath),
    remoteStatus: (repoPath: string): Promise<{ ahead: number; behind: number } | null> =>
      ipcRenderer.invoke('repo:remoteStatus', repoPath)
  },
  convert: {
    fileDiff: (repo: string, file: string): Promise<FileDiff> =>
      ipcRenderer.invoke('convert:fileDiff', repo, file)
  },
  notify: {
    show: (title: string, body: string): Promise<void> =>
      ipcRenderer.invoke('notify:show', title, body)
  },
  diag: {
    check: (
      tool: 'git' | 'pandoc' | 'pdftotext'
    ): Promise<{ ok: boolean; version?: string; source: 'bundled' | 'system'; error?: string }> =>
      ipcRenderer.invoke('diag:check', tool)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (window tipi preload ortamında tanımlı değil)
  window.api = api
}

export type PreloadApi = typeof api
