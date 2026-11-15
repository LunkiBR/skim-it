// Sessões em paralelo (v0.3), parte de execução: cada sessão grava o próprio PeerFile em
// ~/.claude/skim-it/fleet/<id>.json (batimento de 30 s e a cada mudança de estado), lê os das outras
// a cada 5 s e lê do Desktop (ccd_session_mgmt) título, mãe e sessões antigas. A lógica pura mora
// em fleetcore.ts. Portado do fleet.tsx do session-hue.
import { atom, read, update } from 'claude-code'

import { archivable, backgroundOf, normPath, parsePeer, sessionLabel, TODAY_MS } from './fleetcore'
import type { DeskRow, Links, PeerFile, PeerKind, WaitingWhat } from './fleetcore'
import { getLang, tr } from './i18n'
import { cleanTopic, topicPrompt } from './topic'

// O engine lê as referências dos atoms no código-fonte: plugin e key têm de ser literais.
export const peers = atom({ plugin: 'skim-it', key: 'peers' } as const, [] as PeerFile[])
export const painel = atom({ plugin: 'skim-it', key: 'painel' } as const, false)
export const hojeAberto = atom({ plugin: 'skim-it', key: 'hojeAberto' } as const, false)
export const confirma = atom({ plugin: 'skim-it', key: 'confirma' } as const, false)
export const links = atom({ plugin: 'skim-it', key: 'links' } as const, { ok: false, titles: {}, links: {}, old: [] } as Links)
export const assunto = atom({ plugin: 'skim-it', key: 'assunto' } as const, '')
// Ids que o painel listou no passo de confirmar o arquivamento: só esses são arquivados.
export const arquivarIds = atom({ plugin: 'skim-it', key: 'arquivarIds' } as const, [] as string[])
// Turno da conversa principal rodando; vive no atom para sobreviver a um recarregamento.
export const turnoVivo = atom({ plugin: 'skim-it', key: 'turnoVivo' } as const, false)

const HEARTBEAT_MS = 30_000
const SWEEP_MS = 5_000
const LINKS_EVERY = 6 // varreduras: 30 s
const MCP_MS = 10_000 // teto de cada chamada ao MCP do Desktop

// Estado desta sessão. `base` é o estado sem segundo plano; o tipo 'background' sai de `base` + `background`.
const me = {
  id: '',
  host: '',
  parentHost: undefined as string | undefined,
  root: '',
  cwd: '',
  label: '',
  base: 'idle' as Exclude<PeerKind, 'background'>,
  waitingWhat: undefined as WaitingWhat | undefined,
  background: undefined as PeerFile['background'],
  lastTurnAt: 0,
  lastEventAt: 0,
  startedAt: 0,
  editedFiles: 0,
  askedAtEnd: false, // o último turno terminou perguntando
  turnStartAt: 0,
  turnSeq: 0,
}
let isStarting = false
let sweeps = 0
let topicBusy = false
let linksBusy = false
let timers: { cancel(): void }[] = []

export const myId = () => me.id
export const myHost = () => me.host

async function home($: any): Promise<string> {
  return String((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '').replace(/\\/g, '/')
}
async function fleetDir($: any): Promise<string> {
  return (await home($)) + '/.claude/skim-it/fleet'
}

// Raiz do projeto: o diretório comum do git (worktrees caem no mesmo projeto); fora do git, a pasta.
export async function rootOf($: any, cwd: string): Promise<string> {
  try {
    const out = await $.process.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd, timeoutMs: 8000 })
    const common = out.exitCode === 0 ? String(out.stdout).trim() : ''
    return normPath(common ? common.replace(/[\\/]\.git[\\/]?$/, '') : cwd)
  } catch {
    return normPath(cwd)
  }
}

function snapshot(now: number, topic: string): PeerFile {
  const kind: PeerKind = (me.base === 'idle' || me.base === 'review') && me.background ? 'background' : me.base
  const p: PeerFile = {
    id: me.id,
    host: me.host,
    root: me.root,
    cwd: me.cwd,
    label: me.label,
    topic,
    kind,
    lastTurnAt: me.lastTurnAt,
    lastEventAt: me.lastEventAt,
    startedAt: me.startedAt,
    updatedAt: now,
    editedFiles: me.editedFiles,
  }
  if (me.parentHost) p.parentHost = me.parentHost
  if (kind === 'waiting' && me.waitingWhat) p.waitingWhat = me.waitingWhat
  if (me.background) p.background = me.background
  return p
}

