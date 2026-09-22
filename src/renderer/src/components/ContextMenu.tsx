import { useEffect, useRef, useState } from 'react'

export type MenuEntry =
  | 'sep'
  | { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }

interface ContextMenuProps {
  x: number
  y: number
  items: MenuEntry[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useEffect(() => {
    // Ekran kenarından taşmayı önle.
    const el = ref.current
    if (el) {
      const r = el.getBoundingClientRect()
      const nx = x + r.width > window.innerWidth ? window.innerWidth - r.width - 8 : x
      const ny = y + r.height > window.innerHeight ? window.innerHeight - r.height - 8 : y
      setPos({ x: Math.max(8, nx), y: Math.max(8, ny) })
    }
    const close = (): void => onClose()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [x, y, onClose])

  return (
    <div
      ref={ref}
      className="ctxmenu"
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === 'sep' ? (
          <div key={i} className="ctxmenu__sep" />
        ) : (
          <button
            key={i}
            className={`ctxmenu__item ${item.danger ? 'ctxmenu__item--danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              item.onClick()
              onClose()
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
