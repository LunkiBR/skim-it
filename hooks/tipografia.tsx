// Tipografia da resposta (v0.1): títulos # e ## um degrau acima do corpo e a régua nativa (---)
// antes de cada ##. O próprio app desenha a resposta inteira, com o texto reescrito (blocks.ts): no
// Desktop o desenho nativo de uma mensagem aparece uma vez só por árvore (um segundo `next` some), e o
// Markdown de um mod tem entrelinha menor, fica 5 px à esquerda e não desenha a régua (vistos em
// 2026-11-15). Tamanho, entrelinha, margem, tabelas, código e links ficam os do app.
// Arquivo próprio porque o engine só aceita `$` passado a função declarada ou importada pelo nome:
// work.tsx a importa daqui em vez de recebê-la por parâmetro.
import { atom, read } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { sections } from './blocks'

// Com a tipografia ligada no Desktop, esta nota vai ao lado de cada pedido (register.tsx, prompt.submit)
// para o modelo escrever em seções (pedido de 2026-11-15: respostas sempre estruturadas).
// Resposta curta fica sem título.
export const SECTIONS_PROMPT = [
  '# Reply structure (skim-it)',
  'The person reads your replies in Claude Code Desktop with the skim-it typography on: it draws each `##` heading one step above the body and a rule between sections, so a structured reply can be scanned at a glance.',
  'When a reply has more than one part or runs past a short paragraph, open with a one-sentence answer or summary, then give each part a `##` heading of a few words and put its body below in short paragraphs, lists or tables.',
  'Use `###` only inside a section and never `#`. A short reply (a direct answer of a sentence or two) stays without headings.',
].join('\n')

// O engine lê as referências dos atoms no código-fonte: plugin e key têm de ser literais.
export const tipografia = atom({ plugin: 'skim-it', key: 'tipografia' } as const, false)

export async function typography($: EngineInterface, e: any, next: any) {
  const isOn = await read($, tipografia)
  if (e.surface !== 'desktop' || !isOn) return next(e)
  const text = sections(String(e.props?.text ?? ''))
  return next(text === null ? e : { ...e, props: { ...e.props, text } })
}
