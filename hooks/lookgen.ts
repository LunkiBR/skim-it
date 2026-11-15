// Look gerado do matiz do projeto (v0.4; neutros do sistema v4 desde 2026-11-15): superfícies e texto são os
// neutros de hooks/v4.ts em todos os projetos, só o acento e os estados seguem o matiz e mantêm o sentido.
// Mesma forma do look base (hooks/look.ts).
import { oklchFit } from './color'
import { hexToOklch } from './project'
import { makeColors } from './make-colors.js'
import { contrast, neutralAccent, themeAnchors } from './v4'

export { contrast }

export type LookOpts = { intensidade?: 'vibrante' | 'denso'; accentHex?: string }

const mod = (h: number) => ((h % 360) + 360) % 360
const diff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180

/** Afasta o matiz do estado (vermelho, verde, âmbar) do acento em até 22 graus; o sentido não muda. */
function status(nominal: number, accent: number): number {
  const d = diff(nominal, accent)
  if (Math.abs(d) >= 35) return nominal
  return mod(nominal + (d < 0 ? -1 : 1) * Math.min(22, 35 - Math.abs(d)))
}

/** Intensidade só mexe no croma do acento: as superfícies e o texto são os mesmos neutros em todo projeto. */
export function projectLook(hue: number, o: LookOpts = {}) {
  const vib = o.intensidade === 'vibrante'
  const accentHue = o.accentHex ? hexToOklch(o.accentHex).H : hue
  const accent = o.accentHex ?? oklchFit(0.62, vib ? 0.19 : 0.15, hue)
  const light = themeAnchors(false)
  const dark = themeAnchors(true)
  const roles = {
    accent,
    danger: oklchFit(0.58, 0.17, status(27, accentHue)),
    success: oklchFit(0.62, 0.14, status(150, accentHue)),
    // Âmbar brilhante do sistema v4 (a família de B, D e F aprovada na revisão de cores); o motor deriva cada modo.
    warning: oklchFit(0.80, 0.16, status(80, accentHue)),
    pro: oklchFit(0.55, 0.12, mod(accentHue + 120)),
  }
  const { theme, problems } = makeColors({
    label: 'skim-it',
    id: 'skim-it-projeto',
    contrast: 'more',
    roles,
    light: { gray: { anchors: light }, ...neutralAccent(false) },
    dark: { gray: { anchors: dark }, ...neutralAccent(true) },
  })
  return { anchors: { light, dark }, roles, problems, theme }
}
