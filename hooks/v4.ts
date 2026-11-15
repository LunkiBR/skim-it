// Sistema de cor v4 (aprovado em 2026-11-15): neutros quentes, cor do projeto só na identidade, âmbar como
// única cor de atenção e o número da sessão colorido sem quadrado. Puro, sem `$`: tokens(matiz, escuro)
// devolve hex; svg() monta o documento com as duas paletas e deixa o `prefers-color-scheme` escolher.
// Testado em scripts/check-v4.mjs.
import { oklchFit } from './color'

/** Quando true, o acento do tema vira o neutro forte (botões primários neutros). Hoje o acento é a cor do projeto. */
export const PRIMARY_NEUTRAL = false

const NEUTRAL_HUE = 75
const TEXT_HUE = 85
const NUMERAL_HUES = [185, 275, 125, 335, 215, 305, 155, 245, 5] as const

export type TokenName =
  | 'app' | 's2' | 's3' | 's4' | 's5' | 'b6'
  | 'weak' | 'sec' | 'strong'
  | 'p3' | 'p4' | 'p6' | 'p9' | 'p10' | 'p11' | 'p12' | 'pink'
  | 'a6' | 'a9' | 'a11' | 'dk'
  | 'n0' | 'n1' | 'n2' | 'n3' | 'n4' | 'n5' | 'n6' | 'n7' | 'n8' | 'n9'
export type Tokens = Record<TokenName, string>

