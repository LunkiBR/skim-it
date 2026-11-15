// Lógica pura das sessões em paralelo (v0.3), sem `$`, sem fs, sem relógio: `now` entra por parâmetro.
// Cada sessão grava um PeerFile em ~/.claude/skim-it/fleet/<sessionId>.json. Testada em scripts/check-fleet.mjs.

import type { PeerFile, Links, WaitingWhat, PeerKind } from '../types'
export type { PeerKind, WaitingWhat, PeerFile, Links } from '../types'
import { cnt, tr } from './i18n'
import type { Lang } from './i18n'

export type Status = 'precisa' | 'rodando' | 'segundo-plano' | 'pronta' | 'sem-sinal' | 'recente' | 'hoje' | 'antiga'

export const MIN = 60_000
export const HOUR = 60 * MIN
export const SILENCE_MS = 10 * MIN // rodando sem evento há mais disso: sem sinal
export const DEAD_MS = 3 * MIN // arquivo sem update há mais disso: sessão morta (as vivas batem a cada 30 s)
export const RECENT_MS = 2 * HOUR
export const TODAY_MS = 24 * HOUR

const KINDS: readonly string[] = ['working', 'background', 'waiting', 'review', 'idle']
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown): v is string => typeof v === 'string'

// Valida o arquivo lido do disco; nunca lança, devolve null se for lixo.
export function parsePeer(text: string): PeerFile | null {
  let o: any
  try {
    o = JSON.parse(text)
  } catch {
    return null
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  if (!str(o.id) || !o.id || !str(o.host) || !str(o.root) || !str(o.cwd)) return null
  if (!KINDS.includes(o.kind)) return null
  if (!num(o.lastTurnAt) || !num(o.startedAt) || !num(o.updatedAt)) return null
  const peer: PeerFile = {
    id: o.id,
    host: o.host,
    root: o.root,
    cwd: o.cwd,
    label: str(o.label) ? o.label : '',
    topic: str(o.topic) ? o.topic : '',
    kind: o.kind,
    lastTurnAt: o.lastTurnAt,
    lastEventAt: num(o.lastEventAt) ? o.lastEventAt : o.updatedAt,
    startedAt: o.startedAt,
    updatedAt: o.updatedAt,
    editedFiles: num(o.editedFiles) ? Math.max(0, Math.floor(o.editedFiles)) : 0,
  }
  if (str(o.parentHost) && o.parentHost) peer.parentHost = o.parentHost
  if (str(o.waitingWhat) && (o.waitingWhat === 'responder pergunta' || /^aprovar .+/.test(o.waitingWhat))) {
    peer.waitingWhat = o.waitingWhat as WaitingWhat
  }
  const b = o.background
  if (b && typeof b === 'object') {
    peer.background = { agents: num(b.agents) ? b.agents : 0, shells: num(b.shells) ? b.shells : 0 }
    if (num(b.wakeAt)) peer.background.wakeAt = b.wakeAt
  }
  return peer
}

function hasBackground(p: PeerFile, now: number): boolean {
  const b = p.background
  return !!b && (b.agents > 0 || b.shells > 0 || (b.wakeAt !== undefined && b.wakeAt > now))
}

// Estado exibido: sem update há mais de 24 h é antiga; morta (sem update há mais de 3 min) nunca é
// precisa, rodando nem segundo plano e vale pelo último turno (pronta continua pronta); viva:
// esperando vence tudo, rodando (sem sinal se 10 min sem evento), segundo plano, pronta, senão o tempo parado.
export function sessionStatus(p: PeerFile, now: number): Status {
  if (now - p.updatedAt > TODAY_MS) return 'antiga'
  if (now - p.updatedAt <= DEAD_MS) {
    if (p.kind === 'waiting') return 'precisa'
    if (p.kind === 'working') {
      if (now - p.lastEventAt <= SILENCE_MS) return 'rodando'
      return hasBackground(p, now) ? 'segundo-plano' : 'sem-sinal'
    }
    if (p.kind === 'background' && hasBackground(p, now)) return 'segundo-plano'
  }
  const since = now - p.lastTurnAt
  if (p.kind === 'review' && since <= TODAY_MS) return 'pronta'
  if (since < RECENT_MS) return 'recente'
  if (since < TODAY_MS) return 'hoje'
  return 'antiga'
}

// Prioridade no painel; antiga não aparece, só conta.
export const STATUS_ORDER: readonly Status[] = ['precisa', 'rodando', 'segundo-plano', 'pronta', 'sem-sinal', 'recente', 'hoje']

export type Row = { peer: PeerFile; status: Status }
export type Grouped = { mine: Row[]; others: Row[]; antigas: number }

// Separa as do meu projeto das demais; dentro de cada grupo ordena por estado e, no empate, pela mais recente.
export function groupByProject(peers: PeerFile[], myRoot: string, now: number): Grouped {
  const out: Grouped = { mine: [], others: [], antigas: 0 }
  for (const peer of peers) {
    const status = sessionStatus(peer, now)
    if (status === 'antiga') {
      out.antigas++
      continue
    }
    ;(peer.root === myRoot ? out.mine : out.others).push({ peer, status })
  }
  const rank = (r: Row) => STATUS_ORDER.indexOf(r.status)
  const cmp = (a: Row, b: Row) => rank(a) - rank(b) || b.peer.lastTurnAt - a.peer.lastTurnAt || a.peer.id.localeCompare(b.peer.id)
  out.mine.sort(cmp)
  out.others.sort(cmp)
  return out
}

// Mãe (pelo parentHost de quem sou) e filhas (quem tem a mim como pai), com estado.
export function family(peers: PeerFile[], me: PeerFile, now: number): { mother: Row | null; children: Row[] } {
  const row = (peer: PeerFile): Row => ({ peer, status: sessionStatus(peer, now) })
  const mom = me.parentHost ? peers.find(p => p.host === me.parentHost && p.id !== me.id) : undefined
  return {
    mother: mom ? row(mom) : null,
    children: peers.filter(p => p.parentHost === me.host && p.id !== me.id).map(row),
  }
}

// Quantas sessões esperam por você (menos esta). A linha âmbar completa só vale para filha esperando.
export function waitingCounter(peers: PeerFile[], me: PeerFile, now: number): { count: number; childWaiting: boolean; child?: PeerFile } {
  const waiting = peers.filter(p => p.id !== me.id && sessionStatus(p, now) === 'precisa')
  const child = waiting.find(p => p.parentHost === me.host)
  return { count: waiting.length, childWaiting: !!child, child }
}

// Frota de demonstração (/skim-it demo): seis sessões de exemplo no projeto desta, para ver e gravar a band
// completa sem abrir dez janelas. Esta sessão vira a terceira, rodando.
export function demoPeers(me: PeerFile, now: number): PeerFile[] {
  const M = 60_000
  const mk = (n: number, topic: string, kind: PeerKind, extra: Partial<PeerFile> = {}): PeerFile => ({
    id: 'demo-' + n, host: 'demo-' + n, root: me.root, cwd: me.cwd, label: me.label, topic, kind,
    lastTurnAt: now - 2 * M, lastEventAt: now - 30_000, startedAt: now - (70 - n * 8) * M, updatedAt: now, editedFiles: 0, ...extra,
  })
  return [
    mk(1, 'Revisão do coletor', 'working'),
    mk(2, 'Triagem das fotos', 'waiting', { waitingWhat: 'aprovar Bash' }),
    { ...me, kind: 'working', startedAt: now - (70 - 3 * 8) * M, lastEventAt: now, updatedAt: now },
    mk(4, 'Board de aprovação', 'review', { editedFiles: 3, lastTurnAt: now - 8 * M }),
    mk(5, 'Busca no Google Imagens', 'background', { background: { agents: 1, shells: 0 } }),
    mk(6, 'Testes do gate SVG', 'working'),
    mk(7, 'Docs do desenho', 'idle', { lastTurnAt: now - 40 * M, lastEventAt: now - 40 * M }),
  ]
}

// Sessões deste projeto (menos esta) que esperam por você, na ordem do painel: a primeira é a do aviso.
export function waitingMine(peers: PeerFile[], me: PeerFile, now: number): Row[] {
  return groupByProject(peers, me.root, now).mine.filter(r => r.status === 'precisa' && r.peer.id !== me.id)
}

// Pasta de rascunho do app: chat sem projeto.
export function isScratch(cwd: string): boolean {
  return /scratch-workspaces|\/scratch-\d{4}-\d{2}-\d{2}-/i.test(cwd.replace(/\\/g, '/'))
}

// Rótulo curto: "chat" para rascunho; nome do repo se houver; senão a última pasta; worktree do Treehouse vira "repo#2".
export function sessionLabel(cwd: string, repoName?: string, lang: Lang = 'pt'): string {
  const path = cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!repoName && isScratch(path)) return 'chat'
  const slot = path.match(/\/\.treehouse\/[^/]+\/(\d+)\/[^/]+/)?.[1]
  const base = (repoName || path.split('/').filter(Boolean).pop() || tr(lang, 'label.session')).toLowerCase()
  return slot ? base + '#' + slot : base
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? s + ' s' : s < 3600 ? Math.round(s / 60) + ' min' : s < 86400 ? Math.round(s / 3600) + ' h' : Math.round(s / 86400) + ' d'
}

