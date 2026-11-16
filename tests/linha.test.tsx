// Linha de trabalho na densidade compacta: no Desktop ela vai acima da resposta final e nenhuma linha do
// turno some (o Desktop desenha grupos e resumos que o mod não alcança); no terminal o turno recolhe.
// Rodar: claude plugin test .
import { expect, test } from 'claude-code/testing'

const ANSWER = 'Pronto: a linha fica acima da resposta.'
const NARRATION = 'Vou rodar os testes antes de responder.'
const TURN = {
  durationMs: 54_000,
  steps: 6,
  failures: 0,
  files: 0,
  items: ['r:msg_narracao-t0', 'u:toolu_1'],
  first: 'r:msg_narracao-t0',
  final: ANSWER,
  log: [{ kind: 'tool', tool: 'Bash', gist: 'npm test', failed: false }],
}

// O que o engine responderia: um turno terminado, densidade compacta, tipografia desligada.
function engine(on: any) {
  const state: Record<string, unknown> = { turns: { t1: TURN }, densidade: 'compacto', tipografia: false, open: [] }
  on('state.get', (_: unknown, e: any, next: any) => (e.key in state ? { value: { value: state[e.key], version: 1 } } : next(e)))
  on('store.get', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [] }))
  on('env.get', () => ({ value: undefined }))
  const drawn: string[] = []
  // Este hook está no lugar do app: desenha o texto que recebe.
  on('ui.render', ($: any, e: any) => {
    drawn.push(String(e.props.text))
    const { Text } = $.ui.resolve(e)
    return <Text>{'app: ' + String(e.props.text)}</Text>
  })
  return drawn
}

const message = (surface: 'desktop' | 'terminal', requestId: string, text: string) =>
  ({ plugin: 'skim-it', surface, component: 'AssistantMessage', requestId, props: { text, isFirstOfReply: true } }) as const

test('no Desktop, a linha do turno vai acima da resposta final', async ($, on) => {
  const drawn = engine(on)
  const ui = await $.ui.mount(message('desktop', 'msg_resposta-t0', ANSWER))
  const line = await ui.find({ type: 'Button' })
  expect(String(line?.props.label)).toMatch(/54s · 6/)
  expect(drawn).toEqual([ANSWER])
  await ui.unmount()
})

test('no Desktop, a narração do turno fica como o app desenha', async ($, on) => {
  const drawn = engine(on)
  const ui = await $.ui.mount(message('desktop', 'msg_narracao-t0', NARRATION))
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  expect(drawn).toEqual([NARRATION])
  await ui.unmount()
})

test('no terminal, a narração vira a linha do turno', async ($, on) => {
  const drawn = engine(on)
  const ui = await $.ui.mount(message('terminal', 'msg_narracao-t0', NARRATION))
  expect(String((await ui.find({ type: 'Button' }))?.props.label)).toMatch(/54s · 6/)
  expect(drawn).toEqual([])
  await ui.unmount()
})
