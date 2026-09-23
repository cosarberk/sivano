import { getJiraSettings } from './connections'

export interface AnalysisEntry {
  path: string
  version: number
  status: 'modified' | 'added' | 'deleted'
  note?: string
  old: string
  new: string
  /** Repodaki (GitLab/GitHub) kalıcı bağlantısı — repo.ts doldurur. */
  url?: string
}

export interface JiraResult {
  created: number
  failed: number
}

const MAX_ROWS = 500

function baseName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

function statusTr(s: AnalysisEntry['status']): string {
  return s === 'added' ? 'yeni' : s === 'deleted' ? 'silindi' : 'değişti'
}

/** Wiki markup'ta tablo hücresini/metni bozan karakterleri kaçır. */
function esc(s: string): string {
  return s.replace(/([\\|{}[\]])/g, '\\$1').replace(/\r/g, '')
}

function red(s: string): string {
  return `{color:#c0392b}${s}{color}`
}
function green(s: string): string {
  return `{color:#1e7e34}${s}{color}`
}

/* ---- LCS (satır + kelime) ---- */
type LineOp = { t: 'eq' | 'del' | 'add'; a?: string; b?: string }

function lineDiff(a: string[], b: string[]): LineOp[] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const ops: LineOp[] = []
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

function wordDiff(oldLine: string, newLine: string): { left: string; right: string } {
  const a = tokenize(oldLine)
  const b = tokenize(newLine)
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
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
      left += red(esc(a[i]))
      i++
    } else {
      right += green(esc(b[j]))
      j++
    }
  }
  while (i < n) left += red(esc(a[i++]))
  while (j < m) right += green(esc(b[j++]))
  return { left, right }
}

function similarity(a: string, b: string): number {
  const at = tokenize(a)
  const set = new Set(at)
  let common = 0
  for (const tok of tokenize(b)) if (set.has(tok)) common++
  return common / Math.max(1, Math.max(at.length, tokenize(b).length))
}

type DiffRow = {
  type: 'eq' | 'del' | 'add' | 'chg'
  oldNo: number | null
  newNo: number | null
  left: string
  right: string
}

/** DiffView ile aynı mantık: del+add çiftlerini "değişti" satırına indirger, satır no verir. */
function buildRows(oldText: string, newText: string): { rows: DiffRow[]; adds: number; dels: number } {
  const ops = lineDiff(oldText.split('\n'), newText.split('\n'))
  const rows: DiffRow[] = []
  let oldNo = 0
  let newNo = 0
  let adds = 0
  let dels = 0
  let pd: string[] = []
  let pa: string[] = []
  const flush = (): void => {
    const k = Math.max(pd.length, pa.length)
    for (let x = 0; x < k; x++) {
      const d = pd[x]
      const a = pa[x]
      if (d !== undefined && a !== undefined) {
        oldNo++
        newNo++
        dels++
        adds++
        if (similarity(d, a) > 0.3) {
          const w = wordDiff(d, a)
          rows.push({ type: 'chg', oldNo, newNo, left: w.left, right: w.right })
        } else {
          rows.push({ type: 'chg', oldNo, newNo, left: red(esc(d)), right: green(esc(a)) })
        }
      } else if (d !== undefined) {
        oldNo++
        dels++
        rows.push({ type: 'del', oldNo, newNo: null, left: red(esc(d)), right: '' })
      } else if (a !== undefined) {
        newNo++
        adds++
        rows.push({ type: 'add', oldNo: null, newNo, left: '', right: green(esc(a)) })
      }
    }
    pd = []
    pa = []
  }
  for (const op of ops) {
    if (op.t === 'eq') {
      flush()
      oldNo++
      newNo++
      rows.push({ type: 'eq', oldNo, newNo, left: esc(op.a ?? ''), right: esc(op.b ?? '') })
    } else if (op.t === 'del') {
      pd.push(op.a ?? '')
    } else {
      pa.push(op.b ?? '')
    }
  }
  flush()
  return { rows, adds, dels }
}

const CONTEXT = 3 // değişen satır etrafında gösterilecek bağlam satırı sayısı

/**
 * 4 kolonlu (# | Eski | # | Yeni) kelime bazlı diff — SADECE değişen bölümler
 * (+ birkaç satır bağlam). Değişmeyen uzun bloklar "N satır atlandı" ile geçilir.
 */
function wikiDiff(oldText: string, newText: string): string {
  if (!oldText && !newText) return '_(içerik yok)_'
  const { rows, adds, dels } = buildRows(oldText, newText)

  // Hangi satırlar gösterilecek: her değişikliğin CONTEXT komşuları.
  const keep = new Array(rows.length).fill(false)
  rows.forEach((r, i) => {
    if (r.type !== 'eq') {
      for (let j = Math.max(0, i - CONTEXT); j <= Math.min(rows.length - 1, i + CONTEXT); j++) {
        keep[j] = true
      }
    }
  })

  const cell = (s: string): string => (s.trim() === '' ? ' ' : s)
  const out: string[] = [
    `{color:#1e7e34}+${adds} eklendi{color}   {color:#c0392b}-${dels} çıkarıldı{color}`,
    '',
    '||#||Eski||#||Yeni||'
  ]
  let count = 0
  let prevKept = false
  let skipped = 0
  for (let i = 0; i < rows.length; i++) {
    if (!keep[i]) {
      skipped++
      prevKept = false
      continue
    }
    if (!prevKept && skipped > 0) {
      out.push(`| |{{⋯ ${skipped} satır atlandı ⋯}}| | |`)
      skipped = 0
    }
    if (count >= MAX_ROWS) {
      out.push('| |...| |...|')
      break
    }
    const r = rows[i]
    const lnL =
      r.oldNo !== null ? (r.type === 'del' || r.type === 'chg' ? `${r.oldNo} -` : `${r.oldNo}`) : ' '
    const lnR =
      r.newNo !== null ? (r.type === 'add' || r.type === 'chg' ? `${r.newNo} +` : `${r.newNo}`) : ' '
    out.push(`|${lnL}|${cell(r.left)}|${lnR}|${cell(r.right)}|`)
    count++
    prevKept = true
  }
  return out.join('\n')
}

