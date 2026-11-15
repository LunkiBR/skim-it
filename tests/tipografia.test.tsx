// Tipografia no Desktop: o app desenha a resposta inteira uma vez, com ## virando # e a régua nativa
// antes de cada seção (um segundo desenho nativo some no Desktop). Rodar: claude plugin test .
import { expect, test } from 'claude-code/testing'

// O que o engine responderia: tipografia ligada, nada salvo no store, nenhum subagente.
function engine(on: any) {
  on('state.get', (_: unknown, e: any, next: any) => (e.key === 'tipografia' ? { value: { value: true, version: 1 } } : next(e)))
  on('store.get', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [] }))
}

const ANSWER = 'Resumo.\n\n## Primeira\n\nTexto um.\n\n## Segunda\n\n| a | b |\n|---|---|\n| 1 | 2 |'

test('um desenho nativo, com ## em # e régua antes de cada seção', async ($, on) => {
  engine(on)
  const drawn: string[] = []
  // Este hook está no lugar do app: desenha o texto que recebe.
  on('ui.render', ($, e) => {
    drawn.push(String((e.props as { text?: string }).text))
    const { Text } = $.ui.resolve(e)
    return <Text>{'app: ' + String((e.props as { text?: string }).text)}</Text>
  })

  const ui = await $.ui.mount({
    plugin: 'skim-it',
    surface: 'desktop',
    component: 'AssistantMessage',
    requestId: 'msg_teste',
    props: { text: ANSWER, isFirstOfReply: true },
  })

  expect(drawn).toEqual(['Resumo.\n\n---\n\n# Primeira\n\nTexto um.\n\n---\n\n# Segunda\n\n| a | b |\n|---|---|\n| 1 | 2 |'])
  expect((await ui.find({ type: 'Text', text: /# Segunda/ }))?.text).toMatch(/^app: Resumo/)
  await ui.unmount()
})

// Um pedido digitado pela pessoa, como o engine o levanta.
const TYPED = { wait: false, origin: { kind: 'composer' } } as const

// Um pedido que entra: este hook está no lugar do engine e devolve a nota que chegou até ele.
function submitted(on: any, surfaces: string[]) {
  on('session.surfaces', () => ({ value: surfaces }))
  on('prompt.submit', (_: unknown, e: any) => ({ text: e.text, context: e.context }))
}

test('com a tipografia ligada no Desktop, o pedido leva a nota de seções', async ($, on) => {
  engine(on)
  submitted(on, ['desktop'])
  const entered = await $.prompt.submit({ ...TYPED, text: 'explique o painel' })
  expect(entered.drop).toBeUndefined()
  expect(entered.context?.some(c => /`##` heading/.test(c))).toBe(true)
})

test('fora do Desktop, o pedido vai sem nota', async ($, on) => {
  engine(on)
  submitted(on, ['terminal'])
  const terminal = await $.prompt.submit({ ...TYPED, text: 'explique o painel' })
  expect(terminal.context ?? []).toEqual([])
})

test('com a tipografia desligada, o pedido vai sem nota', async ($, on) => {
  on('state.get', (_: unknown, e: any, next: any) => (e.key === 'tipografia' ? { value: { value: false, version: 1 } } : next(e)))
  on('store.get', () => ({ value: undefined }))
  submitted(on, ['desktop'])
  const off = await $.prompt.submit({ ...TYPED, text: 'explique o painel' })
  expect(off.context ?? []).toEqual([])
})

test('sem título, o app desenha a resposta inteira', async ($, on) => {
  engine(on)
  const drawn: string[] = []
  on('ui.render', ($, e) => {
    drawn.push(String((e.props as { text?: string }).text))
    const { Text } = $.ui.resolve(e)
    return <Text>app</Text>
  })

  const ui = await $.ui.mount({
    plugin: 'skim-it',
    surface: 'desktop',
    component: 'AssistantMessage',
    requestId: 'msg_sem_titulo',
    props: { text: '**Resumo.**\n\n- um\n- dois', isFirstOfReply: true },
  })

  expect(drawn).toEqual(['**Resumo.**\n\n- um\n- dois'])
  await ui.unmount()
})
