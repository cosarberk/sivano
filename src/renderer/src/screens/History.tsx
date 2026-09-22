import { useEffect, useMemo, useRef, useState } from 'react'
import type { Commit } from '../../../preload'
import { useI18n } from '../i18n/I18nProvider'

const LANE_COLORS = ['#e0762e', '#d6425a', '#3f9d8f', '#8b6fc4', '#c9973f', '#4f8cff', '#46c46e']
const COL_W = 210
const ROW_H = 96
const HEADER_H = 44
const PAD = 40

interface GraphNode {
  commit: Commit
  lane: number
  pos: number
  version: number
}

function baseName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

export function History(): JSX.Element {
  const { t, locale } = useI18n()
  const repo = useMemo(() => {
    try {
      return localStorage.getItem('sivano.project')
    } catch {
      return null
    }
  }, [])
  const [commits, setCommits] = useState<Commit[]>([])
  const [tracked, setTracked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'table' | 'graph'>('table')

  useEffect(() => {
    if (!repo) {
      setLoading(false)
      return
    }
    Promise.all([window.api.git.log(repo), window.api.git.trackedFiles(repo)])
      .then(([cs, tf]) => {
        setCommits(cs)
        setTracked(new Set(tf))
      })
      .catch(() => setCommits([]))
      .finally(() => setLoading(false))
  }, [repo])

  const dateFmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })

  if (!repo) {
    return (
      <div className="empty">
        <p className="empty__title">{t('submit.noProjectTitle')}</p>
        <p className="empty__desc">{t('submit.noProjectDesc')}</p>
      </div>
    )
  }

  return (
    <div className="hist">
      <div className="hist__bar">
        <div className="segmented">
          <button
            className={`segmented__item ${mode === 'table' ? 'segmented__item--active' : ''}`}
            onClick={() => setMode('table')}
          >
            {t('history.table')}
          </button>
          <button
            className={`segmented__item ${mode === 'graph' ? 'segmented__item--active' : ''}`}
            onClick={() => setMode('graph')}
          >
            {t('history.graph')}
          </button>
        </div>
        <span className="files__spacer" />
        <span className="files__count">{commits.length} commit</span>
      </div>

      {loading ? (
        <div className="loadingrow" style={{ padding: 24 }}>
          <span className="spinner" /> {t('repo.loading')}
        </div>
      ) : commits.length === 0 ? (
        <div className="empty">
          <p className="empty__desc">{t('history.empty')}</p>
        </div>
      ) : mode === 'table' ? (
        <TableView commits={commits} fmt={dateFmt} />
      ) : (
        <GraphView commits={commits} fmt={dateFmt} t={t} tracked={tracked} />
      )}
    </div>
  )
}

function TableView({
  commits,
  fmt
}: {
  commits: Commit[]
  fmt: Intl.DateTimeFormat
}): JSX.Element {
  return (
    <div className="hist__scroll">
      <div className="hist-table">
        {commits.map((c) => (
          <div className="hist-row" key={c.hash}>
            <span className="hist-row__dot" />
            <div className="hist-row__main">
              <div className="hist-row__subject">
                {c.subject.split('\n')[0]}
                {c.tags.map((tag) => (
                  <span key={tag} className="hist-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="hist-row__meta">
                {c.author} · {fmt.format(new Date(c.date))}
                {c.files.length > 0 ? ` · ${c.files.map(baseName).join(', ')}` : ''}
              </div>
            </div>
            <span className="hist-row__hash mono">{c.short}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function GraphView({
  commits,
  fmt,
  t,
  tracked
}: {
  commits: Commit[]
  fmt: Intl.DateTimeFormat
  t: (k: string) => string
  tracked: Set<string>
}): JSX.Element {
  const { lanes, nodes, width, height } = useMemo(() => {
    const laneList: string[] = []
    const perFileCount: Record<string, number> = {}
    const ns: GraphNode[] = []
    // Eskiden yeniye: her dosyanın kendi şeridinde sıralı dizilsin.
    const ordered = [...commits].reverse()
    for (const c of ordered) {
      for (const f of c.files) {
        let lane = laneList.indexOf(f)
        if (lane === -1) {
          lane = laneList.length
          laneList.push(f)
        }
        const pos = perFileCount[f] ?? 0
        perFileCount[f] = pos + 1
        ns.push({ commit: c, lane, pos, version: pos + 1 })
      }
    }
    const maxPos = Math.max(0, ...Object.values(perFileCount))
    return {
      lanes: laneList,
      nodes: ns,
      width: laneList.length * COL_W + PAD * 2,
      height: maxPos * ROW_H + HEADER_H + PAD * 2
    }
  }, [commits])

  const [view, setView] = useState({ scale: 1, tx: PAD, ty: PAD })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const outerRef = useRef<HTMLDivElement>(null)

  const nodeX = (lane: number): number => PAD + lane * COL_W
  const nodeY = (pos: number): number => PAD + HEADER_H + pos * ROW_H

  const onWheel = (e: React.WheelEvent): void => {
    e.preventDefault()
    const rect = outerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    const ns = clamp(view.scale * factor, 0.3, 3)
    const wx = (mx - view.tx) / view.scale
    const wy = (my - view.ty) / view.scale
    setView({ scale: ns, tx: mx - wx * ns, ty: my - wy * ns })
  }

  const onMouseDown = (e: React.MouseEvent): void => {
    drag.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent): void => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }))
  }
  const endDrag = (): void => {
    drag.current = null
  }

  return (
    <div
      className="graph"
      ref={outerRef}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      style={{ backgroundPosition: `${view.tx}px ${view.ty}px` }}
    >
      <div className="graph__hint">{t('history.graphHint')}</div>
      <div
        className="graph__canvas"
        style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`, width, height }}
      >
        <svg className="graph__svg" width={width} height={height}>
          {lanes.map((file, lane) => {
            const count = nodes.filter((n) => n.lane === lane).length
            if (count < 2) return null
            return (
              <line
                key={file}
                x1={nodeX(lane) + 75}
                y1={nodeY(0) + 26}
                x2={nodeX(lane) + 75}
                y2={nodeY(count - 1) + 26}
                stroke={LANE_COLORS[lane % LANE_COLORS.length]}
                strokeWidth={2}
                strokeOpacity={0.5}
              />
            )
          })}
        </svg>

        {lanes.map((file, lane) => {
          const del = !tracked.has(file)
          return (
            <div
              key={file}
              className={`glane ${del ? 'glane--deleted' : ''}`}
              style={{ left: nodeX(lane), top: PAD, color: LANE_COLORS[lane % LANE_COLORS.length] }}
            >
              {baseName(file)}
              {del ? ` · ${t('history.deleted')}` : ''}
            </div>
          )
        })}

        {nodes.map((n) => (
          <div
            key={`${n.commit.hash}-${n.lane}`}
            className={`gnode ${!tracked.has(lanes[n.lane]) ? 'gnode--deleted' : ''}`}
            title={`${n.commit.subject.split('\n')[0]}\n${n.commit.author} · ${fmt.format(new Date(n.commit.date))}`}
            style={{
              left: nodeX(n.lane),
              top: nodeY(n.pos),
              borderColor: LANE_COLORS[n.lane % LANE_COLORS.length]
            }}
          >
            <span
              className="gnode__ver"
              style={{ color: LANE_COLORS[n.lane % LANE_COLORS.length] }}
            >
              v{n.version}
            </span>
            <span className="gnode__date">{fmt.format(new Date(n.commit.date))}</span>
            {n.commit.tags.length > 0 ? (
              <span className="gnode__tag">{n.commit.tags[0]}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
