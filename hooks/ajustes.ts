// Ajustes do skim-it (v0.5): o que o comando /skim-it e o cartão de ajustes (card.tsx) fazem, num lugar
// só, e o idioma do mod. O register.tsx lê os comandos; o cartão chama as mesmas funções.
import { atom, read, update } from 'claude-code'

import { togglePanel } from './fleet'
import { LANG_NAME, getLang, resolveLang, setLang, tr } from './i18n'
import type { Lang } from './i18n'
import { aprovar, importar } from './importar'
import { LOOK, SCENE_HUE, UNPAINTED, lookArgs } from './look'
import type { ProjectState } from './project'
import { configProblem, loadProject, lookFor } from './projeto'
import { setDensity } from './work'
import type { Density } from './worklog'

// O engine só aceita read e update de um atom declarado neste arquivo: a mesma referência (plugin e key
// literais, mesmo valor inicial) do arquivo dono, declarada de novo aqui.
const projeto = atom({ plugin: 'skim-it', key: 'projeto' } as const, { root: '', hue: SCENE_HUE, tipo: 'projeto', hasConfig: false } as ProjectState)
const tipografia = atom({ plugin: 'skim-it', key: 'tipografia' } as const, false)

// O que a última aplicação do look disse, para o /skim-it ajuda mostrar. Terminal e editores não
// desenham look, então nada fica preso na linha de status. O look só conta como pintado quando o engine
// diz isDrawn; até lá, o primeiro desenho vindo do Desktop tenta de novo, uma vez por carga do módulo.
// hue: matiz do fundo desta sessão (o do projeto com "fundo segue" ligado, senão o base).
export const lookState = { note: '', painted: false, retrying: false, unpaintedShown: false, hue: SCENE_HUE }
export const lookNoteText = (): string => lookState.note || tr(getLang(), 'look.unset')

export async function applyLook($: any): Promise<string> {
  const lang = getLang()
  if ((await $.store.get('look')) === false) return (lookState.note = tr(lang, 'look.off'))
  let args = LOOK
  let kind = tr(lang, 'look.base')
  lookState.hue = SCENE_HUE
  const state = (await read($, projeto)) as ProjectState
  if ((await $.store.get('fundoSegue')) !== false && state.root) {
    const made = lookFor(state)
    const bad = made.problems.find(line => line.startsWith("Desktop won't paint"))
    if (bad) kind = tr(lang, 'look.baseBad', { why: bad.slice(0, 100) })
    else {
      args = lookArgs(made.theme)
      lookState.hue = state.hue
      kind = tr(lang, 'look.project', { hue: Math.round(state.hue), extra: (state.intensidade ? ', ' + state.intensidade : '') + (state.hasConfig ? ', skim-it.json' : '') })
    }
  }
  if (args === LOOK && UNPAINTED && !lookState.unpaintedShown) {
    lookState.unpaintedShown = true
    $.ui.toast(UNPAINTED)
  }
  let set
  try {
    set = await $.theme.set(args)
  } catch (error) {
    // Um engine que recuse o formato não pode derrubar o início da sessão nem a mensagem.
    return (lookState.note = tr(lang, 'look.refused', { err: String(error) }))
  }
  lookState.painted = set.isDrawn
  const surf = (await $.session.surfaces()).join(',') || tr(lang, 'look.none')
  lookState.note = set.isDrawn
    ? tr(lang, 'look.applied', { kind, surf })
    : tr(lang, 'look.notDrawn', { kind, kept: set.requestId ? tr(lang, 'look.kept') : '', reason: set.reason, surf })
  if (configProblem()) lookState.note += '; ' + configProblem()
  return lookState.note
}

// ---- idioma ----

/** O idioma pelas regras de resolveLang, com o `language` do Claude Code e o locale lidos agora. */
async function resolveFor($: any, override: string | undefined): Promise<Lang> {
  let setting: unknown
  try {
    setting = await $.settings.read({ key: 'language' })
  } catch {
    // sem settings: segue para o locale
  }
  let locale: string | undefined
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    // Intl pode faltar
  }
  return resolveLang(override, typeof setting === 'string' ? setting : undefined, locale)
}

/** O que o usuário escolheu: 'auto' (padrão), 'pt' ou 'en'. */
export async function storedLang($: any): Promise<'auto' | 'pt' | 'en'> {
  const v = await $.store.get('idioma')
  return v === 'pt' || v === 'en' ? v : 'auto'
}

/** O idioma que valeria no automático, para o cartão dizer "Automático (Português)". */
export function autoLang($: any): Promise<Lang> {
  return resolveFor($, undefined)
}

/** Lê a escolha guardada e o idioma do Claude Code e fixa o idioma do mod. */
export async function loadLang($: any): Promise<Lang> {
  const choice = await storedLang($)
  const lang = await resolveFor($, choice === 'auto' ? undefined : choice)
  setLang(lang)
  return lang
}

/** O comando com a descrição no idioma atual; idempotente. */
export async function registerCommand($: any) {
  await $.command.register({ name: 'skim-it', description: tr(getLang(), 'cmd.description'), immediate: true })
}

export async function setIdioma($: any, value: 'auto' | 'pt' | 'en'): Promise<string> {
  await $.store.set('idioma', value)
  const lang = await loadLang($)
  await registerCommand($).catch(() => undefined)
  $.ui.invalidate('ui.render')
  return tr(lang, value === 'auto' ? 'cmd.langAuto' : 'cmd.lang', { name: LANG_NAME[lang] })
}

// ---- ajustes: cada um devolve o texto que o comando responde ----

export async function setTipografia($: any, isOn: boolean): Promise<string> {
  await $.store.set('tipografia', isOn)
  await update($, tipografia, () => isOn)
  // Respostas já desenhadas só mudam com um redesenho. Outras janelas leem ao reabrir.
  $.ui.invalidate('ui.render')
  return tr(getLang(), isOn ? 'cmd.tipOn' : 'cmd.tipOff')
}

export async function setDensidade($: any, d: Density): Promise<string> {
  await setDensity($, d)
  return tr(getLang(), 'cmd.dens', { v: tr(getLang(), ('d.' + d) as 'd.compacto') })
}

export async function alternarPainel($: any): Promise<string> {
  await togglePanel($)
  return tr(getLang(), 'cmd.panel')
}

export async function setLook($: any, isOn: boolean): Promise<string> {
  await $.store.set('look', isOn)
  if (isOn) return applyLook($)
  await $.theme.clear()
  lookState.note = tr(getLang(), 'look.off')
  return tr(getLang(), 'cmd.lookOff')
}

export async function setFundoSegue($: any, isOn: boolean): Promise<string> {
  await $.store.set('fundoSegue', isOn)
  return tr(getLang(), isOn ? 'cmd.fundoOn' : 'cmd.fundoOff', { look: await applyLook($) })
}

/** propor = importar; aprovar = importar aprovar; aprovar! = importar aprovar! */
export async function runImportar($: any, mode: 'propor' | 'aprovar' | 'aprovar!'): Promise<string> {
  const lang = getLang()
  try {
    const root = ((await read($, projeto)) as ProjectState).root
    if (!root) return tr(lang, 'cmd.noProject')
    if (mode === 'propor') return await importar($, root)
    const done = await aprovar($, root, mode === 'aprovar!')
    if (!done.ok) return done.text
    await loadProject($)
    return done.text + ' ' + (await applyLook($))
  } catch (error) {
    return tr(lang, 'cmd.importFail', { err: String(error) })
  }
}
