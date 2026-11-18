// Genera docs/seguimiento.html: el tablero de avance del proyecto.
//
// Lee el estado de los documentos que ya lo registran (fase-0.md, modulos-y-orden.md, PREGUNTAS.md, los
// open-questions.md de cada módulo, CHANGELOG.md, git) y lo que no está en otro lado de docs/seguimiento.md.
// No hay que mantener el HTML a mano: se edita el documento y se vuelve a correr.
//
// Uso: pnpm tracker   (o: pnpm --filter @accounting/api exec tsx ../../scripts/tracker/build.mts)
// Solo usa módulos de Node; no agrega dependencias.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '../..')
const OUT = 'docs/seguimiento.html'
const TEMPLATE = join(here, 'template.html')

// ---------- tipos ----------

type QStatus = 'abierta' | 'parcial' | 'respondida'
type WStatus = 'pendiente' | 'en curso' | 'hecho' | 'bloqueado' | 'retirado'
type GStatus = 'por conseguir' | 'pedido' | 'conseguido'

interface Question {
  id: string // "P3", "M1", "INV 44"
  group: string // "P", "M" o el prefijo del módulo legado ("INV")
  num: string
  title: string // HTML
  text: string // HTML
  proposal: string // HTML
  who: string
  section: string
  status: QStatus
  statusNote: string // HTML
  date: string
  doc: string // ruta del documento
  refs: string[] // preguntas que cita
  usedBy: string[] // preguntas o fases que la citan
}

interface Card {
  kind: 'paso' | 'modulo' | 'tarea'
  id: string
  title: string
  detail: string // HTML
  status: WStatus
  phase: string
  module: string
  doc: string
  needs: string[] // preguntas de las que depende
}

// ---------- utilidades ----------

const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')
const lines = (p: string) => read(p).split('\n')
const toPosix = (p: string) => p.split('\\').join('/')

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return ''
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const gh = (() => {
  const url = git(['remote', 'get-url', 'origin']).trim()
  const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/)
  if (!m) return null
  const branch =
    git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).trim().replace(/^origin\//, '') ||
    git(['rev-parse', '--abbrev-ref', 'HEAD']).trim() ||
    'master'
  return { base: `https://github.com/${m[1]}`, branch }
})()

/** Enlace a un archivo del repositorio: GitHub si hay remoto (renderiza el markdown), si no relativo al HTML. */
function fileHref(repoPath: string, anchor = ''): string {
  const a = anchor ? `#${anchor}` : ''
  if (gh) return `${gh.base}/blob/${gh.branch}/${repoPath}${a}`
  return posix.relative(posix.dirname(OUT), repoPath) + a
}