export const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many)

// "2 agentes, 1 comando"
export function backgroundText(b: NonNullable<PeerFile['background']>, lang: Lang = 'pt'): string {
  return [b.agents ? cnt(lang, b.agents, 'agent') : '', b.shells ? cnt(lang, b.shells, 'shell') : ''].filter(Boolean).join(', ')
}

// O que a sessão espera, como o arquivo guarda (em português, valor de dados), dito no idioma de quem lê.
export function waitingText(w: WaitingWhat, lang: Lang = 'pt'): string {
  return w === 'responder pergunta' ? tr(lang, 'wait.question') : tr(lang, 'wait.approve', { tool: w.slice('aprovar '.length) })
}

// O que a linha do painel diz do estado (esperando, o quê).
export function statusWords(r: Row, now: number, lang: Lang = 'pt'): string {
  const p = r.peer
  switch (r.status) {
    case 'precisa': return p.waitingWhat ? waitingText(p.waitingWhat, lang) : tr(lang, 'st.waits')
    case 'rodando': return tr(lang, 'st.running')
    case 'segundo-plano': return tr(lang, 'st.bg') + (p.background && backgroundText(p.background, lang) ? ' · ' + backgroundText(p.background, lang) : '')
    case 'pronta': return tr(lang, 'st.ready')
    case 'sem-sinal': return tr(lang, 'st.nosignal', { t: ago(now - p.lastEventAt) })
    default: return tr(lang, 'st.idle', { t: ago(now - p.lastTurnAt) })
  }
}

