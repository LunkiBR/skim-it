// Lógica pura da linha de trabalho (v0.2), sem `$`: o que um turno fez, como resumir e como achar o
// dono de uma linha da conversa. Testada em scripts/check-worklog.mjs.

import type { Entry, DoneTurn } from '../types'
import { cnt, tr } from './i18n'
import type { Lang } from './i18n'
export type { Entry, DoneTurn } from '../types'

export type Density = 'compacto' | 'equilibrado' | 'detalhado'
export const DENSITIES: readonly Density[] = ['compacto', 'equilibrado', 'detalhado']

const KEEP_TURNS = 60
const KEEP_LOG = 80
// Trecho mínimo para casar um bloco que o app quebrou em vários.
const MIN_FRAGMENT = 24

export function norm(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 4000)
}

// O item de texto guarda no máximo 300 caracteres normalizados: o turno vive no atom e cresce com cada narração.
export const KEY_CAP = 300
export const textKey = (text: string): string => 't:' + norm(text).slice(0, KEY_CAP)

export function duration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return s + 's'
  const m = Math.floor(s / 60)
  return m < 60 ? m + 'm ' + (s % 60) + 's' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'
}

/** "Trabalhou 7m 57s · 54 passos · 3 arquivos" (a falha vai à parte, em vermelho). */
export function summaryText(t: DoneTurn, lang: Lang = 'pt'): string {
  const parts = [tr(lang, 'work.worked', { time: duration(t.durationMs) }), cnt(lang, t.steps, 'step')]
  if (t.files > 0) parts.push(cnt(lang, t.files, 'file'))
  return parts.join(' · ')
}

export function failureText(n: number, lang: Lang = 'pt'): string {
  return cnt(lang, n, 'failure')
}

/** Resumo de uma linha da entrada de uma ferramenta. */
export function gist(input: unknown): string {
  const o = (input ?? {}) as Record<string, unknown>
  const v = o.command ?? o.file_path ?? o.path ?? o.pattern ?? o.url ?? o.query ?? o.description ?? o.prompt ?? ''
  const text = String(v).replace(/\s+/g, ' ').trim()
  return text.length > 90 ? text.slice(0, 89) + '…' : text
}

const EDITS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

/** O arquivo que uma ferramenta de edição mudou, ou undefined. */
export function editedFile(tool: string, input: unknown): string | undefined {
  if (!EDITS.has(tool)) return undefined
  const o = (input ?? {}) as Record<string, unknown>
  const f = o.file_path ?? o.notebook_path
  return typeof f === 'string' && f ? f : undefined
}

export type Live = {
  id: string
  startedAt: number
  steps: number
  failures: number
  items: string[]
  log: Entry[]
  files: Set<string>
  blocks: Record<string, string>
  order: string[]
  before: Set<string>
}

export function newLive(id: string, startedAt: number, rendered: Set<string>): Live {
  return { id, startedAt, steps: 0, failures: 0, items: [], log: [], files: new Set(), blocks: {}, order: [], before: new Set(rendered) }
}

/**
 * Fecha o turno: tira a resposta final dos itens e da lista; um bloco desenhado no turno cujo texto
 * não está na resposta final é narração (trecho da resposta em streaming fica). Sem itens, null.
 */
export function finish(live: Live, finalAnswer: string, durationMs: number): DoneTurn | null {
  const final = norm(finalAnswer)
  const items = [...live.items]
  const at = items.lastIndexOf(textKey(final))
  if (at >= 0) items.splice(at, 1)
  for (const [rid, text] of Object.entries(live.blocks)) {
    if (text && !final.includes(text)) items.push('r:' + rid)
  }
  const log = live.log.filter(e => !(e.kind === 'say' && norm(e.text) === final)).slice(-KEEP_LOG)
  const first = live.order.find(k => items.includes(k)) ?? items[0]
  if (first === undefined) return null
  return { durationMs, steps: live.steps, failures: live.failures, files: live.files.size, items, first, final, log }
}

export function keepLast(all: Record<string, DoneTurn>, id: string, turn: DoneTurn): Record<string, DoneTurn> {
  return Object.fromEntries([...Object.entries(all).filter(([k]) => k !== id), [id, turn] as const].slice(-KEEP_TURNS))
}

/** O turno terminado que desenhou o item: chave exata, ou texto como trecho de uma narração, nunca da resposta final. */
export function owner(turns: Record<string, DoneTurn>, key: string): [string, DoneTurn] | null {
  for (const [id, t] of Object.entries(turns)) {
    if (t.items.includes(key)) return [id, t]
    if (!key.startsWith('t:')) continue
    const text = key.slice(2, 2 + KEY_CAP)
    if (text.length < MIN_FRAGMENT || t.final.includes(text)) continue
    if (t.items.some(k => k.startsWith('t:') && k.includes(text))) return [id, t]
  }
  return null
}

export function isFirstKey(t: DoneTurn, key: string): boolean {
  if (t.first === key) return true
  return t.first.startsWith('t:') && key.startsWith('t:') && t.first.slice(2).startsWith(key.slice(2, 2 + KEY_CAP))
}

/** "Bash ×3 · Edit ×2" para a densidade equilibrada. */
export function groupCounts(tools: string[]): string {
  const counts = new Map<string, number>()
  for (const t of tools) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts].map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(' · ')
}