export async function publish($: any) {
  if (!me.id) return
  try {
    const now = await $.clock.now()
    const cwd = String(await $.session.cwd()).replace(/\\/g, '/')
    if (cwd !== me.cwd) {
      me.cwd = cwd
      me.root = await rootOf($, cwd)
      me.label = sessionLabel(cwd, (await $.session.repo().catch(() => null))?.name, getLang())
    }
    const mine = snapshot(now, String(await read($, assunto)))
    await $.fs.write((await fleetDir($)) + '/' + me.id + '.json', JSON.stringify(mine))
    await update($, peers, (all: PeerFile[]) => [...all.filter(p => p.id !== me.id), mine])
    $.ui.invalidate('ui.render')
  } catch {
    // a frota é um extra: nunca derruba a sessão
  }
}

// Lê os arquivos das outras sessões; esvazia os de sessões sem sinal há mais de 24 h ($.fs não apaga).
// Arquivo meio escrito mantém o par anterior; o atom só muda quando o conteúdo mudou (a band não redesenha à toa).
export async function sweep($: any) {
  try {
    const dir = await fleetDir($)
    const now = await $.clock.now()
    let entries: any[] = []
    try { entries = await $.fs.list(dir) } catch { entries = [] }
    const prev = (await read($, peers)) as PeerFile[]
    const found: PeerFile[] = []
    for (const entry of entries) {
      const name = String(entry.name)
      if (entry.kind !== 'file' || !name.endsWith('.json')) continue
      const id = name.slice(0, -'.json'.length)
      if (id === me.id) continue
      let peer: PeerFile | null = null
      if (entry.size !== 0) {
        try { peer = parsePeer(String(await $.fs.read(dir + '/' + name))) } catch { peer = null }
      }
      if (!peer) {
        // vazio, inválido ou meio escrito por outra sessão: segue com o que já se sabia dela
        const was = prev.find(p => p.id === id)
        if (was && now - was.updatedAt <= TODAY_MS) found.push(was)
        continue
      }
      if (peer.id === me.id) continue
      if (now - peer.updatedAt > TODAY_MS) {
        await $.fs.write(dir + '/' + name, '').catch(() => undefined)
        continue
      }
      found.push(peer)
    }
    // A minha linha é a que o publish gravou: refazer o snapshot a cada varredura mudaria `updatedAt` sempre.
    if (me.id) found.push(prev.find(p => p.id === me.id) ?? snapshot(now, String(await read($, assunto))))
    const byId = (a: PeerFile, b: PeerFile) => a.id.localeCompare(b.id)
    found.sort(byId)
    if (JSON.stringify(found) !== JSON.stringify([...prev].sort(byId))) await update($, peers, () => found)
    sweeps += 1
    if (sweeps % LINKS_EVERY === 1) void loadLinks($)
  } catch {
    // idem
  }
}

// Espera `p` por no máximo `ms`: o MCP do Desktop pode demorar e nenhum hook pode ficar preso nele.
function timed<T>($: any, p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = $.clock.after(ms, () => reject(new Error(tr(getLang(), 'desk.timeout'))))
    p.then(
      v => { timer?.cancel?.(); resolve(v) },
      err => { timer?.cancel?.(); reject(err) },
    )
  })
}

// Uma ferramenta ccd do Desktop pelo MCP da sessão; o resultado vem em JSON. Nunca espere isto dentro de
// session.start, command.run ou ui.press: use `void` (as funções que chamam já tratam o erro).
async function ccd($: any, server: string, tool: string, args: Record<string, unknown>): Promise<any> {
  const out = await timed($, Promise.resolve().then(() => $.mcp.call(server, tool, args)), MCP_MS)
  const text = ((out?.content ?? []) as any[]).map((block: any) => (block?.type === 'text' ? String(block.text ?? '') : '')).join('')
  if (out?.isError) throw new Error(text.slice(0, 200))
  return JSON.parse(text)
}

// Mãe (cadeia de pais do Desktop), títulos, links e sessões antigas. Sem as ferramentas do Desktop
// (terminal, SSH) tudo falha em silêncio e a band usa só os arquivos da frota.
export async function loadLinks($: any) {
  if (linksBusy) return
  linksBusy = true
  try {
    const self = (await ccd($, 'ccd_session_mgmt', 'get_session', { session_id: 'self' })) as DeskRow
    const rows = (await ccd($, 'ccd_session_mgmt', 'list_sessions', { limit: 200 })) as DeskRow[]
    // O id do Desktop pode só chegar agora: quem o aprendeu publica para as outras sessões acharem a mãe e as filhas.
    const learned = !me.host && !!self?.sessionId
    if (learned) me.host = String(self.sessionId)
    const parent = String(self?.parentSessionId ?? self?.startedBy ?? '')
    const changed = (me.parentHost ?? '') !== parent
    me.parentHost = parent || undefined
    const titles: Record<string, string> = {}
    const urls: Record<string, string> = {}
    for (const r of [self, ...rows]) {
      if (typeof r?.sessionId !== 'string') continue
      if (r.title) titles[r.sessionId] = String(r.title)
      if (r.link) urls[r.sessionId] = String(r.link)
    }
    const old = archivable(rows, await $.clock.now(), me.host).map(r => ({ host: r.sessionId, title: String(r.title ?? '') }))
    await update($, links, () => ({ ok: true, titles, links: urls, old }))
    if (changed || learned) await publish($)
  } catch {
    await update($, links, (was: Links) => ({ ...was, ok: false })).catch(() => undefined)
  } finally {
    linksBusy = false
  }
}

