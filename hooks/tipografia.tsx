// Tipografia da resposta (v0.1): títulos # e ## um degrau acima do corpo, em semibold, e a régua
// nativa do app (---) antes de cada ##. O resto continua no Markdown do app (tabelas, código, listas).
// Arquivo próprio porque o engine só aceita `$` passado a função declarada ou importada pelo nome:
// work.tsx a importa daqui em vez de recebê-la por parâmetro.
import { atom, read } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { absolutize, splitBlocks } from './blocks'

// O engine lê as referências dos atoms no código-fonte: plugin e key têm de ser literais.
export const tipografia = atom({ plugin: 'skim-it', key: 'tipografia' } as const, false)

export async function typography($: EngineInterface, e: any, next: any) {
  const isOn = await read($, tipografia)
  if (e.surface !== 'desktop' || !isOn) return next(e)
  const text = String(e.props?.text ?? '')
  const blocks = splitBlocks(text)
  if (!blocks) return next(e)

  const cwd = String(await $.session.cwd())
  const { Box, Text, Markdown } = $.ui.resolve(e)
  return (
    <Box flexDirection="column">
      {blocks.map((block, i) =>
        block.kind === 'heading' ? (
          <Box key={'h' + i} marginTop={i === 0 ? 0 : 'sm'}>
            {/* `heading` sai do tamanho do corpo no Desktop (visto em 2026-11-14); `title` é o degrau que aparece. */}
            <Text size="title" weight="semibold">
              {block.text}
            </Text>
          </Box>
        ) : block.kind === 'rule' ? (
          // Espaço antes da régua, como uma linha em branco: a seção anterior respira.
          // Largura total: numa caixa que encolhe ao conteúdo a régua some (visto em 2026-11-14).
          <Box key={'r' + i} marginTop="md" width="100%">
            <Markdown text="---" />
          </Box>
        ) : blocks[i - 1]?.kind === 'heading' && block.text.trimStart().startsWith('|') ? (
          // A tabela não tem margem própria e cola no título (visto em 2026-11-15): uma linha de respiro.
          <Box key={'m' + i} marginTop="sm">
            <Markdown text={absolutize(block.text, cwd)} />
          </Box>
        ) : (
          <Markdown key={'m' + i} text={absolutize(block.text, cwd)} />
        ),
      )}
    </Box>
  )
}
