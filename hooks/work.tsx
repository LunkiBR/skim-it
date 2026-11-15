// Linha de trabalho (v0.2): o trabalho de um turno terminado (narração entre ferramentas, inclusive o
// resumo que o Desktop mostra no lugar dela, e as ferramentas) recolhe numa linha
// "▸ Trabalhou 7m 57s · 54 passos · 3 arquivos · 1 falha"; aberta, mostra uma lista desenhada pelo
// mod (as linhas nativas ficam escondidas, porque o Desktop as guarda num "Executou N comandos"
// recolhido). Ao vivo, o spinner ganha tempo e passo. Densidade: compacto (padrão), equilibrado
// (narração apagada à vista e cada grupo de ferramentas numa linha), detalhado (como o app desenha).
// O Desktop não diz a que turno uma linha pertence: a ligação é pelo id da mensagem e pelo
// tool_use_id enquanto o turno roda, e pelo texto de cada passo. Em dúvida, mostra.
import { atom, read, update } from 'claude-code'

import { addBounded } from './cache'
import { DENSITIES, editedFile, failureText, finish, gist, groupCounts, isFirstKey, keepLast, newLive, norm, owner, summaryText, duration, textKey } from './worklog'
import type { Density, DoneTurn, Live } from './worklog'
import { touch } from './fleet'
import { cnt, getLang, tr } from './i18n'
import { toneHex } from './tom'
import { typography } from './tipografia'
import { away } from './volta'

// O engine só aceita read e update de um atom declarado neste arquivo: a mesma referência (plugin e key
// literais, mesmo valor inicial) do arquivo dono, declarada de novo aqui.
const turnoVivo = atom({ plugin: 'skim-it', key: 'turnoVivo' } as const, false)

// O engine lê as referências dos atoms no código-fonte: plugin e key têm de ser literais.
const turns = atom({ plugin: 'skim-it', key: 'turns' } as const, {})
const open = atom({ plugin: 'skim-it', key: 'open' } as const, [])
const density = atom({ plugin: 'skim-it', key: 'densidade' } as const, 'compacto')

const BUTTON = 'skim-turno-'

let live: Live | null = null
let lastFiles = 0 // arquivos editados no último turno terminado
const rendered = new Set<string>() // ids de blocos já desenhados; com teto
let ticker: { cancel(): void } | null = null
const RENDERED_MAX = 300
// Chamadas que o app junta numa linha de contagem (ToolGroup): quem recolhe é o grupo inteiro. Escondida
// sozinha dentro do grupo aberto no Desktop, cada chamada virava uma linha vazia com borda (visto em 2026-11-15).
const grouped = new Set<string>()
const GROUPED_MAX = 600

/** Desenho de quem chamou quando a linha não é de um turno recolhido (a tipografia, ou o app). */

/** Arquivos editados no turno em andamento ou, passado o fim dele, no último turno. */
export const editedNow = () => (live ? live.files.size : lastFiles)

export async function getDensity($: any): Promise<Density> {
  const d = (await read($, density)) as string
  return (DENSITIES as readonly string[]).includes(d) ? (d as Density) : 'compacto'
}

export async function setDensity($: any, d: Density) {
  await $.store.set('densidade', d)
  await update($, density, () => d)
  $.ui.invalidate('ui.render')
}

export async function loadDensity($: any): Promise<Density> {
  const saved = (await $.store.get('densidade')) as string | undefined
  const d = saved && (DENSITIES as readonly string[]).includes(saved) ? (saved as Density) : 'compacto'
  await update($, density, () => d)
  return d
}

function summaryRow($: any, e: any, id: string, t: DoneTurn, isOpen: boolean, dot?: string) {
  const { Box, Text, Button } = $.ui.resolve(e)
  // O clique é tratado no hook de ui.press, pela key: a função do botão some num redesenho.
  return (
    <Box flexDirection="row" alignItems="center" columnGap={1}>
      {dot ? <Text color={dot}>●</Text> : null}
      <Button key={BUTTON + id} plain dimColor label={(isOpen ? '▾ ' : '▸ ') + summaryText(t, getLang())} onPress={() => {}} />
      {t.failures > 0 ? <Text color="error">{'· ' + failureText(t.failures, getLang())}</Text> : null}
    </Box>
  )
}