/** Markdown en línea (negrita, cursiva, código, enlaces) a HTML seguro. Los enlaces se resuelven desde `docPath`. */
function md(text: string, docPath: string): string {
  const codes: string[] = []
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${esc(c)}</code>`)
    return `\u0000${codes.length - 1}\u0000`
  })
  const links: string[] = []
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, target: string) => {
    let href = target
    if (!/^[a-z]+:/i.test(target)) {
      const [p, anchor = ''] = target.split('#')
      const repoPath = p ? posix.normalize(posix.join(posix.dirname(docPath), p)) : docPath
      href = fileHref(repoPath, anchor)
    }
    links.push(`<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`)
    return `\u0001${links.length - 1}\u0001`
  })
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
  return s
    .replace(/\u0001(\d+)\u0001/g, (_, i) => links[+i])
    .replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i])
}

const stripMd = (s: string) =>
  s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim()

function tableRows(block: string[]): string[][] {
  return block
    .filter((l) => l.trim().startsWith('|') && !/^\|\s*-{2,}/.test(l.trim()))
    .map((l) =>
      l
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim()),
    )
}

/** Líneas de una sección: desde el encabezado que cumple `match` hasta el siguiente de nivel igual o mayor. */
function section(all: string[], match: RegExp): string[] {
  const start = all.findIndex((l) => /^#+\s/.test(l) && match.test(l))
  if (start < 0) return []
  const level = all[start].match(/^#+/)![0].length
  const out: string[] = []
  for (let i = start + 1; i < all.length; i++) {
    const h = all[i].match(/^(#+)\s/)
    if (h && h[1].length <= level) break
    out.push(all[i])
  }
  return out
}

function cmpNum(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

// ---------- módulos legados ----------

const LEGACY: { prefix: string; dir: string; name: string }[] = [
  { prefix: 'CONTAC', dir: 'contac', name: 'Contabilidad' },
  { prefix: 'BANCOC', dir: 'bancoc', name: 'Bancos y CxP' },
  { prefix: 'IVA', dir: 'iva64', name: 'IVA' },
  { prefix: 'CXC', dir: 'cxc64', name: 'Cuentas por cobrar' },
  { prefix: 'INV', dir: 'inv64', name: 'Inventario y facturación' },
  { prefix: 'LOTE', dir: 'lote64', name: 'Producción (lotes)' },
  { prefix: 'AFIJO', dir: 'afijo64', name: 'Activo fijo' },
  { prefix: 'PLAN', dir: 'plan64', name: 'Planilla' },
  { prefix: 'DTE', dir: 'dte', name: 'Factura electrónica' },
]
const PREFIXES = LEGACY.map((l) => l.prefix).join('|')

const questions = new Map<string, Question>()
const warnings: string[] = []

function addQuestion(q: Omit<Question, 'usedBy' | 'statusNote' | 'date'> & Partial<Question>) {
  if (questions.has(q.id)) {
    warnings.push(`Pregunta repetida: ${q.id} (${q.doc})`)
    return
  }
  questions.set(q.id, { statusNote: '', date: '', usedBy: [], ...q })
}

/** Ids de preguntas citadas en un texto: P4, P16–P20, M1, INV 3–6, 24, PLAN 1.1–1.4. */
function parseRefs(text: string): string[] {
  const out = new Set<string>()
  const plain = stripMd(text)
  for (const m of plain.matchAll(/\bP(\d+)(?:\s*[–-]\s*P?(\d+))?\b/g)) {
    const a = +m[1]
    const b = m[2] ? +m[2] : a
    for (let i = a; i <= b; i++) out.add(`P${i}`)
  }
  for (const m of plain.matchAll(/\bM(\d+)\b/g)) out.add(`M${m[1]}`)
  for (const m of plain.matchAll(new RegExp(`\\b(${PREFIXES})\\s+((?:\\d+(?:\\.\\d+)?(?:\\s*[–-]\\s*\\d+(?:\\.\\d+)?)?(?:\\s*,\\s*)?)+)`, 'g'))) {
    const prefix = m[1]
    for (const part of m[2].split(',').map((p) => p.trim()).filter(Boolean)) {
      const [a, b] = part.split(/\s*[–-]\s*/)
      if (!b) {
        out.add(`${prefix} ${a}`)
        continue
      }
      for (const q of questions.values())
        if (q.group === prefix && cmpNum(q.num, a) >= 0 && cmpNum(q.num, b) <= 0) out.add(q.id)
    }
  }
  return [...out]
}

const RESOLVED = /✅|—\s*decidid[oa]|\*\*\s*(?:resuelt[oa]|respondid[oa]|decidid[oa])/i

function parseOpenQuestions(l: (typeof LEGACY)[number]) {
  const doc = `docs/legacy/${l.dir}/open-questions.md`
  if (!existsSync(join(ROOT, doc))) return
  const all = lines(doc)
  let sectionName = ''
  let cur: { num: string; first: string; body: string[]; section: string } | null = null
  const flush = () => {
    if (!cur) return
    const first = cur.first.replace(/^✅\s*/, '')
    const bold = first.match(/^\*\*(.+?)\*\*/)
    const title = bold
      ? bold[1].replace(/[.:]\s*$/, '')
      : (first.match(/^.*?\?/)?.[0] ?? first.slice(0, 140))
    const full = [first, ...cur.body].join(' ').replace(/\s+/g, ' ').trim()
    const prop = full.match(/\*Propuesta:?\*:?\s*(.*)$/)
    const resolved = RESOLVED.test(cur.first) || cur.body.some((b) => RESOLVED.test(b))
    addQuestion({
      id: `${l.prefix} ${cur.num}`,
      group: l.prefix,
      num: cur.num,
      title: md(title, doc),
      text: md(full, doc),
      proposal: prop ? md(prop[1], doc) : '',
      who: '',
      section: cur.section,
      status: resolved ? 'respondida' : 'abierta',
      statusNote: resolved ? 'Marcada como decidida en el documento.' : '',
      doc,
      refs: [],
    })
    cur = null
  }
  for (const line of all) {
    const h = line.match(/^#{2,}\s+(.*)/)
    if (h) {
      flush()
      sectionName = stripMd(h[1])
      continue
    }
    const item = line.match(/^(\d+(?:\.\d+)?)\.?\s+(\S.*)$/)
    if (item && !/^\d{4}/.test(item[1])) {
      flush()
      cur = { num: item[1], first: item[2], body: [], section: sectionName }
      continue
    }
    if (cur && line.trim() && !line.trim().startsWith('|')) cur.body.push(line.trim())
  }
  flush()
}

// ---------- PREGUNTAS.md ----------

const PREG = 'docs/legacy/PREGUNTAS.md'
const pregLines = lines(PREG)

function parseTopQuestions() {
  for (const r of tableRows(section(pregLines, /Las 30 preguntas/))) {
    const [id, q, prop, changes, who, src] = r
    if (!/^P\d+$/.test(id)) continue
    addQuestion({
      id,
      group: 'P',
      num: id.slice(1),
      title: md(q, PREG),
      text: md(`${q} **Qué cambia:** ${changes}`, PREG),
      proposal: md(prop, PREG),
      who,
      section: 'Las 30 que más importan',
      status: 'abierta',
      doc: PREG,
      refs: [],
      _src: src,
    } as Question & { _src: string })
  }
}

const MOD_DOC = 'docs/sistema/modulos-y-orden.md'
const modLines = lines(MOD_DOC)

function parseMQuestions() {
  for (const line of section(modLines, /Riesgos y decisiones abiertas/)) {
    const m = line.match(/^\d+\.\s+\*\*(M\d+)\*\*\s*[—-]\s*(.*)$/)
    if (!m) continue
    const [q, prop = ''] = m[2].split(/\s*Propuesta:\s*/)
    addQuestion({
      id: m[1],
      group: 'M',
      num: m[1].slice(1),
      title: md(q, MOD_DOC),
      text: md(m[2], MOD_DOC),
      proposal: md(prop, MOD_DOC),
      who: 'negocio',
      section: 'Riesgos y decisiones abiertas',
      status: 'abierta',
      doc: MOD_DOC,
      refs: [],
    })
  }
}

/** Respuestas que da la lectura de la solución DTE a preguntas de INV64. */
function applyDteResolutions() {
  const doc = 'docs/legacy/dte/open-questions.md'
  if (!existsSync(join(ROOT, doc))) return
  for (const r of tableRows(section(lines(doc), /Resueltas/))) {
    const m = r[0]?.match(/^(\d+)(?:\s*[–-]\s*(\d+))?\s/)
    if (!m) continue
    const partial = /sigue sin|sigue pendiente|pendiente/i.test(r[1] ?? '')
    for (let i = +m[1]; i <= +(m[2] ?? m[1]); i++) {
      const q = questions.get(`INV ${i}`)
      if (!q || q.status === 'respondida') continue
      q.status = partial ? 'parcial' : 'respondida'
      q.statusNote = md(`Respondida en [dte/open-questions.md](dte/open-questions.md): ${r[1]}`, 'docs/legacy/x.md')
    }
  }
}

interface Gather {
  id: string
  title: string
  text: string
  status: GStatus
  note: string
  date: string
  plain: string
}

function parseToGather(): Gather[] {
  const out: Gather[] = []
  for (const line of section(pregLines, /Lo que necesitamos conseguir/)) {
    const m = line.match(/^-\s+\*\*(.+?)\*\*\s*(.*)$/)
    if (!m) continue
    out.push({
      id: `C${out.length + 1}`,
      title: md(m[1].replace(/[.:]\s*$/, ''), PREG),
      text: md(m[2], PREG),
      status: 'por conseguir',
      note: '',
      date: '',
      plain: stripMd(line).toLowerCase(),
    })
  }
  return out
}

// ---------- seguimiento.md (estado que no vive en otro lado) ----------

const SEG = 'docs/seguimiento.md'
const segLines = existsSync(join(ROOT, SEG)) ? lines(SEG) : []
const segTable = (name: RegExp) => tableRows(section(segLines, name)).slice(1)

const Q_STATES: QStatus[] = ['abierta', 'parcial', 'respondida']
const W_STATES: WStatus[] = ['pendiente', 'en curso', 'hecho', 'bloqueado', 'retirado']
const G_STATES: GStatus[] = ['por conseguir', 'pedido', 'conseguido']

function check<T extends string>(value: string, valid: T[], where: string): T | null {
  const v = value.toLowerCase().trim() as T
  if (valid.includes(v)) return v
  warnings.push(`${SEG}: estado "${value}" no válido en ${where} (válidos: ${valid.join(', ')})`)
  return null
}

function applyAnswers() {
  for (const [id, st, date, note] of segTable(/^##\s+Respuestas/)) {
    const key = id.replace(/\s+/g, ' ').toUpperCase().replace(/^P(\d)/, 'P$1')
    const q = questions.get(key)
    if (!q) {
      warnings.push(`${SEG}: la pregunta "${id}" no existe en los documentos`)
      continue
    }
    const s = check(st, Q_STATES, id)
    if (!s) continue
    q.status = s
    q.date = date ?? ''
    q.statusNote = md(note ?? '', SEG)
  }
}

// ---------- fase 0, fases y módulos ----------

const F0 = 'docs/sistema/fase-0.md'
const f0Lines = lines(F0)

function stepStatus(text: string): WStatus {
  const t = stripMd(text).toLowerCase()
  if (/^hecho/.test(t)) return 'hecho'
  if (/^(casi|parcial|en curso)/.test(t)) return 'en curso'
  if (/^bloq/.test(t)) return 'bloqueado'
  return 'pendiente'
}

const cards: Card[] = []
const derivedTasks: Card[] = []

function parseFase0() {
  const heading = f0Lines.find((l) => /^##\s+Estado de la construcci/.test(l)) ?? ''
  const date = heading.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] ?? ''
  const body = section(f0Lines, /Estado de la construcci/)
  const tests = body.join(' ').match(/(\d[\d,.]*)\s+pruebas pasan/)?.[1] ?? ''
  for (const r of tableRows(body)) {
    const [step, state] = r
    const m = step?.match(/^(\d+)\.\s*(.*)$/)
    if (!m) continue
    const status = stepStatus(state)
    cards.push({
      kind: 'paso',
      id: `F0.${m[1]}`,
      title: md(`Paso ${m[1]}. ${m[2]}`, F0),
      detail: md(state, F0),
      status,
      phase: '0',
      module: '',
      doc: F0,
      needs: [],
    })
    const falta = state.match(/\*?\*?Falta:?\*?\*?:?\s*(.+)$/)
    if (falta)
      derivedTasks.push({
        kind: 'tarea',
        id: `F0.${m[1]}-falta`,
        title: md(`Paso ${m[1]}: ${falta[1].split(/[.;]\s/)[0]}`, F0),
        detail: md(`Falta: ${falta[1]}`, F0),
        status: 'pendiente',
        phase: '0',
        module: '',
        doc: F0,
        needs: [],
      })
  }
  return { date, tests }
}

interface Phase {
  num: string
  name: string
  what: string
  why: string
  needs: string[]
  needsText: string
  parity: string
  modules: string[]
  status: WStatus
}

interface Module {
  id: string
  prefix: string
  purpose: string
  absorbs: string
  depends: string
  status: WStatus
  note: string
  phase: string
  skeleton: boolean
}

function parsePhasesAndModules() {
  const modules: Module[] = []
  for (const r of tableRows(section(modLines, /^###\s+1\.2 Módulos/))) {
    const idCell = r[0] ?? ''
    const id = idCell.match(/`([^`]+)`/)?.[1]
    if (!id) continue
    modules.push({
      id,
      prefix: stripMd(r[1] ?? ''),
      purpose: md(r[2] ?? '', MOD_DOC),
      absorbs: md(r[3] ?? '', MOD_DOC),
      depends: md(r[5] ?? '', MOD_DOC),
      status: /\(hecho\)/i.test(idCell) ? 'hecho' : 'pendiente',
      note: /\(nuevo\)/i.test(idCell) ? 'Nuevo: no existe en el sistema anterior.' : '',
      phase: '',
      skeleton: existsSync(join(ROOT, 'modules', id)),
    })
  }
  if (!modules.some((m) => m.id === 'reports') && existsSync(join(ROOT, 'modules/reports')))
    modules.push({
      id: 'reports',
      prefix: '',
      purpose: md('Esqueleto: se retira cuando exista el servicio de impresión (§1.4).', MOD_DOC),
      absorbs: '',
      depends: '',
      status: 'pendiente',
      note: '',
      phase: '',
      skeleton: true,
    })

  const phases: Phase[] = []
  for (const r of tableRows(section(modLines, /^###\s+3\.1 Fases/))) {
    const m = stripMd(r[0] ?? '').match(/^(\d+)\.\s*(.*)$/)
    if (!m) continue
    const mods = [...new Set([...(r[1] ?? '').matchAll(/`([^`]+)`/g)].map((x) => x[1]))].filter((id) =>
      modules.some((mm) => mm.id === id),
    )
    for (const id of mods) {
      const mod = modules.find((mm) => mm.id === id)!
      if (!mod.phase) mod.phase = m[1]
    }
    phases.push({
      num: m[1],
      name: m[2],
      what: md(r[1] ?? '', MOD_DOC),
      why: md(r[2] ?? '', MOD_DOC),
      needs: [],
      needsText: r[3] ?? '',
      parity: md(r[5] ?? '', MOD_DOC),
      modules: mods,
      status: 'pendiente',
    })
  }

  for (const [id, st, note] of segTable(/^##\s+Módulos/)) {
    const mod = modules.find((m) => m.id === id.replace(/`/g, '').trim())
    if (!mod) {
      warnings.push(`${SEG}: el módulo "${id}" no está en ${MOD_DOC} §1.2`)
      continue
    }
    const s = check(st, W_STATES, id)
    if (s) mod.status = s
    if (note) mod.note = md(note, SEG)
  }
  return { modules, phases }
}

// ---------- documentos, versiones, commits ----------

interface Doc {
  path: string
  title: string
  area: string
  kind: 'md' | 'tldraw'
  state: string
  stateText: string
  date: string
  dirty: boolean
  href: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir))) {
    const p = posix.join(dir, e)
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out)
    else if (/\.(md|tldr)$/i.test(e)) out.push(p)
  }
  return out
}

