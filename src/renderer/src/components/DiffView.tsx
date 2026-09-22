import { useMemo } from 'react'

interface DiffViewProps {
  oldText: string
  newText: string
}

type RowType = 'eq' | 'del' | 'add' | 'chg'

interface Row {
  type: RowType
  oldNo: number | null
  newNo: number | null
  left: string
  right: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Satır bazlı LCS. */
function lineDiff(a: string[], b: string[]): { t: 'eq' | 'del' | 'add'; a?: string; b?: string }[] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ops: { t: 'eq' | 'del' | 'add'; a?: string; b?: string }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: 'eq', a: a[i], b: b[j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: 'del', a: a[i] })
      i++
    } else {
      ops.push({ t: 'add', b: b[j] })
      j++
    }
  }
  while (i < n) ops.push({ t: 'del', a: a[i++] })
  while (j < m) ops.push({ t: 'add', b: b[j++] })
  return ops
}

function tokenize(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? []
}

/** Değişen satır çiftinde kelime bazlı vurgulu HTML üretir. */
function wordDiff(oldLine: string, newLine: string): { left: string; right: string } {
  const a = tokenize(oldLine)
  const b = tokenize(newLine)
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  let i = 0
  let j = 0
  let left = ''
  let right = ''
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      left += esc(a[i])
      right += esc(b[j])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left += `<span class="wd-del">${esc(a[i])}</span>`
      i++
    } else {
      right += `<span class="wd-add">${esc(b[j])}</span>`
      j++
    }
  }
  while (i < n) left += `<span class="wd-del">${esc(a[i++])}</span>`
  while (j < m) right += `<span class="wd-add">${esc(b[j++])}</span>`
  return { left, right }
}

function similarity(a: string, b: string): number {
  const at = tokenize(a)
  const bt = tokenize(b)
  const set = new Set(at)
  let common = 0
  for (const tok of bt) if (set.has(tok)) common++
  return common / Math.max(1, Math.max(at.length, bt.length))
}

function buildRows(oldText: string, newText: string): { rows: Row[]; adds: number; dels: number } {
  const ops = lineDiff(oldText.split('\n'), newText.split('\n'))
  const rows: Row[] = []
  let oldNo = 0
  let newNo = 0
  let adds = 0
  let dels = 0
  let pendingDel: string[] = []
  let pendingAdd: string[] = []

  const flush = (): void => {
    const k = Math.max(pendingDel.length, pendingAdd.length)
    for (let x = 0; x < k; x++) {
      const d = pendingDel[x]
      const a = pendingAdd[x]
      if (d !== undefined && a !== undefined) {
        oldNo++
        newNo++
        dels++
        adds++
        if (similarity(d, a) > 0.3) {
          const w = wordDiff(d, a)
          rows.push({ type: 'chg', oldNo, newNo, left: w.left, right: w.right })
        } else {
          rows.push({ type: 'chg', oldNo, newNo, left: esc(d), right: esc(a) })
        }
      } else if (d !== undefined) {
        oldNo++
        dels++
        rows.push({ type: 'del', oldNo, newNo: null, left: esc(d), right: '' })
      } else if (a !== undefined) {
        newNo++
        adds++
        rows.push({ type: 'add', oldNo: null, newNo, left: '', right: esc(a) })
      }
    }
    pendingDel = []
    pendingAdd = []
  }

  for (const op of ops) {
    if (op.t === 'eq') {
      flush()
      oldNo++
      newNo++
      rows.push({ type: 'eq', oldNo, newNo, left: esc(op.a ?? ''), right: esc(op.b ?? '') })
    } else if (op.t === 'del') {
      pendingDel.push(op.a ?? '')
    } else {
      pendingAdd.push(op.b ?? '')
    }
  }
  flush()
  return { rows, adds, dels }
}

export function DiffView({ oldText, newText }: DiffViewProps): JSX.Element {
  const { rows, adds, dels } = useMemo(() => buildRows(oldText, newText), [oldText, newText])

  return (
    <div className="diffview">
      <div className="diffview__stats">
        <span className="diffview__add">+{adds}</span>
        <span className="diffview__del">−{dels}</span>
      </div>
      <table className="diff">
        <colgroup>
          <col className="diff__gutter" />
          <col />
          <col className="diff__gutter" />
          <col />
        </colgroup>
        <tbody>
          {rows.map((r, idx) => {
            const leftEmpty = r.type === 'add'
            const rightEmpty = r.type === 'del'
            const sign = (t: RowType, side: 'l' | 'r'): string => {
              if (t === 'eq') return ' '
              if (side === 'l') return t === 'del' || t === 'chg' ? '−' : ''
              return t === 'add' || t === 'chg' ? '+' : ''
            }
            return (
              <tr key={idx} className={`diff-${r.type}`}>
                <td className={`diff-num ${leftEmpty ? 'diff-empty' : ''}`}>{r.oldNo ?? ''}</td>
                <td className={`diff-code ${leftEmpty ? 'diff-empty' : ''}`}>
                  {!leftEmpty && (
                    <>
                      <span className="diff-sign">{sign(r.type, 'l')}</span>
                      <span dangerouslySetInnerHTML={{ __html: r.left }} />
                    </>
                  )}
                </td>
                <td className={`diff-num ${rightEmpty ? 'diff-empty' : ''}`}>{r.newNo ?? ''}</td>
                <td className={`diff-code ${rightEmpty ? 'diff-empty' : ''}`}>
                  {!rightEmpty && (
                    <>
                      <span className="diff-sign">{sign(r.type, 'r')}</span>
                      <span dangerouslySetInnerHTML={{ __html: r.right }} />
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
