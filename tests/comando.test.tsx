// `/skim-it:ajustes` (commands/ajustes.md) aparece na lista já na tela de sessão nova; quando roda, o mod
// abre o cartão de ajustes e o texto do arquivo não chega ao modelo. Rodar: claude plugin test .
import { expect, test } from 'claude-code/testing'

test('/skim-it:ajustes abre o cartão no lugar do texto do arquivo', async ($, on) => {
  on('store.get', () => ({ value: undefined }))
  const placed: string[] = []
  on('ui.place', (_: unknown, e: { id: string }) => {
    placed.push(e.id)
    return { value: { isPlaced: true as const, requestId: e.id } }
  })
  // Este hook está no lugar do engine: rodar o comando em arquivo mandaria o texto dele ao modelo.
  let ranFile = false
  on('command.run', () => {
    ranFile = true
    return { text: 'texto do arquivo' }
  })

  const out = await $.command.run({
    command: 'skim-it:ajustes',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(ranFile).toBe(false)
  expect(placed.length).toBe(1)
  expect(out.text).not.toBe('texto do arquivo')
})