function collectDocs(): Doc[] {
  const files = [
    ...readdirSync(ROOT).filter((f) => /\.(md|tldr)$/i.test(f)),
    ...walk('docs'),
  ]
  const dates = new Map<string, string>()
  let current = ''
  for (const l of git(['log', '--format=%x01%cs', '--name-only', '--', 'docs', '*.md', '*.tldr']).split('\n')) {
    if (l.startsWith('\u0001')) current = l.slice(1)
    else if (l.trim() && !dates.has(l.trim())) dates.set(l.trim(), current)
  }
  const dirty = new Set(
    git(['status', '--porcelain', '--untracked-files=all'])
      .split('\n')
      .filter(Boolean)
      .map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop()!),
  )
  return files.map((path) => {
    const isTl = /\.tldr$/i.test(path)
    const head = isTl ? [] : lines(path).slice(0, 40)
    const title = isTl
      ? path.split('/').pop()!.replace(/\.tldr$/i, '')
      : stripMd(head.find((l) => /^#\s/.test(l))?.replace(/^#\s+/, '') ?? path)
    const blob = head.join('\n')
    const estado = blob.match(/\*\*Estado(?: del documento)?:\*\*\s*([^\n]+)/)?.[1] ?? ''
    let state = ''
    if (/PROPUESTA/.test(blob)) state = 'propuesta'
    else if (/sin revisar|no se han verificado|sin verificar|análisis automatizado/i.test(blob)) state = 'sin verificar'
    else if (/verificad[oa]/i.test(estado)) state = 'verificado'
    const parts = path.split('/')
    const area = parts.length === 1 ? 'raíz' : parts.slice(1, -1).join('/') || 'docs'
    return {
      path,
      title,
      area,
      kind: isTl ? 'tldraw' : 'md',
      state,
      stateText: estado ? md(estado.slice(0, 260), path) : '',
      date: dates.get(path) ?? '',
      dirty: dirty.has(path),
      href: fileHref(path),
    }
  })
}

function parseChangelog() {
  if (!existsSync(join(ROOT, 'CHANGELOG.md'))) return []
  const out: { version: string; date: string; items: string[] }[] = []
  for (const l of lines('CHANGELOG.md')) {
    const h = l.match(/^##\s+(\S+)\s*-\s*(\S+)/)
    if (h) out.push({ version: h[1], date: h[2], items: [] })
    else if (out.length && /^-\s/.test(l)) out[out.length - 1].items.push(md(l.slice(2), 'CHANGELOG.md'))
    else if (out.length && /^\s+\S/.test(l) && out[out.length - 1].items.length) {
      const items = out[out.length - 1].items
      items[items.length - 1] += ' ' + md(l.trim(), 'CHANGELOG.md')
    }
  }
  return out
}

function commits() {
  return git(['log', '-40', '--format=%h%x09%cs%x09%s'])
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [hash, date, ...s] = l.split('\t')
      return { hash, date, subject: s.join('\t'), href: gh ? `${gh.base}/commit/${hash}` : '' }
    })
}