// WCAG 2: usado pelo texto sobre o bloco do projeto e pelos testes.
const lin = (hex: string) =>
  [1, 3, 5].map(i => {
    const x = parseInt(hex.slice(i, i + 2), 16) / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
const lum = (hex: string) => {
  const [r, g, b] = lin(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Contraste WCAG 2 entre duas cores #rrggbb. */
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

/** A tinta sobre um preenchimento: branco ou o neutro escuro, o de maior contraste. */
export function inkFor(fill: string): string {
  const dark = oklchFit(0.195, 0.006, NEUTRAL_HUE)
  return contrast('#ffffff', fill) >= contrast(dark, fill) ? '#ffffff' : dark
}

/** Cor do número da sessão `index` (0 a 8 com matiz; a décima e as seguintes são neutras). */
export function numeral(index: number, dark: boolean): string {
  if (index >= NUMERAL_HUES.length) return oklchFit(dark ? 0.95 : 0.25, 0.004, NEUTRAL_HUE)
  return oklchFit(dark ? 0.85 : 0.46, dark ? 0.1 : 0.12, NUMERAL_HUES[Math.max(0, index)] as number)
}

/** Todos os tokens do modo, a partir do matiz do projeto. */
export function tokens(hue: number, dark: boolean): Tokens {
  const n = (L: number) => oklchFit(L, dark ? 0.006 : 0.004, NEUTRAL_HUE)
  const t = (L: number) => oklchFit(L, 0.008, TEXT_HUE)
  const p = (L: number, C: number) => oklchFit(L, C, hue)
  const a = (L: number, C: number, H: number) => oklchFit(L, C, H)
  const p9 = dark ? p(0.7, 0.11) : p(0.55, 0.11)
  const tk = {
    app: n(dark ? 0.195 : 0.965),
    s2: n(dark ? 0.225 : 0.985),
    s3: n(dark ? 0.25 : 0.945),
    s4: n(dark ? 0.28 : 0.92),
    s5: n(dark ? 0.305 : 0.895),
    b6: n(dark ? 0.35 : 0.86),
    weak: t(dark ? 0.64 : 0.52),
    sec: t(dark ? 0.81 : 0.4),
    strong: t(dark ? 0.955 : 0.22),
    p3: dark ? p(0.255, 0.028) : p(0.955, 0.02),
    p4: dark ? p(0.28, 0.035) : p(0.93, 0.03),
    p6: dark ? p(0.4, 0.06) : p(0.84, 0.06),
    p9,
    p10: dark ? p(0.74, 0.11) : p(0.5, 0.11),
    p11: dark ? p(0.82, 0.08) : p(0.44, 0.09),
    p12: dark ? p(0.94, 0.025) : p(0.27, 0.05),
    pink: inkFor(p9),
    a6: dark ? a(0.56, 0.11, 80) : a(0.64, 0.14, 60),
    a9: dark ? a(0.84, 0.16, 82) : a(0.64, 0.155, 58),
    a11: dark ? a(0.87, 0.13, 86) : a(0.5, 0.13, 60),
    dk: oklchFit(0.195, 0.006, NEUTRAL_HUE),
  } as Tokens
  for (let i = 0; i < 10; i++) tk[('n' + i) as TokenName] = numeral(i, dark)
  return tk
}

/**
 * As âncoras do tema (hooks/look.ts e lookgen.ts) a partir dos neutros. O motor de cor exige as superfícies
 * em ordem: no escuro surface-0 a mais escura, no claro surface-0 a mais escura também (ela vai da página
 * s3 aos cartões s2). surface-3 colada em surface-2, senão o texto apagado perde 4,5:1.
 */
export function themeAnchors(dark: boolean) {
  const k = tokens(0, dark)
  const surfaces = dark ? [k.app, k.s2, k.s3, k.s3] : [k.s3, k.app, k.s2, k.s2]
  return {
    'surface-0': surfaces[0] as string,
    'surface-1': surfaces[1] as string,
    'surface-2': surfaces[2] as string,
    'surface-3': surfaces[3] as string,
    'text-primary': k.strong,
    'text-secondary': k.sec,
    'text-muted': k.weak,
  }
}

/** Com PRIMARY_NEUTRAL, o acento do modo vira o neutro forte (espalhe no modo do makeColors); senão nada. */
export function neutralAccent(dark: boolean): { roles?: { accent: string } } {
  return PRIMARY_NEUTRAL ? { roles: { accent: tokens(0, dark).strong } } : {}
}

// ---- SVG ----

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"

/** Texto do SVG: centrado na vertical em `y`; `cls` é a classe de cor (f-strong...). */
export function txt(x: number, y: number, s: string, size: number, weight: number, cls: string, extra = ''): string {
  return `<text x="${+x.toFixed(2)}" y="${y}" font-size="${size}" font-weight="${weight}" dominant-baseline="central" class="${cls}"${extra}>${esc(s)}</text>`
}

/**
 * O documento SVG. A cor vem de classes `f-<token>` (fill) e `s-<token>` (stroke) no corpo; o estilo leva só
 * as usadas, no escuro por padrão e no claro dentro de `prefers-color-scheme: light`, como o fundo
 * (ambient.ts). `hover` liga o `.hv:hover .bg` (chip mais claro sob o ponteiro; exige Svg isInteractive).
 */
export function svg(w: number, h: number, body: string, hue: number, hover = false): string {
  const used = new Set<string>()
  for (const m of body.matchAll(/class="([^"]*)"/g)) for (const c of (m[1] as string).split(/\s+/)) if (/^[fs]-\w+$/.test(c)) used.add(c)
  const dark = tokens(hue, true)
  const light = tokens(hue, false)
  const rule = (c: string, k: Tokens) => `.${c}{${c[0] === 'f' ? 'fill' : 'stroke'}:${k[c.slice(2) as TokenName]}}`
  let css = [...used].map(c => rule(c, dark)).join('')
  let cssLight = [...used].map(c => rule(c, light)).join('')
  if (hover) {
    css += `.hv:hover .bg{fill:${dark.s4}}`
    cssLight += `.hv:hover .bg{fill:${light.s4}}`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}">` +
    `<style>${css}@media (prefers-color-scheme: light){${cssLight}}</style>${body}</svg>`
  )
}

// ---- ícones de estado: 14 x 14, traço 1,5 ----

export type IconKind = 'running' | 'approve' | 'answer' | 'background' | 'ready' | 'nosignal' | 'stopped'

const ICONS: Record<IconKind, string> = {
  running:
    '<circle cx="7" cy="7" r="5.75" fill="none" class="s-b6" stroke-width="1.5"/><path d="M7 1.25 A5.75 5.75 0 1 1 1.25 7" fill="none" class="s-sec" stroke-width="1.5" stroke-linecap="round"/>',
  approve:
    '<circle cx="7" cy="7" r="6.5" class="f-a9"/><rect x="6.25" y="3.4" width="1.5" height="4.6" rx="0.75" class="f-dk"/><circle cx="7" cy="10.1" r="0.95" class="f-dk"/>',
  answer:
    '<circle cx="7" cy="7" r="6.5" class="f-a9"/><path d="M5.25 5.35 C5.25 4.35 6.05 3.65 7 3.65 C7.95 3.65 8.75 4.3 8.75 5.2 C8.75 6 8.2 6.35 7.65 6.7 C7.25 6.95 7 7.25 7 7.85" fill="none" class="s-dk" stroke-width="1.4" stroke-linecap="round"/><circle cx="7" cy="10.15" r="0.9" class="f-dk"/>',
  background:
    '<circle cx="7" cy="7" r="5.75" fill="none" class="s-sec" stroke-width="1.5"/><path d="M7 4.1 V7 L9 8.2" fill="none" class="s-sec" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  ready:
    '<circle cx="7" cy="7" r="6.5" class="f-p9"/><path d="M4.3 7.2 L6.2 9 L9.8 5.2" fill="none" class="s-pink" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  nosignal:
    '<path d="M1.6 6.3 C4.6 3.2 9.4 3.2 12.4 6.3" fill="none" class="s-weak" stroke-width="1.4" stroke-linecap="round"/><path d="M3.8 8.5 C5.6 6.7 8.4 6.7 10.2 8.5" fill="none" class="s-weak" stroke-width="1.4" stroke-linecap="round"/><circle cx="7" cy="10.8" r="1" class="f-weak"/><path d="M2.4 2.2 L11.6 12.2" fill="none" class="s-weak" stroke-width="1.4" stroke-linecap="round"/>',
  stopped:
    '<path d="M11.2 8.6 A4.8 4.8 0 1 1 5.4 2.8 A3.8 3.8 0 0 0 11.2 8.6 Z" fill="none" class="s-weak" stroke-width="1.4" stroke-linejoin="round"/>',
}

/** O ícone dentro de um `<g>` posicionado em (x, y). */
export function icon(kind: IconKind, x: number, y: number): string {
  return `<g transform="translate(${+x.toFixed(2)} ${y})">${ICONS[kind]}</g>`
}

/** O ícone sozinho, num SVG de 14 x 14. */
export function iconSvg(kind: IconKind, hue: number): string {
  return svg(14, 14, ICONS[kind], hue)
}