/** A lista aberta: narração recuada e apagada, ferramentas numa linha monoespaçada; falha em vermelho. */
function openList($: any, e: any, t: DoneTurn) {
  const { Box, Text, Markdown } = $.ui.resolve(e)
  return (
    <Box flexDirection="column" paddingLeft={2} rowGap={0}>
      {t.log.map((entry, i) =>
        entry.kind === 'say' ? (
          <Box key={'s' + i} marginTop={i === 0 ? 0 : 'xs'}>
            <Markdown text={entry.text} dimColor />
          </Box>
        ) : (
          <Text key={'t' + i} dimColor={!entry.failed} color={entry.failed ? 'error' : undefined} mono wrap="truncate">
            {'› ' + entry.tool + (entry.gist ? '  ' + entry.gist : '') + (entry.failed ? '  · ' + tr(getLang(), 'work.failed') : '')}
          </Text>
        ),
      )}
    </Box>
  )
}

// Subagente que ainda roda fica à vista: sem o mod a linha do Agent mostra que ele trabalha, e recolhida
// essa pista sumia (visto em 2026-11-15). A lista do engine é consultada no máximo a cada 2 s.
const AGENT_TOOLS = new Set(['Agent', 'Task'])
let agentsAt = 0
let liveAgents = new Set<string>()

async function isRunningAgent($: any, e: any): Promise<boolean> {
  if (e.component !== 'ToolUse' || !AGENT_TOOLS.has(String(e.props.tool))) return false
  if (e.props.isRunning) return true
  const id = (e.props.output as { agentId?: unknown } | undefined)?.agentId
  if (typeof id !== 'string') return false
  const now = Date.now()
  if (now - agentsAt > 2000) {
    agentsAt = now
    const list = (await $.agent.list().catch(() => [])) as { id?: string; status?: string }[]
    liveAgents = new Set(list.filter(a => a.status === 'pending' || a.status === 'running' || a.status === 'waiting').map(a => String(a.id)))
  }
  return liveAgents.has(id)
}

/** Fim de turno de um subagente: a linha dele volta a recolher no próximo desenho. */
export function workAgentDone($: any) {
  agentsAt = 0
  $.ui.invalidate('ui.render')
}

