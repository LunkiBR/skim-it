// Look base do skim-it (v0.1): o mesmo em todas as janelas, porque o look do Desktop é global.
// Direção Ardósia (escolhida em 2026-11-14): grafite frio tingido (matiz 250 em OKLCH, croma 0,006
// a 0,016), texto a 7:1 ou mais, acento na cor do projeto e um fundo fosco só de cor. A cor por
// projeto chega na v0.4.
import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { neutralAccent, themeAnchors } from './v4'

// Exportados para scripts/check-look.mjs conferir as metas sobre os mesmos valores. Os neutros são os do
// sistema v4 (hooks/v4.ts): cinzas quentes quase sem croma, texto forte, secundário e fraco.
export const ANCHORS = { light: themeAnchors(false), dark: themeAnchors(true) } as const

export const BASE = makeColors({
  label: 'skim-it',
  id: 'skim-it-base',
  contrast: 'more',
  // Status com sentido preservado: vermelho, verde, âmbar. O acento é a cor do projeto saturada: um aço
  // quase neutro (#5b7ea6) deixava comando e skill no prompt (/social-design) da cor do texto.
  roles: { accent: '#2f8adc', danger: '#c4453c', success: '#3f9a62', warning: '#b7791f', pro: '#7a5fae' },
  light: { gray: { anchors: { ...ANCHORS.light } }, ...neutralAccent(false) },
  dark: { gray: { anchors: { ...ANCHORS.dark } }, ...neutralAccent(true) },
})

// Fundo como cena (SVG desenhado no hook de Backdrop, ver register.tsx): o fosco (hooks/ambient.ts),
// só cor, que muda com o estado da sessão. O nome da cena vai em `scene` e em `id`, como no theme-examples (Desktops
// anteriores leem `id`). A cena tem os dois modos na própria media query, então não força modo.
// A paleta pinta barra lateral, painéis e cartões onde o Desktop lê `colors`.
export const SCENE_ID = 'skim-it-fosco'
export const SCENE_HUE = 250

// Look com o fundo fosco; `colors` vem do base ou do look do projeto (hooks/lookgen.ts).
export const lookArgs = (colors: unknown) =>
  ({ colors, backdrop: { scene: SCENE_ID, id: SCENE_ID, glass: { blur: 12, opacity: 0.64 } } }) as unknown as ThemeSetArgs

export const LOOK = lookArgs(BASE.theme)

// A linha de `problems` que faria o Desktop ignorar o look inteiro.
export const UNPAINTED = BASE.problems.find(line => line.startsWith("Desktop won't paint"))
