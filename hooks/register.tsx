// skim-it: look global (paleta e o fundo fosco ligado ao estado da sessão) e tipografia da resposta.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

// Sem extensão, como o session-hue (que carrega assim); os scripts de checagem importam com .ts.
import { memo } from './cache'
import { SCENE_ID } from './look'
import { applyLook, loadLang, lookNoteText, lookState, registerCommand, runImportar, setFundoSegue, setIdioma, setLook, setTipografia, alternarPainel, setDensidade } from './ajustes'
import { openCard, registerCard } from './card'
import { cnt, getLang, parseCommand, tr, unknownText } from './i18n'
import { ambientScene } from './ambient'
import type { SceneState } from './ambient'
import type { PeerFile } from './fleetcore'
import { registerWork, loadDensity, editedNow, workStep, workToolDone, workTurnComplete, workTurnStart } from './work'
import { registerBand } from './band'
import { fleetCommits, fleetDone, fleetPrompt, fleetResume, fleetStop, fleetWaiting, fleetWorking, retopic, retopicFromSession, startFleet, touch } from './fleet'
import { GIT_EVERY_MS, loadGit } from './gitlive'
import { loadProject } from './projeto'
import { endsAsking } from './retorno'
import { voltaPrompt, voltaStart, voltaTurnComplete, voltaTurnStart } from './volta'
import { SECTIONS_PROMPT } from './tipografia'
import type { Links } from '../types'

// O engine só aceita read e update de um atom declarado neste arquivo: a mesma referência (plugin e key
// literais, mesmo valor inicial) do arquivo dono, declarada de novo aqui.
const assunto = atom({ plugin: 'skim-it', key: 'assunto' } as const, '')
const links = atom({ plugin: 'skim-it', key: 'links' } as const, { ok: false, titles: {}, links: {}, old: [] } as Links)
const peers = atom({ plugin: 'skim-it', key: 'peers' } as const, [] as PeerFile[])
const tipografia = atom({ plugin: 'skim-it', key: 'tipografia' } as const, false)
const turnoVivo = atom({ plugin: 'skim-it', key: 'turnoVivo' } as const, false)

// Estado da sessão que o fundo desenha: repouso, trabalhando (turno rodando) ou esperando você
// (pergunta aberta ou pedido de permissão aberto há mais de alguns segundos, o critério do
// session-hue). Cada janela mostra uma sessão, e o hook de Backdrop desta sessão desenha o dela.
let sceneState: SceneState = 'idle'
let askPendingAt = 0
let askTool = ''
let isGitTicking = false
const ASK_GRACE_MS = 4000
const sceneCache = new Map<string, string>()

function setScene($: EngineInterface, next: SceneState) {
  if (sceneState === next) return
  sceneState = next
  // O fundo já desenhado só muda com um redesenho.
  $.ui.invalidate('ui.render')
}

function sceneFor(state: SceneState): string {
  const key = state + '|' + Math.round(lookState.hue)
  return memo(sceneCache, key, () => ambientScene({ hue: lookState.hue, state }), 40)
}

// Um pedido de permissão aberto foi resolvido (aprovado, ou negado: negado nunca dispara tool.call).
function resumeAsk($: EngineInterface) {
  if (askPendingAt === 0) return
  askPendingAt = 0
  setScene($, 'working')
  fleetResume($)
}