// ---------- armar ----------

parseTopQuestions()
parseMQuestions()
for (const l of LEGACY) parseOpenQuestions(l)
applyDteResolutions()

// Referencias: P → preguntas de módulo (columna Fuente)
for (const q of questions.values()) {
  const src = (q as Question & { _src?: string })._src
  if (src) {
    q.refs = parseRefs(src).filter((id) => questions.has(id))
    delete (q as Question & { _src?: string })._src
  }
}
for (const q of questions.values()) for (const r of q.refs) questions.get(r)!.usedBy.push(q.id)

applyAnswers()

const gather = parseToGather()
for (const [item, st, date, note] of segTable(/^##\s+Por conseguir/)) {
  const g = gather.find((x) => x.plain.includes(item.toLowerCase().trim()))
  if (!g) {
    warnings.push(`${SEG}: "${item}" no aparece en ${PREG} §2`)
    continue
  }
  const s = check(st, G_STATES, item)
  if (s) g.status = s
  g.date = date ?? ''
  g.note = md(note ?? '', SEG)
}

const f0 = parseFase0()
const { modules, phases } = parsePhasesAndModules()

for (const p of phases) {
  p.needs = parseRefs(p.needsText).filter((id) => questions.has(id))
  for (const id of p.needs) questions.get(id)!.usedBy.push(`Fase ${p.num}`)
  const mods = modules.filter((m) => m.phase === p.num && m.status !== 'retirado')
  const steps = p.num === '0' ? cards.filter((c) => c.kind === 'paso') : []
  const items: WStatus[] = [...mods.map((m) => m.status), ...steps.map((s) => s.status)]
  if (items.length && items.every((s) => s === 'hecho')) p.status = 'hecho'
  else if (items.some((s) => s === 'hecho' || s === 'en curso')) p.status = 'en curso'
}

for (const m of modules)
  cards.push({
    kind: 'modulo',
    id: m.id,
    title: md(`\`${m.id}\``, MOD_DOC),
    detail: m.purpose + (m.note ? `<br><span class="muted">${m.note}</span>` : ''),
    status: m.status,
    phase: m.phase,
    module: m.id,
    doc: MOD_DOC,
    needs: phases.find((p) => p.num === m.phase)?.needs ?? [],
  })

for (const [task, st, mod, note] of segTable(/^##\s+Tareas/)) {
  if (!task) continue
  const s = check(st, W_STATES, task) ?? 'pendiente'
  cards.push({
    kind: 'tarea',
    id: `T-${task}`,
    title: md(task, SEG),
    detail: md(note ?? '', SEG),
    status: s,
    phase: modules.find((m) => m.id === mod?.trim())?.phase ?? '',
    module: mod?.trim() ?? '',
    doc: SEG,
    needs: parseRefs(`${task} ${note ?? ''}`).filter((id) => questions.has(id)),
  })
}
cards.push(...derivedTasks)

const version = (() => {
  try {
    return JSON.parse(read('apps/tray/package.json')).version as string
  } catch {
    return ''
  }
})()

const data = {
  generated: new Date().toISOString(),
  head: git(['rev-parse', '--short', 'HEAD']).trim(),
  branch: git(['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
  version,
  fase0: { ...f0, href: fileHref(F0, 'estado-de-la-construcción-' + f0.date) },
  repo: gh?.base ?? '',
  legacy: LEGACY.map((l) => ({ ...l, href: fileHref(`docs/legacy/${l.dir}/open-questions.md`) })),
  phases,
  modules,
  cards: cards.map((c) => ({ ...c, href: fileHref(c.doc) })),
  questions: [...questions.values()].map((q) => ({ ...q, href: fileHref(q.doc) })),
  gather,
  docs: collectDocs(),
  changelog: parseChangelog(),
  commits: commits(),
  sources: { seguimiento: fileHref(SEG), preguntas: fileHref(PREG), modulos: fileHref(MOD_DOC) },
  warnings,
}

const json = JSON.stringify(data).replace(/</g, '\\u003c')
const html = readFileSync(TEMPLATE, 'utf8').replace('/*__DATA__*/null', () => json)
writeFileSync(join(ROOT, OUT), html)

const count = (s: QStatus) => data.questions.filter((q) => q.status === s).length
console.log(`Escrito ${toPosix(relative(process.cwd(), join(ROOT, OUT)))}`)
console.log(
  `  ${data.cards.length} tarjetas, ${data.questions.length} preguntas (${count('abierta')} abiertas, ${count('parcial')} parciales, ${count('respondida')} respondidas), ${data.docs.length} documentos`,
)
for (const w of warnings) console.warn(`  aviso: ${w}`)