/** Recolhe, esconde ou desenha a linha do turno no lugar do primeiro item dele. Texto que não é da linha passa pela tipografia. */
async function decide($: any, e: any, next: any, keys: string[], isGroup: boolean, isText: boolean) {
  const pass = () => (isText ? typography($, e, next) : next(e))
  const d = await getDensity($)
  if (d === 'detalhado') return pass()
  const agentLive = await isRunningAgent($, e)
  const all = (await read($, turns)) as Record<string, DoneTurn>
  let hit: [string, DoneTurn] | null = null
  for (const key of isGroup ? keys.slice(0, 1) : keys) {
    hit = owner(all, key)
    if (hit) break
  }
  if (!hit) return pass()
  const [id, t] = hit
  // Um grupo só recolhe se todas as chamadas são do mesmo turno.
  if (isGroup && !keys.every(k => t.items.includes(k))) return pass()
  const { Box, Text, Markdown } = $.ui.resolve(e)

  if (d === 'equilibrado') {
    // Narração à vista, apagada e recuada; cada grupo de ferramentas numa linha só.
    if (e.component === 'AssistantMessage') {
      return (
        <Box paddingLeft={2}>
          <Markdown text={String(e.props.text ?? '')} dimColor />
        </Box>
      )
    }
    if (e.component === 'ToolGroup') {
      const tools = (e.props.calls as { tool: string }[]).map(c => c.tool)
      const failed = (e.props.calls as { isErrored: boolean }[]).filter(c => c.isErrored).length
      return (
        <Text dimColor={failed === 0} color={failed > 0 ? 'error' : undefined} wrap="truncate">
          {'› ' + groupCounts(tools) + (failed > 0 ? ' · ' + failureText(failed, getLang()) : '')}
        </Text>
      )
    }
    if (e.component === 'ToolUse') {
      if (agentLive) return next(e)
      return (
        <Text dimColor={!e.props.isErrored} color={e.props.isErrored ? 'error' : undefined} wrap="truncate">
          {'› ' + e.props.tool + '  ' + gist(e.props.input)}
        </Text>
      )
    }
    return <Box />
  }

  // Compacto: só a linha do turno, no lugar do primeiro item; aberta, a lista do mod logo abaixo.
  const isOpen = ((await read($, open)) as string[]).includes(id)
  if (e.component !== 'ToolResult' && keys.some(k => isFirstKey(t, k))) {
    const dot = await toneHex($).catch(() => undefined)
    const row = summaryRow($, e, id, t, isOpen, dot)
    if (!isOpen && !agentLive) return row
    return (
      <Box flexDirection="column" rowGap={0}>
        {row}
        {isOpen ? [<Box key="lista">{openList($, e, t)}</Box>] : []}
        {agentLive ? [<Box key="agente">{await next(e)}</Box>] : []}
      </Box>
    )
  }
  return agentLive ? next(e) : <Box />
}

// O engine aceita um só hook sem matcher por evento: register.tsx e band.tsx guardam esses hooks e
// chamam as funções abaixo, que só registram o turno.

/** turn.start da conversa principal: abre o turno ao vivo e o relógio do spinner. */
export async function workTurnStart($: any, e: any) {
  if (e.agentId !== undefined) return
  live = newLive(e.turnId, await $.clock.now(), rendered)
  await update($, turnoVivo, () => true).catch(() => undefined)
  // O spinner mostra o tempo do turno: um redesenho por segundo enquanto ele roda. O relógio se
  // desliga sozinho quando o atom diz que não há turno (vale também para o de um módulo recarregado).
  ticker?.cancel()
  const mine: { cancel(): void } = (ticker = $.clock.every(1000, () => {
    void read($, turnoVivo).then(isLive => {
      if (isLive === true) $.ui.invalidate('ui.render')
      else mine.cancel()
    })
  }))
}

/** Resultado de um turn.step: conta o passo e guarda a narração. */
export function workStep(r: any) {
  touch() // um passo de turno também é sinal de vida
  if (!live || r?.turnId !== live.id) return
  live.steps += 1
  const raw = String(r?.answer ?? '')
  if (norm(raw)) {
    live.items.push(textKey(raw))
    live.log.push({ kind: 'say', text: raw.trim().slice(0, 600) })
  }
}

/** Ferramenta da conversa principal terminada: entra na lista, conta falha e arquivo editado. */
export function workToolDone(e: any, res: any) {
  const id = e.tool_use_id as string | undefined
  if (!live || e.agentId !== undefined || !id) return
  const failed = Boolean(res?.deny || res?.isError)
  live.items.push('u:' + id)
  live.log.push({ kind: 'tool', tool: String(e.tool), gist: gist(e.input), failed })
  if (failed) live.failures += 1
  const file = editedFile(String(e.tool), e.input)
  if (file && !failed) {
    live.files.add(file)
    if (away.on) away.files.add(file)
  }
}