// Palavra curta: band no celular e chips das filhas.
export function statusWord(s: Status, lang: Lang = 'pt'): string {
  const key = s === 'recente' || s === 'hoje' || s === 'antiga' ? 'parada' : s
  return tr(lang, ('sw.' + key) as 'sw.parada')
}

// Campo de cron (*, número, faixa, lista, passo) como conjunto de valores; null se não entendo.
function cronSet(part: string, lo: number, hi: number): Set<number> | null {
  const ok = new Set<number>()
  for (const piece of part.split(',')) {
    const m = piece.match(/^(?:(\*)|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/)
    if (!m) return null
    const step = m[4] ? Number(m[4]) : 1
    if (step < 1) return null
    const a = m[1] ? lo : Number(m[2])
    const b = m[1] ? hi : m[3] ? Number(m[3]) : m[4] ? hi : a
    for (let v = a; v <= b; v += step) ok.add(v)
  }
  return ok
}

// Próxima vez (hora local) em que um cron de 5 campos dispara depois de `now`, em até 48 h.
export function nextCron(schedule: string, now: number): number | undefined {
  const f = schedule.trim().split(/\s+/)
  if (f.length !== 5) return undefined
  const lim: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]]
  const sets = f.map((part, i) => cronSet(part, lim[i]![0], lim[i]![1]))
  if (sets.some(s => !s)) return undefined
  const [mi, ho, dm, mo, dw] = sets as Set<number>[]
  const start = new Date(now)
  start.setSeconds(0, 0)
  for (let i = 1; i <= 2880; i++) {
    const d = new Date(start.getTime() + i * MIN)
    // Dia do mês e dia da semana: se os dois são restritos, vale um OU o outro (regra do cron).
    const day = f[2] !== '*' && f[4] !== '*' ? dm!.has(d.getDate()) || dw!.has(d.getDay()) : dm!.has(d.getDate()) && dw!.has(d.getDay())
    if (mi!.has(d.getMinutes()) && ho!.has(d.getHours()) && mo!.has(d.getMonth() + 1) && day) return d.getTime()
  }
  return undefined
}