// Abre outra sessão no app pelo link dela; só `claude:` e `https:` vão ao sistema operacional.
export async function openSession($: any, host: string) {
  const known = String((await read($, links)).links[host] ?? '')
  const safe = /^(claude|https):/i.test(known) ? known : ''
  const link = safe || 'claude://claude.ai/epitaxy/' + encodeURIComponent(host)
  // O mod não sabe o sistema: o primeiro abridor que existir leva o link (Windows, macOS, Linux).
  for (const argv of [['rundll32', 'url.dll,FileProtocolHandler', link], ['open', link], ['xdg-open', link]]) {
    const out = await $.process.run(argv, { timeoutMs: 8000 }).catch(() => undefined)
    if (out?.exitCode === 0) return
  }
}

// Passo de confirmar: guarda os ids listados agora; só esses serão arquivados.
export async function askArchive($: any) {
  const ids = ((await read($, links)) as Links).old.map(o => o.host)
  await update($, arquivarIds, () => ids)
  await update($, confirma, () => ids.length > 0)
}

// Cancelar, ou depois de arquivar: sem confirmação pendente.
export async function clearArchive($: any) {
  await update($, confirma, () => false)
  await update($, arquivarIds, () => [])
}

// "arquivar" sem confirmação pendente que combine não faz nada; com ela, arquiva sem esperar o Desktop.
export async function confirmArchive($: any) {
  const ids = (await read($, arquivarIds)) as string[]
  if ((await read($, confirma)) !== true || ids.length === 0) return
  await clearArchive($)
  void archiveOld($, ids)
}

// Arquiva pelo Desktop exatamente as `ids` do passo de confirmar. A lista é lida de novo agora só para
// tirar quem deixou de ser elegível (pinada, rodando, esta sessão); o app ainda recusa a que está aberta.
async function archiveOld($: any, ids: string[]) {
  try {
    const rows = (await ccd($, 'ccd_session_mgmt', 'list_sessions', { limit: 200 })) as DeskRow[]
    const ok = new Set(archivable(rows, await $.clock.now(), me.host).map(r => r.sessionId))
    const list = ids.filter(id => ok.has(id))
    let done = 0
    for (const id of list) {
      try {
        await ccd($, 'ccd_session_mgmt', 'archive_session', { session_id: id, reason: tr(getLang(), 'arch.reason') })
        done++
      } catch {
        // o app recusou esta (aberta, trabalhando ou sem permissão): segue com as outras
      }
    }
    $.ui.toast(tr(getLang(), 'arch.done', { done, n: ids.length }))
  } catch (error) {
    $.ui.toast(tr(getLang(), 'arch.fail', { err: String(error).slice(0, 120) }))
  }
  void loadLinks($)
  $.ui.invalidate('ui.render')
}

export async function togglePanel($: any) {
  const open = !(await read($, painel))
  await update($, painel, () => open)
  await clearArchive($)
  if (open) {
    void sweep($)
    void loadLinks($)
  }
  $.ui.invalidate('ui.render')
}

const topicKey = () => 'assunto:' + me.id

// Assunto da sessão: um rascunho no primeiro pedido e, ao fim de cada turno respondido, o que ela faz
// de fato. Nunca bloqueia: quem chama usa `void retopic(...)`.
export async function retopic($: any, asked: string, did = '') {
  if (topicBusy) return
  topicBusy = true
  try {
    const before = String(await read($, assunto))
    const r = await $.model.complete({ model: 'haiku', effort: 'low', maxTokens: 30, prompt: topicPrompt(before, asked, did, getLang()), timeoutMs: 8000 })
    let next = before
    if (r.isAnswered) next = cleanTopic(String(r.text)) || before
    else if (!before) next = cleanTopic(asked.split(/\s+/).slice(0, 4).join(' '))
    if (next && next !== before) {
      await $.store.set(topicKey(), next)
      await update($, assunto, () => next)
      await publish($)
    }
  } catch {
    // sem modelo: o assunto fica como está
  } finally {
    topicBusy = false
  }
}

// Depois de um turno respondido: pedido e resposta vêm das mensagens da sessão.
export async function retopicFromSession($: any) {
  try {
    const rows = await $.session.messages()
    const asked = [...rows].reverse().find((m: any) => m.role === 'user' && String(m.text).trim() && !String(m.text).trim().startsWith('/'))?.text ?? ''
    const last = rows.at(-1)
    const did = last?.role === 'assistant' ? String(last.text) : ''
    if (asked || did) void retopic($, String(asked), did)
  } catch {
    // sem mensagens legíveis
  }
}

