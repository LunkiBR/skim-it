// Assunto automático da sessão (portado do retopic/clean do session-hue): só o texto, sem `$`.
import { tr } from './i18n'
import type { Lang } from './i18n'

// before: assunto atual; asked: último pedido; did: o que a sessão fez e respondeu.
export function topicPrompt(before: string, asked: string, did = '', lang: Lang = 'pt'): string {
  return (
    tr(lang, 'topic.head') + '\n' + tr(lang, 'topic.current', { v: before || tr(lang, 'topic.none') }) +
    '\n' + tr(lang, 'topic.asked', { v: asked.slice(0, 600) }) +
    (did ? '\n' + tr(lang, 'topic.did', { v: did.slice(0, 900) }) : '') +
    '\n' + tr(lang, 'topic.tail')
  )
}

// Primeira linha da resposta do modelo, sem aspas nem ponto final, minúscula, até 40 letras.
export function cleanTopic(text: string): string {
  return (text.split('\n')[0] ?? '')
    .trim()
    .replace(/^["'`]+|["'`.]+$/g, '')
    .toLowerCase()
    .slice(0, 40)
}
