// O fundo não pisca: repouso só depois de 5 s sem turno e sem agente em segundo plano, e o amarelo do
// pedido de permissão só depois de 5 s aberto (o classificador do modo automático decide antes).
// Rodar: claude plugin test .
import { expect, mock, test } from 'claude-code/testing'

const ALT = { idle: /^Fundo fosco na cor/, working: /trabalhando$/, waiting: /espera você$/ }

function engine(on: any, agents: { id: string; status: string }[] = []) {
  on('store.get', () => ({ value: undefined }))
  on('agent.list', () => ({ value: agents }))
  on('env.get', () => ({ value: undefined }))
  on('turn.start', (_: unknown, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  return mock.clock(on, { now: 1_000_000 })
}

async function scene($: any) {
  const ui = await $.ui.mount({ plugin: 'skim-it', surface: 'desktop', component: 'Backdrop', requestId: 'fundo', props: { plugin: 'skim-it', scene: 'skim-it-fosco' } })
  const alt = String((await ui.find({ type: 'Svg' }))?.props.alt)
  await ui.unmount()
  return alt
}

const start = ($: any, turnId: string) => $.turn.start({ text: '', turnId })
const done = ($: any, turnId: string) => $.turn.complete({ answer: 'ok', durationMs: 1000, isAborted: false, turnId, reason: 'answer' })

test('o turno curto que a notificação abre logo depois não pisca o repouso', async ($, on) => {
  const clock = engine(on)
  await start($, 't1')
  expect(await scene($)).toMatch(ALT.working)
  await done($, 't1')
  await clock.advance(2000)
  expect(await scene($)).toMatch(ALT.working)
  await start($, 't2')
  await clock.advance(1000)
  await done($, 't2')
  await clock.advance(4000)
  expect(await scene($)).toMatch(ALT.working)
  await clock.advance(1500)
  expect(await scene($)).toMatch(ALT.idle)
})

test('com agente em segundo plano, o fim do turno não vira repouso', async ($, on) => {
  const agents = [{ id: 'a1', status: 'running' }]
  const clock = engine(on, agents)
  await start($, 't1')
  await done($, 't1')
  await clock.advance(20_000)
  expect(await scene($)).toMatch(ALT.working)
  // O agente termina e a notificação abre um turno; no fim dele já não há nada rodando.
  agents.length = 0
  await start($, 't2')
  await done($, 't2')
  await clock.advance(5500)
  expect(await scene($)).toMatch(ALT.idle)
})

test('o pedido de permissão só acende o amarelo depois de 5 s aberto', async ($, on) => {
  const clock = engine(on)
  on('tool.check', () => ({ decision: 'ask' }))
  await start($, 't1')
  await $.tool.check({ tool: 'Bash', input: { command: 'ls' } })
  await clock.advance(4500)
  expect(await scene($)).toMatch(ALT.working)
  await clock.advance(1000)
  expect(await scene($)).toMatch(ALT.waiting)
})