// Mudanças de estado desta sessão. Todas publicam sem esperar e nunca lançam.
function set($: any, patch: Partial<typeof me>) {
  Object.assign(me, patch)
  void publish($).catch(() => undefined)
}
export const touch = () => void (me.lastEventAt = Date.now())
export function fleetPrompt($: any) {
  if (me.base === 'review' || me.askedAtEnd) set($, { base: 'idle', waitingWhat: undefined, askedAtEnd: false })
}
export function fleetWorking($: any) {
  me.turnSeq += 1
  set($, { base: 'working', waitingWhat: undefined, askedAtEnd: false, background: undefined, editedFiles: 0, turnStartAt: Date.now(), lastEventAt: Date.now() })
}
export function fleetWaiting($: any, what: WaitingWhat) {
  set($, { base: 'waiting', waitingWhat: what, lastEventAt: Date.now() })
}
export function fleetResume($: any) {
  if (me.base === 'waiting') set($, { base: 'working', waitingWhat: undefined, lastEventAt: Date.now() })
}
// Fim de turno da conversa principal: com arquivos editados e resposta, fica pronta para revisar até o próximo pedido;
// resposta que termina em pergunta espera você até o próximo pedido.
export function fleetDone($: any, edited: number, isAnswer: boolean, asked = false) {
  set($, {
    base: asked ? 'waiting' : edited > 0 && isAnswer ? 'review' : 'idle',
    waitingWhat: asked ? 'responder pergunta' : undefined,
    askedAtEnd: asked,
    editedFiles: edited,
    lastTurnAt: Date.now(),
  })
  void refreshAgents($)
}
// O classic.Stop pode nem chegar: um plugin de segurança de tier acima o desvia dos plugins comuns
// (visto em 2026-11-15). Os agentes em segundo plano vêm também de $.agent.list, no fim do turno e a
// cada batimento enquanto houver algum. Comandos e despertadores ainda dependem do classic.Stop.
async function refreshAgents($: any) {
  try {
    const list = (await $.agent.list()) as { status?: string }[]
    const agents = list.filter(a => a.status === 'pending' || a.status === 'running' || a.status === 'waiting').length
    const prev = me.background
    const shells = prev?.shells ?? 0
    const background = agents || shells || prev?.wakeAt !== undefined ? { ...prev, agents, shells } : undefined
    if (JSON.stringify(background) !== JSON.stringify(prev)) set($, { background })
  } catch {
    // sem a lista: fica o que o classic.Stop disse
  }
}
async function beat($: any) {
  if (me.background?.agents) await refreshAgents($)
  await publish($)
}
// Turno que respondeu e fez commits conta como "pronta para revisar" mesmo sem arquivo editado
// (commit por git na ferramenta de comando). Em segundo plano, com um comando git curto.
export async function fleetCommits($: any, isAnswer: boolean) {
  const seq = me.turnSeq
  const since = me.turnStartAt
  if (!isAnswer || !since || !me.cwd) return
  try {
    const iso = new Date(since).toISOString().slice(0, 19) + 'Z'
    const out = await $.process.run(['git', 'rev-list', '--count', '--since=' + iso, 'HEAD'], { cwd: me.cwd, timeoutMs: 5000 })
    const n = out.exitCode === 0 ? Number(String(out.stdout).trim()) || 0 : 0
    if (n > 0 && me.turnSeq === seq && me.base === 'idle') set($, { base: 'review' })
  } catch {
    // sem git: fica como está
  }
}
// classic.Stop: o que continua em segundo plano (agentes, comandos e despertadores).
export function fleetStop($: any, e: { background_tasks?: { type?: string }[]; session_crons?: { schedule?: string }[] }) {
  set($, { background: backgroundOf(e.background_tasks, e.session_crons, Date.now()) })
}

// Começa a frota: identidade, primeiro batimento e os relógios. Idempotente; só session.start (e attach) chamam.
export async function startFleet($: any) {
  if (me.id || isStarting) return
  isStarting = true
  try {
    me.id = String(await $.session.id())
    me.host = String((await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')) ?? '')
    me.startedAt = me.lastTurnAt = me.lastEventAt = await $.clock.now()
    const saved = (await $.store.get(topicKey())) as string | undefined
    if (saved) await update($, assunto, () => saved)
    await publish($)
    await sweep($)
    timers.forEach(t => t.cancel())
    timers = [$.clock.every(HEARTBEAT_MS, () => void beat($)), $.clock.every(SWEEP_MS, () => void sweep($))]
  } catch {
    me.id = ''
  } finally {
    isStarting = false
  }
}
