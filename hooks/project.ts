// Lógica pura da cor por projeto (v0.4): configuração, matiz, áreas e tom por sessão. Sem fs, sem `$`.
import { oklchFit } from './color'
import type { Intensidade, ProjectState } from '../types'
import { tr } from './i18n'
import type { Lang } from './i18n'
export type { Intensidade, ProjectState } from '../types'

export type ProjectConfig = {
  tipo: 'projeto' | 'espaço'
  marca?: { primaria: string; secundaria?: string; neutra?: string }
  areas?: { caminho: string; intensidade: Intensidade }[]
}

const HEX = /^#[0-9a-fA-F]{6}$/
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Valida `.claude/skim-it.json` com rigor; nunca lança. Com qualquer erro, config é null. */
export function parseConfig(json: string, lang: Lang = 'pt'): { config: ProjectConfig | null; errors: string[] } {
  const errors: string[] = []
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (e) {
    return { config: null, errors: [tr(lang, 'cfg.badJson', { msg: (e as Error).message })] }
  }
  if (!isObj(raw)) return { config: null, errors: [tr(lang, 'cfg.root')] }
  for (const k of Object.keys(raw)) if (!['tipo', 'marca', 'areas'].includes(k)) errors.push(tr(lang, 'cfg.unknownKey', { k }))
  if (raw.tipo !== 'projeto' && raw.tipo !== 'espaço') errors.push(tr(lang, 'cfg.tipo'))
  let marca: ProjectConfig['marca']
  if (raw.marca !== undefined) {
    if (!isObj(raw.marca)) errors.push(tr(lang, 'cfg.marcaObj'))
    else {
      for (const k of Object.keys(raw.marca)) if (!['primaria', 'secundaria', 'neutra'].includes(k)) errors.push(tr(lang, 'cfg.marcaKey', { k }))
      for (const k of ['primaria', 'secundaria', 'neutra']) {
        const v = raw.marca[k]
        if (v !== undefined && !(typeof v === 'string' && HEX.test(v))) errors.push(tr(lang, 'cfg.marcaHex', { k }))
      }
      if (raw.marca.primaria === undefined) errors.push(tr(lang, 'cfg.marcaReq'))
      else marca = raw.marca as ProjectConfig['marca']
    }
  }
  let areas: ProjectConfig['areas']
  if (raw.areas !== undefined) {
    if (!Array.isArray(raw.areas)) errors.push(tr(lang, 'cfg.areasList'))
    else {
      areas = []
      raw.areas.forEach((a, i) => {
        if (!isObj(a)) return void errors.push(tr(lang, 'cfg.areaObj', { i }))
        for (const k of Object.keys(a)) if (k !== 'caminho' && k !== 'intensidade') errors.push(tr(lang, 'cfg.areaKey', { i, k }))
        if (typeof a.caminho !== 'string' || !a.caminho) errors.push(tr(lang, 'cfg.areaPath', { i }))
        else if (a.intensidade !== 'vibrante' && a.intensidade !== 'denso') errors.push(tr(lang, 'cfg.areaInt', { i }))
        else areas!.push({ caminho: a.caminho, intensidade: a.intensidade })
      })
    }
  }
  if (errors.length) return { config: null, errors }
  const config: ProjectConfig = { tipo: raw.tipo as ProjectConfig['tipo'] }
  if (marca) config.marca = marca
  if (areas) config.areas = areas
  return { config, errors }
}

/** Inverso de color.ts: hex sRGB para OKLCH (H em graus, 0 a 360). */
export function hexToOklch(hex: string): { L: number; C: number; H: number } {
  const [r, g, b] = [1, 3, 5].map(i => {
    const x = parseInt(hex.slice(i, i + 2), 16) / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(A, B), H: (((Math.atan2(B, A) * 180) / Math.PI) % 360 + 360) % 360 }
}

/**
 * Matizes de reserva, de 20 em 20 graus, de ciano a rosa-magenta: dos azuis aos roxos o par
 * azul-laranja continua legível para daltônicos, e fica 35 graus ou mais longe de vermelho (~29),
 * âmbar (~85) e verde (~142), que são só de erro, aviso e sucesso.
 */
export const FALLBACK_HUES = [190, 210, 230, 250, 270, 290, 310, 330, 350] as const

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Matiz do projeto: marca do arquivo, senão hash estável da raiz. */
export function projectHue(config: ProjectConfig | null | undefined, fallbackKey: string): number {
  if (config?.marca?.primaria) return hexToOklch(config.marca.primaria).H
  return FALLBACK_HUES[hash(fallbackKey) % FALLBACK_HUES.length] as number
}

function globToRegex(glob: string): RegExp {
  let g = glob.replace(/\\/g, '/').replace(/^\.\//, '')
  if (g.endsWith('/')) g += '**'
  let re = ''
  for (let i = 0; i < g.length; i++) {
    const c = g[i] as string
    if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') (re += '(?:.*/)?'), (i += 2)
      else (re += '.*'), i++
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + re + '$')
}

/** Primeira área cujo glob casa com o caminho relativo à raiz do projeto. */
export function areaFor(config: ProjectConfig | null | undefined, relativePath: string) {
  const p = relativePath.replace(/\\/g, '/').replace(/^\.\//, '')
  return config?.areas?.find(a => globToRegex(a.caminho).test(p))
}

/**
 * Tons de luminosidade (OKLCH) das sessões de um projeto: até 4, separados por mais de 12 pontos;
 * passando de 4 repetem (o rótulo distingue). Combine com o matiz do projeto via oklchFit.
 */
export function sessionTone(index: number, total: number): { L: number; C: number } {
  const n = Math.max(1, Math.min(4, total))
  const i = ((index % n) + n) % n
  return { L: n === 1 ? 0.7 : 0.5 + (0.38 * i) / (n - 1), C: 0.14 }
}

export const sessionToneHex = (hue: number, index: number, total: number) => {
  const t = sessionTone(index, total)
  return oklchFit(t.L, t.C, hue)
}


/** Caminho relativo à raiz (barras normais); '' na própria raiz; null fora dela. Unidade do Windows sem diferenciar maiúsculas. */
export function relPath(root: string, p: string): string | null {
  const cut = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '')
  const r = cut(root)
  const q = cut(p)
  const win = /^[a-z]:/i.test(r)
  const [a, b] = win ? [r.toLowerCase(), q.toLowerCase()] : [r, q]
  if (a === b) return ''
  return b.startsWith(a + '/') ? q.slice(r.length + 1) : null
}