export const register: Register = on => {
  // Um só caminho para AssistantMessage: a linha de trabalho decide e, se não é dela, desenha a tipografia.
  registerWork(on)
  registerBand(on)
  registerCard(on)

  // O recarregamento a quente roda register e session.start de novo: o que precisa existir
  // (comando, frota, relógios) nasce aqui, idempotente.
  on('session.start', async ($, e, next) => {
    await loadLang($)
    await registerCommand($)
    const saved = (await $.store.get('tipografia')) === true
    await update($, tipografia, () => saved)
    await loadDensity($)
    // A primeira versão fixava "look não desenhado" no rodapé; o status fica até alguém limpar.
    $.ui.status(undefined)
    await loadProject($)
    await voltaStart($)
    await applyLook($)
    await startFleet($)
    if (!isGitTicking) {
      isGitTicking = true
      void loadGit($)
      $.clock.every(GIT_EVERY_MS, () => void loadGit($))
    }
    // Ao carregar ou recarregar, as respostas já na tela passam pela tipografia salva.
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // Como o plugin oficial theme-examples: o look vai de novo a cada mensagem, para a janela que
  // só pega o tema durante um turno. O trabalho do look corre ao lado da mensagem, sem segurá-la.
  on('prompt.submit', async ($, e, next) => {
    const kind = e.origin?.kind
    const isOwner = kind === 'composer' || kind === 'bridge'
    // O look segue quem digitou por último: notificação de tarefa e despertador não o roubam.
    if (!kind || isOwner) void loadProject($).then(() => applyLook($)).catch(() => undefined)
    try {
      await voltaPrompt($, e)
      // Só um pedido seu limpa "pronta para revisar" e "terminou perguntando"; notificação e despertador não.
      if (isOwner) fleetPrompt($)
      const text = (e.text ?? '').trim()
      // Primeiro pedido: assunto provisório pelo Haiku, sem esperar.
      if (isOwner && text && !text.startsWith('/') && !(await read($, assunto))) void retopic($, text)
    } catch {
      // a frota nunca atrapalha o prompt
    }
    // Tipografia ligada no Desktop: uma nota ao lado do pedido, que só o modelo lê, pede a resposta em
    // seções ##. O prompt de sistema não serve: o sec-default passa o prompt.compose por cima dos mods
    // (visto em 2026-11-15). Comando não leva nota.
    const isStructured = !e.command && (await read($, tipografia)) === true && (await $.session.surfaces().catch((): readonly string[] => [])).includes('desktop')
    return next(isStructured ? { ...e, context: [...(e.context ?? []), SECTIONS_PROMPT] } : e)
  })

  // A cena do fundo: só o Desktop tem espaço atrás da conversa.
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    // Desktops anteriores mandam o nome em `id`, os novos em `scene`.
    const props = e.props as { scene?: unknown; id?: unknown; plugin: string }
    const name = typeof props.scene === 'string' ? props.scene : typeof props.id === 'string' ? props.id : undefined
    if (props.plugin !== 'skim-it' || name !== SCENE_ID || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    const { Svg } = $.ui.resolve(e)
    const alt = tr(getLang(), ('alt.' + sceneState) as 'alt.idle')
    return <Svg isInteractive alt={alt} source={sceneFor(sceneState)} />
  })

  // Turno da conversa principal: trabalhando enquanto roda, repouso no fim. O atom `turnoVivo` é ligado
  // e desligado pelo work.tsx (turn.start e turn.complete).
  on('turn.start', async ($, e, next) => {
    await workTurnStart($, e)
    if (e.agentId === undefined) {
      voltaTurnStart(e)
      setScene($, 'working')
      fleetWorking($)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await workTurnComplete($, e)
    if (e.agentId === undefined) {
      askPendingAt = 0
      setScene($, 'idle')
      try {
        const answered = e.reason === 'answer'
        fleetDone($, editedNow(), answered, answered && endsAsking(String(e.answer ?? '')))
        void fleetCommits($, answered)
        void voltaTurnComplete($, e)
        void loadGit($)
        if (answered) void retopicFromSession($)
      } catch {
        // a frota nunca atrapalha o fim do turno
      }
    }
    return next(e)
  })

  // Um passo novo da conversa principal: se um pedido de permissão ainda estava aberto, ele foi negado
  // (negar não dispara tool.call), e o modelo já segue.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) resumeAsk($)
    const r = yield* next(e)
    workStep(r)
    return r
  })

  // Pedido de permissão: só conta como espera se continuar aberto depois de alguns segundos (no
  // modo automático quem decide é o classificador, sem você).
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (e.agentId !== undefined) return verdict
    if ((verdict as { decision?: string } | undefined)?.decision === 'ask') {
      const at = (askPendingAt = await $.clock.now())
      askTool = String(e.tool ?? 'ferramenta')
      $.clock.after(ASK_GRACE_MS, () => {
        if (askPendingAt !== at) return
        // Só espera se o turno ainda roda (turn.complete já zerou o pedido, mas a tela não mente).
        void read($, turnoVivo).then((running) => {
          if (askPendingAt !== at || running !== true) return
          setScene($, 'waiting')
          fleetWaiting($, ('aprovar ' + askTool) as `aprovar ${string}`)
        })
      })
    } else if (askPendingAt !== 0 && (await $.clock.now()) - askPendingAt > ASK_GRACE_MS) {
      // Outra checagem sem pedido, bem depois do aberto: aquele foi resolvido (negado, por exemplo).
      resumeAsk($)
    }
    return verdict
  })

  // A ferramenta começou a rodar: um pedido de permissão aberto foi respondido. A pergunta de
  // múltipla escolha espera você até a resposta voltar.
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    touch()
    resumeAsk($)
    const asking = e.tool === 'AskUserQuestion'
    if (asking) {
      setScene($, 'waiting')
      fleetWaiting($, 'responder pergunta')
    }
    try {
      const res = await next(e)
      workToolDone(e, res)
      return res
    } finally {
      // Só volta a "trabalhando" se o turno ainda roda: depois de um turno interrompido não há o que retomar.
      if (asking && (await read($, turnoVivo))) {
        setScene($, 'working')
        fleetResume($)
      }
    }
  })

  // Fim do turno clássico: o que continua em segundo plano (agentes, comandos, despertadores).
  on('classic.Stop', async ($, e, next) => {
    try {
      fleetStop($, e)
    } catch {
      // idem
    }
    return next(e)
  })

  // Desenho vindo do Desktop com o look ainda não pintado: o Desktop está conectado, tenta de novo.
  on('ui.render', async ($, e, next) => {
    if (e.surface === 'desktop' && !lookState.painted && !lookState.retrying) {
      lookState.retrying = true
      await applyLook($)
    }
    return next(e)
  })

  // No início da sessão o Desktop pode ainda não estar conectado; ao conectar, o look vai de novo
  // (e a frota, se o session.start não chegou a levantá-la).
  on('session.attach', async ($, e, next) => {
    const joined = await next(e)
    await applyLook($)
    await startFleet($)
    return joined
  })

  // `/skim-it:ajustes` vem de commands/ajustes.md: um comando em arquivo aparece na lista já na tela de
  // sessão nova, antes de a sessão registrar o `/skim-it` (visto em 2026-11-17). O mod o responde abrindo
  // o cartão; o texto do arquivo só chega ao modelo se o mod não carregou.
  on('command.run', { command: 'skim-it:ajustes' }, async $ => {
    await openCard($)
    return { text: tr(getLang(), 'cmd.card') }
  }).catch(($, e, next) => next(e)) // falhou: o comando roda e o texto do arquivo avisa o modelo

  // Os argumentos são lidos em i18n.ts (pt e en); o que cada um faz mora em ajustes.ts, que o cartão
  // de ajustes chama também. Palavra que não conheço abre o cartão e diz a mais perto.
  on('command.run', { command: 'skim-it' }, async ($, e) => {
    const lang = getLang()
    const c = parseCommand(e.args ?? '', lang)
    switch (c.cmd) {
      case 'tipografia':
        return { text: await setTipografia($, c.on) }
      case 'densidade':
        return { text: await setDensidade($, c.value) }
      case 'painel':
        return { text: await alternarPainel($) }
      case 'look':
        return { text: await setLook($, c.on) }
      case 'fundo':
        return { text: await setFundoSegue($, c.on) }
      case 'importar':
        return { text: await runImportar($, c.mode) }
      case 'idioma':
        return { text: await setIdioma($, c.value) }
      case 'demo': {
        // Frota de exemplo na band, para ver e gravar o desenho completo (fica no store: sobrevive à recarga).
        const isOn = (await $.store.get('demo')) !== true
        await $.store.set('demo', isOn)
        $.ui.invalidate('ui.render')
        return { text: tr(lang, isOn ? 'cmd.demoOn' : 'cmd.demoOff') }
      }
      case 'ajustes':
        await openCard($)
        return { text: tr(lang, 'cmd.card') }
      case 'desconhecido':
        await openCard($)
        return { text: unknownText(lang, c) }
      default: {
        const isOn = await read($, tipografia)
        const fleet = ((await read($, peers)) as PeerFile[]).length
        const desk = (await read($, links)).ok ? tr(lang, 'help.deskOk') : tr(lang, 'help.deskDown')
        const now = tr(lang, 'help.now', { tip: tr(lang, isOn ? 'help.on' : 'help.off'), look: lookNoteText(), scene: tr(lang, ('scene.' + sceneState) as 'scene.idle'), fleet: cnt(lang, fleet, 'help.fleet'), desk })
        return { text: tr(lang, 'help') + '\n\n' + now }
      }
    }
  })
}
