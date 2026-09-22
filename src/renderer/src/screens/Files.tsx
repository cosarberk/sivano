import { useCallback, useEffect, useRef, useState } from 'react'
import type { FsEntry } from '../../../preload'
import { useI18n } from '../i18n/I18nProvider'
import { FolderIcon, FilesIcon, UpIcon, DotsIcon, PinIcon } from '../components/icons'
import { ContextMenu, type MenuEntry } from '../components/ContextMenu'
import { NamePrompt } from '../components/NamePrompt'
import { AppPicker } from '../components/AppPicker'
import { RepoPicker } from '../components/RepoPicker'

const STORAGE_KEY = 'sivano.filesPath'

type PromptMode = 'newFile' | 'newFolder' | 'rename'
interface PromptState {
  mode: PromptMode
  target?: FsEntry
}
interface Clipboard {
  path: string
  name: string
  mode: 'copy' | 'cut'
}
interface MenuState {
  x: number
  y: number
  target: FsEntry | null
}

function detectSep(p: string): string {
  return p.includes('\\') ? '\\' : '/'
}

function formatSize(bytes: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${i === 0 ? n : n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`
}

export function Files(): JSX.Element {
  const { t, locale } = useI18n()
  const [path, setPath] = useState<string | null>(() => {
    try {
      // Aktif proje varsa oradan başla; yoksa son gezilen klasör.
      return localStorage.getItem('sivano.project') ?? localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [entries, setEntries] = useState<FsEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [appPickerFor, setAppPickerFor] = useState<FsEntry | null>(null)
  const [showRepoPicker, setShowRepoPicker] = useState(false)
  const [pinned, setPinned] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sivano.project')
    } catch {
      return null
    }
  })
  const [toast, setToast] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const toastTimer = useRef<number | null>(null)

  const showToast = (msg: string): void => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }

  const persist = (next: string | null): void => {
    setPath(next)
    setSelected(null)
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* yoksay */
    }
  }

  const load = useCallback(async (dir: string) => {
    try {
      const list = await window.api.fs.list(dir)
      list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
      setEntries(list)
      setError(null)
    } catch (e) {
      setEntries([])
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (path) load(path)
  }, [path, load])

  const reload = (): void => {
    if (path) load(path)
  }

  const pick = async (): Promise<void> => {
    try {
      const picked = await window.api.fs.pickFolder()
      if (picked) persist(picked)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const pinProject = async (): Promise<void> => {
    if (!path) return
    const ok = await window.api.git.isRepo(path)
    if (!ok) {
      showToast(t('fm.notRepoPin'))
      return
    }
    try {
      localStorage.setItem('sivano.project', path)
    } catch {
      /* yoksay */
    }
    setPinned(path)
    showToast(t('fm.pinnedToast'))
  }

  const onCloned = (clonedPath: string): void => {
    // Klonlanan repo hem gezinme yeri hem de sabit proje olsun.
    try {
      localStorage.setItem('sivano.project', clonedPath)
    } catch {
      /* yoksay */
    }
    setShowRepoPicker(false)
    setPinned(clonedPath)
    persist(clonedPath)
  }

  const goUp = async (): Promise<void> => {
    if (!path) return
    const parent = await window.api.fs.parent(path)
    if (parent && parent !== path) persist(parent)
  }

  const openEntry = async (entry: FsEntry): Promise<void> => {
    if (entry.isDir) persist(entry.path)
    else await window.api.fs.open(entry.path)
  }

  const copyItem = (entry: FsEntry): void => {
    setClipboard({ path: entry.path, name: entry.name, mode: 'copy' })
    showToast(`${entry.name} ${t('fm.copied')}`)
  }
  const cutItem = (entry: FsEntry): void => {
    setClipboard({ path: entry.path, name: entry.name, mode: 'cut' })
    showToast(`${entry.name} ${t('fm.cutState')}`)
  }

  const paste = async (): Promise<void> => {
    if (!clipboard || !path) return
    if (clipboard.mode === 'copy') {
      await window.api.fs.copy(clipboard.path, path)
    } else {
      await window.api.fs.move(clipboard.path, path)
      setClipboard(null)
    }
    showToast(`${clipboard.name} ${t('fm.pasted')}`)
    reload()
  }

  const remove = async (entry: FsEntry): Promise<void> => {
    if (!window.confirm(`${entry.name} — ${t('fm.deleteConfirm')}`)) return
    await window.api.fs.trash(entry.path)
    reload()
  }

  const confirmPrompt = async (name: string): Promise<void> => {
    if (!prompt || !path) return
    try {
      if (prompt.mode === 'newFile') await window.api.fs.createFile(path, name)
      else if (prompt.mode === 'newFolder') await window.api.fs.createFolder(path, name)
      else if (prompt.target) await window.api.fs.rename(prompt.target.path, name)
      setPrompt(null)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPrompt(null)
    }
  }

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragOver(false)
    if (!path) return
    const dropped = Array.from(e.dataTransfer.files)
    let n = 0
    for (const f of dropped) {
      const src = (f as unknown as { path?: string }).path
      if (!src) continue
      try {
        await window.api.fs.copy(src, path)
        n++
      } catch {
        /* atla */
      }
    }
    if (n > 0) {
      reload()
      showToast(`${n} ${t('fm.dropped')}`)
    }
  }

  const buildMenu = (target: FsEntry | null): MenuEntry[] => {
    if (!target) {
      return [
        { label: t('fm.newFile'), onClick: () => setPrompt({ mode: 'newFile' }) },
        { label: t('fm.newFolder'), onClick: () => setPrompt({ mode: 'newFolder' }) },
        'sep',
        { label: t('fm.paste'), onClick: paste, disabled: !clipboard }
      ]
    }
    const common: MenuEntry[] = [
      { label: t('fm.rename'), onClick: () => setPrompt({ mode: 'rename', target }) },
      { label: t('fm.copy'), onClick: () => copyItem(target) },
      { label: t('fm.cut'), onClick: () => cutItem(target) }
    ]
    if (target.isDir) {
      return [
        { label: t('fm.open'), onClick: () => openEntry(target) },
        'sep',
        ...common,
        { label: t('fm.paste'), onClick: paste, disabled: !clipboard },
        'sep',
        { label: t('fm.delete'), onClick: () => remove(target), danger: true }
      ]
    }
    return [
      { label: t('fm.open'), onClick: () => openEntry(target) },
      { label: t('fm.openWith'), onClick: () => setAppPickerFor(target) },
      'sep',
      ...common,
      'sep',
      { label: t('fm.delete'), onClick: () => remove(target), danger: true }
    ]
  }

  const promptTitle = (): string => {
    if (prompt?.mode === 'newFile') return t('fm.newFileTitle')
    if (prompt?.mode === 'newFolder') return t('fm.newFolderTitle')
    return t('fm.renameTitle')
  }

  if (!path) {
    return (
      <div className="empty">
        <span className="empty__icon">
          <FolderIcon size={36} />
        </span>
        <p className="empty__title">{t('files.emptyTitle')}</p>
        <p className="empty__desc">{t('files.emptyDesc')}</p>
        {error ? <p className="empty__desc" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="btn-primary" onClick={() => setShowRepoPicker(true)}>
            {t('repo.fromGitlab')}
          </button>
          <button className="back-btn" onClick={pick}>
            {t('files.choose')}
          </button>
        </div>
        {showRepoPicker ? (
          <RepoPicker onDone={onCloned} onClose={() => setShowRepoPicker(false)} />
        ) : null}
      </div>
    )
  }

  const sep = detectSep(path)
  const segments = path.split(/[\\/]/).filter(Boolean)
  const dateFmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })

  return (
    <div className="files">
      <div className="files__pathrow">
        <button className="back-btn" onClick={goUp} title={t('files.up')}>
          <UpIcon />
        </button>
        <div className="crumbs">
          {segments.map((seg, i) => {
            const target = (sep === '/' ? '/' : '') + segments.slice(0, i + 1).join(sep)
            return (
              <span key={i} className="crumb">
                <button onClick={() => persist(target)}>{seg}</button>
                {i < segments.length - 1 ? <span className="crumb__sep">/</span> : null}
              </span>
            )
          })}
        </div>
        <span className="files__spacer" />
        <span className="files__count">
          {entries.length} {t('files.items')}
        </span>
      </div>

      <div className="files__toolrow">
        <button className="chip-btn" onClick={() => setPrompt({ mode: 'newFile' })}>
          <FilesIcon size={13} /> {t('fm.newFile')}
        </button>
        <button className="chip-btn" onClick={() => setPrompt({ mode: 'newFolder' })}>
          <FolderIcon size={13} /> {t('fm.newFolder')}
        </button>
        {clipboard ? (
          <button className="chip-btn" onClick={paste}>
            {t('fm.paste')}
          </button>
        ) : null}
        <span className="files__spacer" />
        <button
          className={`chip-btn ${pinned === path ? 'chip-btn--active' : ''}`}
          onClick={pinProject}
        >
          <PinIcon size={13} /> {pinned === path ? t('fm.pinned') : t('fm.pin')}
        </button>
        <button className="chip-btn" onClick={() => setShowRepoPicker(true)}>
          {t('repo.fromGitlab')}
        </button>
        <button className="chip-btn" onClick={pick}>
          {t('files.change')}
        </button>
      </div>

      <div
        className={`files__list ${dragOver ? 'files__list--drop' : ''}`}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, target: null })
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {error ? (
          <p className="submit__none" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        ) : entries.length === 0 ? (
          <p className="submit__none">{t('files.folderEmpty')}</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.path}
              className={`frow ${entry.isDir ? 'frow--dir' : ''} ${
                selected === entry.path ? 'frow--selected' : ''
              } ${clipboard?.path === entry.path && clipboard.mode === 'cut' ? 'frow--cut' : ''}`}
              onClick={() => setSelected(entry.path)}
              onDoubleClick={() => openEntry(entry)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setSelected(entry.path)
                setMenu({ x: e.clientX, y: e.clientY, target: entry })
              }}
            >
              <span className="frow__icon">
                {entry.isDir ? <FolderIcon size={18} /> : <FilesIcon size={18} />}
              </span>
              <span className="frow__name">{entry.name}</span>
              <span className="frow__size">{entry.isDir ? '' : formatSize(entry.size)}</span>
              <span className="frow__date">{entry.mtimeMs ? dateFmt.format(entry.mtimeMs) : ''}</span>
              <button
                className="frow__kebab"
                title={t('fm.more')}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected(entry.path)
                  setMenu({ x: e.clientX, y: e.clientY, target: entry })
                }}
              >
                <DotsIcon size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {toast ? <div className="files__toast">{toast}</div> : null}

      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildMenu(menu.target)}
          onClose={() => setMenu(null)}
        />
      ) : null}

      {prompt ? (
        <NamePrompt
          title={promptTitle()}
          initial={prompt.mode === 'rename' ? prompt.target?.name : ''}
          confirmLabel={prompt.mode === 'rename' ? t('fm.save') : t('fm.create')}
          onConfirm={confirmPrompt}
          onCancel={() => setPrompt(null)}
        />
      ) : null}

      {appPickerFor ? (
        <AppPicker
          onPick={(launch, setDefault) => {
            window.api.fs.openWith(appPickerFor.path, launch, setDefault)
            setAppPickerFor(null)
          }}
          onClose={() => setAppPickerFor(null)}
        />
      ) : null}

      {showRepoPicker ? (
        <RepoPicker currentDir={path} onDone={onCloned} onClose={() => setShowRepoPicker(false)} />
      ) : null}
    </div>
  )
}