function buildDescription(e: AnalysisEntry): string {
  const lines = [
    `h3. ${baseName(e.path)}`,
    `*Dosya:* {{${e.path}}}`,
    `*Sürüm:* v${e.version}`,
    `*Tür:* ${statusTr(e.status)}`
  ]
  if (e.url) lines.push(`*Konum:* [Repoda aç|${e.url}]`)
  if (e.note?.trim()) lines.push(`*Not:* ${esc(e.note.trim())}`)
  lines.push('', wikiDiff(e.old, e.new))
  return lines.join('\n')
}

async function assignSelf(baseUrl: string, token: string, key: string, user: string): Promise<void> {
  if (!user) return
  try {
    await fetch(`${baseUrl}/rest/api/2/issue/${key}/assignee`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user })
    })
  } catch {
    /* atama başarısızsa issue yine de kalır */
  }
}

/** Proje anahtarından aktif sprint'i bulur (Scrum board). Yoksa null. */
async function resolveActiveSprint(
  baseUrl: string,
  token: string,
  projectKey: string
): Promise<number | null> {
  try {
    const h = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    const boardsRes = await fetch(
      `${baseUrl}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}`,
      { headers: h }
    )
    if (!boardsRes.ok) return null
    const boards = (await boardsRes.json()) as { values: { id: number; type: string }[] }
    const board = boards.values.find((b) => b.type === 'scrum') ?? boards.values[0]
    if (!board) return null
    const sprintRes = await fetch(
      `${baseUrl}/rest/agile/1.0/board/${board.id}/sprint?state=active`,
      { headers: h }
    )
    if (!sprintRes.ok) return null
    const sprints = (await sprintRes.json()) as { values: { id: number }[] }
    return sprints.values[0]?.id ?? null
  } catch {
    return null
  }
}

async function addToSprint(
  baseUrl: string,
  token: string,
  sprintId: number,
  key: string
): Promise<void> {
  try {
    await fetch(`${baseUrl}/rest/agile/1.0/sprint/${sprintId}/issue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues: [key] })
    })
  } catch {
    /* sprint'e eklenemezse backlog'da kalır */
  }
}

async function transitionToDone(
  baseUrl: string,
  token: string,
  key: string,
  doneName: string
): Promise<void> {
  try {
    const res = await fetch(`${baseUrl}/rest/api/2/issue/${key}/transitions`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    })
    if (!res.ok) return
    const data = (await res.json()) as {
      transitions: { id: string; name: string; to?: { name?: string } }[]
    }
    const want = doneName.toLowerCase()
    const target =
      data.transitions.find((t) => t.name.toLowerCase() === want) ??
      data.transitions.find((t) => t.to?.name?.toLowerCase() === want)
    if (!target) return
    await fetch(`${baseUrl}/rest/api/2/issue/${key}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: { id: target.id } })
    })
  } catch {
    /* transition başarısızsa issue "Done" olmadan kalır */
  }
}

/** Her analiz için Jira'da 'Analiz' issue'su açar, kendine atar, Done'a çeker. */
export async function sendAnalyses(entries: AnalysisEntry[]): Promise<JiraResult> {
  const cfg = await getJiraSettings()
  // Jira bağlı/yapılandırılmış değilse sessizce atla.
  if (!cfg || !cfg.baseUrl || !cfg.projectKey) return { created: 0, failed: 0 }

  // Aktif sprint'i bir kez çöz (best-effort).
  const sprintId = await resolveActiveSprint(cfg.baseUrl, cfg.token, cfg.projectKey)

  let created = 0
  let failed = 0
  for (const e of entries) {
    try {
      const summary = `${baseName(e.path)} — ${statusTr(e.status)} (v${e.version})`
      const body = {
        fields: {
          project: { key: cfg.projectKey },
          issuetype: { name: cfg.issueType },
          summary,
          description: buildDescription(e)
        }
      }
      const res = await fetch(`${cfg.baseUrl}/rest/api/2/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        failed++
        continue
      }
      const issue = (await res.json()) as { key: string }
      await assignSelf(cfg.baseUrl, cfg.token, issue.key, cfg.account)
      if (sprintId) await addToSprint(cfg.baseUrl, cfg.token, sprintId, issue.key)
      await transitionToDone(cfg.baseUrl, cfg.token, issue.key, cfg.doneTransition)
      created++
    } catch {
      failed++
    }
  }
  return { created, failed }
}