/** turn.complete da conversa principal: fecha o turno, guarda o resumo e atualiza o rodapé. */
export async function workTurnComplete($: any, e: any) {
  if (e.agentId !== undefined) {
    workAgentDone($)
    return
  }
  // Todo fim de turno da conversa principal desliga o relógio e o turno ao vivo, casem os ids ou não.
  const finished = live
  live = null
  ticker?.cancel()
  ticker = null
  await update($, turnoVivo, () => false).catch(() => undefined)
  if (!finished || finished.id !== e.turnId) return
  lastFiles = finished.files.size
  // Turno interrompido ou com erro fica como o app desenha: falha nunca some.
  const turn = e.reason === 'answer' ? finish(finished, String(e.answer ?? ''), e.durationMs) : null
  if (turn) {
    await update($, turns, (all: Record<string, DoneTurn>) => keepLast(all, e.turnId, turn))
    // Rodapé como na referência visual: "última resposta 7m 57s · 54 passos".
    $.ui.status(tr(getLang(), 'work.last', { time: duration(e.durationMs), steps: cnt(getLang(), turn.steps, 'step') }))
  }
  // As linhas do turno já foram desenhadas antes do fim; sem isto elas não se redesenham.
  $.ui.invalidate('ui.render')
}

/** Clique na linha de trabalho: abre ou fecha a lista. true quando o clique era dela. */
export async function workPress($: any, e: any): Promise<boolean> {
  if (!String(e.element).startsWith(BUTTON)) return false
  const id = String(e.element).slice(BUTTON.length)
  await update($, open, (list: string[]) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]))
  $.ui.invalidate('ui.render')
  return true
}

export function registerWork(on: any) {
  // Ao vivo: o spinner diz há quanto tempo o turno roda e em que passo está.
  on('ui.render', { component: 'Spinner' }, async ($: any, e: any, next: any) => {
    if (!live) return next(e)
    const elapsed = duration((await $.clock.now()) - live.startedAt)
    const step = live.steps + 1
    const base = e.props.message ?? e.props.word
    return next({ ...e, props: { ...e.props, message: base + ' · ' + elapsed + ' · ' + tr(getLang(), 'work.spinner') + ' ' + step } })
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($: any, e: any, next: any) => {
    // Transcrição completa (ctrl+o, --verbose): o app desenha tudo.
    if (e.props?.isExpanded) return next(e)
    const text = norm(String(e.props?.text ?? ''))
    if (live && !live.before.has(e.requestId)) {
      // Um bloco antigo redesenhado agora (resposta de um turno terminado) não é deste turno.
      const all = (await read($, turns)) as Record<string, DoneTurn>
      if (!Object.values(all).some(t => t.final === text || t.items.includes('r:' + e.requestId))) {
        live.blocks[e.requestId] = text
        if (!live.order.includes('r:' + e.requestId)) live.order.push('r:' + e.requestId)
      }
    }
    addBounded(rendered, e.requestId, RENDERED_MAX)
    return decide($, e, next, ['r:' + e.requestId, textKey(text)], false, true)
  })

  on('ui.render', { component: 'ToolGroup' }, async ($: any, e: any, next: any) => {
    const keys = (e.props.calls as { tool_use_id?: string }[]).map(c => c.tool_use_id).filter((x): x is string => !!x).map(x => 'u:' + x)
    if (live) for (const k of keys) if (!live.order.includes(k)) live.order.push(k)
    for (const k of keys) addBounded(grouped, k, GROUPED_MAX)
    if (e.props.isExpanded || keys.length === 0) return next(e)
    return decide($, e, next, keys, true, false)
  })

  // Linha de um grupo (o grupo já decidiu: recolhido ele nem desenha as linhas; aberto, todas aparecem).
  on('ui.render', { component: 'ToolUse' }, async ($: any, e: any, next: any) => {
    const key = 'u:' + e.props.tool_use_id
    if (live && !live.order.includes(key)) live.order.push(key)
    if (e.props.isExpanded || grouped.has(key)) return next(e)
    return decide($, e, next, [key], false, false)
  })

  on('ui.render', { component: 'ToolResult' }, async ($: any, e: any, next: any) => {
    const key = 'u:' + e.props.tool_use_id
    if (e.props.isExpanded || grouped.has(key)) return next(e)
    return decide($, e, next, [key], false, false)
  })
}
