// Cartão de retorno (v0.4), parte pura: o que a band diz quando você volta e a sessão rodou sem você.
import type { Volta } from '../types'
import { ago, MIN } from './fleetcore'
import { cnt, tr } from './i18n'
import type { Lang } from './i18n'

export type { Volta } from '../types'

export const RETURN_MS = 10 * MIN

/** A resposta termina em pergunta (aceita fecha-aspas e negrito depois do "?"). */
export const endsAsking = (answer: string): boolean => /\?[\s*_)"'”»]*$/.test(answer.trim())

/** Mais de 10 min desde o seu último pedido, algum turno rodou sem você e o cartão não foi dispensado. */
export const showReturn = (v: Volta, now: number): boolean => !v.dismissed && v.turns > 0 && now - v.since > RETURN_MS

/** "Enquanto você estava fora (37 min): 3 turnos · 5 arquivos · 2 commits"; partes zeradas somem. */
export function returnLine(v: Volta, now: number, lang: Lang = 'pt'): string {
  const parts = [cnt(lang, v.turns, 'turn')]
  if (v.files > 0) parts.push(cnt(lang, v.files, 'file'))
  if (v.commits > 0) parts.push(cnt(lang, v.commits, 'commit'))
  return tr(lang, 'back.line', { ago: ago(now - v.since), parts: parts.join(' · ') })
}
