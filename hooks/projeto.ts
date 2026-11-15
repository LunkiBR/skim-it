// Cor por projeto (v0.4), parte de execução: acha a raiz, lê `.claude/skim-it.json` e guarda matiz,
// acento, intensidade e tipo da sessão. A lógica pura está em project.ts e lookgen.ts.
import { atom, update } from 'claude-code'

import { memo } from './cache'
import { rootOf } from './fleet'
import { isScratch } from './fleetcore'
import { projectLook } from './lookgen'
import { getLang, tr } from './i18n'
import { SCENE_HUE } from './look'
import { areaFor, parseConfig, projectHue, relPath } from './project'
import type { ProjectConfig, ProjectState } from './project'

// O engine lê as referências dos atoms no código-fonte: plugin e key têm de ser literais.
export const projeto = atom({ plugin: 'skim-it', key: 'projeto' } as const, { root: '', hue: SCENE_HUE, tipo: 'projeto', hasConfig: false } as ProjectState)

let rootCache = { cwd: '', root: '' }
let configNote = ''
/** Por que o skim-it.json não valeu, ou vazio. */
export const configProblem = () => configNote

export async function loadProject($: any) {
  try {
    const cwd = String(await $.session.cwd())
    if (rootCache.cwd !== cwd) rootCache = { cwd, root: await rootOf($, cwd) }
    const root = rootCache.root
    let config: ProjectConfig | null = null
    configNote = ''
    try {
      const r = parseConfig(String(await $.fs.read(root + '/.claude/skim-it.json')), getLang())
      config = r.config
      if (!config) configNote = tr(getLang(), 'cfg.invalid', { err: String(r.errors[0]) })
    } catch {
      // sem arquivo é normal
    }
    // Chat avulso fica neutro.
    const neutral = isScratch(cwd) && !config
    const area = areaFor(config, relPath(root, cwd) ?? '')
    const state: ProjectState = {
      root,
      hue: neutral ? SCENE_HUE : projectHue(config, root),
      tipo: config?.tipo ?? 'projeto',
      hasConfig: config !== null,
    }
    if (config?.marca?.primaria) state.accent = config.marca.primaria
    if (area) state.intensidade = area.intensidade
    await update($, projeto, () => state)
  } catch {
    // a cor do projeto nunca atrapalha a sessão
  }
}

const cache = new Map<string, ReturnType<typeof projectLook>>()
/** Look do projeto, guardado por matiz, intensidade e acento. */
export function lookFor(s: ProjectState) {
  const key = [s.hue, s.intensidade, s.accent].join('|')
  return memo(cache, key, () => projectLook(s.hue, { intensidade: s.intensidade, accentHex: s.accent }), 20)
}