// Fim de turno (classic.Stop): trabalho em segundo plano a partir de background_tasks e session_crons.
export function backgroundOf(tasks: { type?: string }[] | undefined, crons: { schedule?: string }[] | undefined, now: number): PeerFile['background'] | undefined {
  const t = tasks ?? []
  const agents = t.filter(x => x.type === 'subagent').length
  const shells = t.length - agents
  let wakeAt: number | undefined
  for (const c of crons ?? []) {
    const at = c.schedule ? nextCron(c.schedule, now) : undefined
    if (at !== undefined && (wakeAt === undefined || at < wakeAt)) wakeAt = at
  }
  if (!agents && !shells && wakeAt === undefined) return undefined
  return wakeAt === undefined ? { agents, shells } : { agents, shells, wakeAt }
}

// Sessão do Desktop como vem de list_sessions (só o que o mod lê).
export type DeskRow = { sessionId: string; title?: string; isRunning?: boolean; pinned?: boolean; isPinned?: boolean; running?: boolean; status?: string; startedBy?: string; parentSessionId?: string; link?: string; [k: string]: unknown }

export const OLD_MS = 30 * 24 * HOUR

// Instante da última atividade que o Desktop informa; sem campo conhecido, undefined (e nunca se arquiva às cegas).
export function deskActivity(r: DeskRow): number | undefined {
  for (const k of ['lastActivityAt', 'lastActiveAt', 'updatedAt', 'lastMessageAt', 'modifiedAt']) {
    const v = r[k]
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : NaN
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n
  }
  return undefined
}

const running = (r: DeskRow) => r.isRunning === true || r.running === true || r.status === 'running'

// Caminho como chave de projeto: barras normais, sem barra final, minúsculo em unidade do Windows.
export const normPath = (p: string): string => {
  const s = p.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[a-z]:/i.test(s) ? s.toLowerCase() : s
}

// Candidatas ao arquivamento em lote: paradas há mais de 30 dias. Nunca entram: esta sessão (selfHost),
// linha sem sessionId texto, pinada, rodando e filha de sessão rodando. Sem selfHost não se arquiva nada.
export function archivable(rows: DeskRow[], now: number, selfHost: string | undefined): DeskRow[] {
  if (!selfHost) return []
  const live = new Set(rows.filter(r => typeof r.sessionId === 'string' && running(r)).map(r => r.sessionId))
  return rows.filter(r => {
    if (typeof r.sessionId !== 'string' || !r.sessionId || r.sessionId === selfHost) return false
    const at = deskActivity(r)
    if (at === undefined || now - at <= OLD_MS) return false
    if (r.pinned === true || r.isPinned === true || running(r)) return false
    const parent = String(r.parentSessionId ?? r.startedBy ?? '')
    return !(parent && live.has(parent))
  })
}

// Índice estável da sessão entre as do mesmo projeto (início e id), para o tom ser sempre o mesmo.
export function toneIndex(peers: PeerFile[], myRoot: string, id: string): { index: number; total: number } {
  const mates = peers.filter(p => p.root === myRoot).sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))
  return { index: Math.max(0, mates.findIndex(p => p.id === id)), total: Math.max(1, mates.length) }
}

// Texto escuro ou claro, o de maior contraste (WCAG) sobre o fundo #rrggbb; para o chip do projeto.
export function inkOn(hex: string): string {
  const lin = (i: number) => {
    const x = parseInt(hex.slice(i, i + 2), 16) / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5)
  // contraste com branco (1.05 / (lum + 0.05)) contra o com #111111 (lum 0.0056)
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.0556 ? '#ffffff' : '#111111'
}
