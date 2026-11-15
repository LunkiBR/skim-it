// Cartão de retorno (v0.4), parte de execução: guarda quando foi o seu último pedido e o que rodou
// depois dele sem você (notificação de tarefa, despertador, continuação automática). Sem modelo.
import { atom, read, update } from 'claude-code'

import type { Volta } from './retorno'

// O engine lê as referências dos atoms no código-fonte: plugin e key têm de ser literais.
export const volta = atom({ plugin: 'skim-it', key: 'volta' } as const, { since: 0, turns: 0, files: 0, commits: 0, dismissed: false } as Volta)

// Arquivos editados enquanto roda um turno que não é seu; o work.tsx alimenta no tool.call.
export const away = { on: false, files: new Set<string>() }

const OWNER = ['composer', 'bridge']
const MEANWHILE = ['task-notification', 'scheduled-trigger', 'auto-continuation']
let pending: 'owner' | 'other' | undefined
let counted = false

export async function voltaStart($: any) {
  await update($, volta, (v: Volta) => ({ ...v, since: Date.now() }))
}

// Chamado em todo prompt.submit: um pedido seu zera o cartão; os outros só marcam o próximo turno.
export async function voltaPrompt($: any, e: any) {
  const kind = String(e.origin?.kind ?? '')
  const text = String(e.text ?? '').trim()
  if (OWNER.includes(kind) && text && !text.startsWith('/')) {
    pending = 'owner'
    away.files.clear()
    await update($, volta, () => ({ since: Date.now(), turns: 0, files: 0, commits: 0, dismissed: false }))
  } else if (MEANWHILE.includes(kind)) pending = 'other'
}

export function voltaTurnStart(e: any) {
  if (e.agentId !== undefined) return
  counted = pending === 'other'
  away.on = counted
  pending = undefined
}

export async function voltaTurnComplete($: any, e: any) {
  if (e.agentId !== undefined) return
  away.on = false
  if (!counted) return
  counted = false
  try {
    await update($, volta, (v: Volta) => ({ ...v, turns: v.turns + 1, files: away.files.size }))
    const since = ((await read($, volta)) as Volta).since
    const out = await $.process.run(['git', 'rev-list', '--count', '--since=' + new Date(since).toISOString(), 'HEAD'], { timeoutMs: 8000 })
    const commits = out.exitCode === 0 ? Number(String(out.stdout).trim()) || 0 : 0
    await update($, volta, (v: Volta) => ({ ...v, commits }))
  } catch {
    // sem git: o cartão fica sem commits
  }
  $.ui.invalidate('ui.render')
}

export function voltaDismiss($: any) {
  return update($, volta, (v: Volta) => ({ ...v, dismissed: true }))
}
