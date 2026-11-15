// Paleta indexada das cenas: toda cor sai de fichas com nome, calculadas de uma semente só (o matiz
// do projeto). A cena nunca faz conta de matiz: troca o projeto, troca a paleta inteira e o desenho
// continua o mesmo (azul claro vira rosa claro, branco azulado vira branco rosado).
// Cada ficha é um degrau fixo de luminosidade e croma (OKLCH) no matiz do projeto; o croma que não
// cabe no sRGB é baixado, nunca cortado por canal, para o matiz não escorregar.
// Regra dos estados: repouso usa ink (pálido, quase branco), trabalhando usa inkStrong (o mesmo
// matiz, mais forte), esperando você usa warm.
import { oklchFit } from './color'

export type SceneTokens = {
  /** Fundo, em cima (escuro: noite; claro: papel). */
  ground0: string
  /** Fundo, embaixo (escuro: noite um pouco mais clara; claro: papel um pouco mais tingido). */
  ground1: string
  /** Sombra de vinco. */
  shade: string
  /** Luz de vinco. */
  crease: string
  /** Tinta do repouso: pálida no escuro, a tinta da chapa no claro. */
  ink: string
  /** Tinta do trabalhando: o mesmo matiz, mais croma e mais contraste com o fundo. */
  inkStrong: string
  /** Disco da lua. */
  moon: string
  /** Halo em volta da lua. */
  halo: string
  /** Segunda impressão desalinhada, entre o fundo e a tinta. */
  tint: string
  /** Espuma: o mais claro da cena (no claro, o próprio papel). */
  foam: string
  /** Sinal de "esperando você": sempre quente, qualquer que seja o projeto. */
  warm: string
}
export type ScenePalette = { dark: SceneTokens; light: SceneTokens; warmHue: number }

// Degraus [luminosidade, croma]. O matiz é o do projeto em todos, menos em warm.
const LADDER: Record<'dark' | 'light', Record<keyof SceneTokens, [number, number]>> = {
  dark: {
    ground0: [0.17, 0.035], ground1: [0.21, 0.05], shade: [0.08, 0.03], crease: [0.9, 0.02],
    ink: [0.87, 0.045], inkStrong: [0.8, 0.13], moon: [0.95, 0.035], halo: [0.84, 0.06],
    tint: [0.66, 0.1], foam: [0.95, 0.035], warm: [0.83, 0.14],
  },
  light: {
    ground0: [0.955, 0.008], ground1: [0.935, 0.013], shade: [0.4, 0.05], crease: [0.99, 0.005],
    ink: [0.42, 0.105], inkStrong: [0.33, 0.17], moon: [0.42, 0.105], halo: [0.42, 0.105],
    tint: [0.62, 0.1], foam: [0.955, 0.008], warm: [0.64, 0.17],
  },
}

/**
 * Matiz do sinal quente: mora na faixa do âmbar (35 a 95) e é empurrado para longe do matiz do
 * projeto, para um projeto laranja ou rosa não confundir a sua cor com o sinal.
 */
export function warmHue(hue: number): number {
  const d = ((((hue - 65) % 360) + 540) % 360) - 180
  return 65 - (d < 0 ? -1 : 1) * 30 * Math.max(0, 1 - Math.abs(d) / 140)
}

export function scenePalette(o: { hue: number; chroma?: number }): ScenePalette {
  const k = o.chroma ?? 1
  const wh = warmHue(o.hue)
  const mode = (m: 'dark' | 'light') => {
    const out = {} as SceneTokens
    for (const name of Object.keys(LADDER[m]) as (keyof SceneTokens)[]) {
      const [l, c] = LADDER[m][name]
      // No claro o sinal vai um pouco para o vermelho: vira selo de tinta, não amarelo sobre papel.
      out[name] = name === 'warm' ? oklchFit(l, c, m === 'light' ? wh - 18 : wh) : oklchFit(l, c * k, o.hue)
    }
    return out
  }
  return { dark: mode('dark'), light: mode('light'), warmHue: wh }
}
