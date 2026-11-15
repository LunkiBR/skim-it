// Fosco: o fundo do skim-it depois de 2026-11-15. Sem ilustração, para não disputar com o texto em
// várias sessões abertas ao mesmo tempo (em tela dividida só a sessão em foco ganha vidro fosco).
// Só cor e luz, nunca desenho, e cada estado com um sinal que se lê de longe, nas bordas em volta do vidro:
// repouso quase cinza e sem brilho; trabalhando com o chão e os cantos na cor do projeto, respirando;
// esperando você com o chão cinza de novo e a luz âmbar da atenção (a mesma da band) descendo do alto.
// Pedido de 2026-11-15: os três estados quase não se distinguiam (brilho 0,10 contra 0,20).
// Cores da paleta indexada (hooks/palette.ts) e do âmbar do v4; modo claro pela media query do próprio SVG.
import { oklchFit } from './color'
import { scenePalette } from './palette'
import { tokens } from './v4'

// Estado da sessão que o fundo mostra.
export type SceneState = 'idle' | 'working' | 'waiting'

const W = 1600
const H = 1000

// Por estado: croma do chão (fração da paleta), força do brilho do projeto nos cantos e da luz âmbar.
const LIGHTS: Record<SceneState, { ground: number; glow: { dark: number; light: number }; amber: { dark: number; light: number } }> = {
  idle: { ground: 0.3, glow: { dark: 0.05, light: 0.04 }, amber: { dark: 0, light: 0 } },
  working: { ground: 1, glow: { dark: 0.5, light: 0.6 }, amber: { dark: 0, light: 0 } },
  waiting: { ground: 0.3, glow: { dark: 0, light: 0 }, amber: { dark: 0.72, light: 0.9 } },
}

export function ambientScene(o: { hue: number; state: SceneState }): string {
  const s = LIGHTS[o.state]
  const { dark, light } = scenePalette({ hue: o.hue, chroma: s.ground })
  const ink = scenePalette({ hue: o.hue })
  // No escuro, o âmbar dos ícones da band; no claro, um dourado mais claro, porque o âmbar dos ícones em multiply vira caramelo.
  const amber = { dark: tokens(o.hue, true).a9, light: oklchFit(0.84, 0.15, 80) }
  const breathe = o.state === 'working' ? 'animation:breathe 9s ease-in-out infinite alternate' : ''
  const pulse = o.state === 'waiting' ? 'animation:pulse 3.2s ease-in-out infinite' : ''

  const style =
    `.a{stop-color:${dark.ground0}}.b{stop-color:${dark.ground1}}.p{stop-color:${ink.dark.inkStrong}}.w{stop-color:${amber.dark}}` +
    `.gl{opacity:${s.glow.dark};${breathe}}.wm{mix-blend-mode:screen;opacity:${s.amber.dark};${pulse}}` +
    `@media (prefers-color-scheme: light){.wm{mix-blend-mode:multiply;opacity:${s.amber.light}}.a{stop-color:${light.ground0}}.b{stop-color:${light.ground1}}.p{stop-color:${ink.light.tint}}.gl{mix-blend-mode:multiply}.w{stop-color:${amber.light}}.gl{opacity:${s.glow.light}}}` +
    `@keyframes breathe{from{opacity:${s.glow.dark * 0.7}}to{opacity:${s.glow.dark * 1.1}}}` +
    `@keyframes pulse{0%,100%{opacity:${s.amber.dark * 0.6}}50%{opacity:${s.amber.dark}}}` +
    `@media (prefers-color-scheme: light){@keyframes breathe{from{opacity:${s.glow.light * 0.7}}to{opacity:${s.glow.light * 1.1}}}@keyframes pulse{0%,100%{opacity:${s.amber.light * 0.6}}50%{opacity:${s.amber.light}}}}` +
    `@media (prefers-reduced-motion: reduce){*{animation:none!important}}`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">` +
    `<style>${style}</style><defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" class="a"/><stop offset="1" class="b"/></linearGradient>` +
    `<radialGradient id="tr" cx="1" cy="0" r="0.95"><stop offset="0" class="p"/><stop offset="1" class="p" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="bl" cx="0" cy="1" r="0.8"><stop offset="0" class="p"/><stop offset="1" class="p" stop-opacity="0"/></radialGradient>` +
    // Âmbar: luz que entra pelas bordas da janela (mais forte no alto), onde a moldura em volta do vidro aparece.
    // Faixas estreitas e claras: âmbar fraco espalhado sobre o escuro vira marrom.
    `<linearGradient id="et" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="w"/><stop offset=".09" class="w" stop-opacity=".55"/><stop offset=".24" class="w" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="el" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="w" stop-opacity=".6"/><stop offset=".08" class="w" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="er" x1="1" y1="0" x2="0" y2="0"><stop offset="0" class="w" stop-opacity=".6"/><stop offset=".08" class="w" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="eb" x1="0" y1="1" x2="0" y2="0"><stop offset="0" class="w" stop-opacity=".35"/><stop offset=".1" class="w" stop-opacity="0"/></linearGradient>` +
    `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>` +
    `<g class="gl"><rect width="${W}" height="${H}" fill="url(#tr)"/><rect width="${W}" height="${H}" fill="url(#bl)"/></g>` +
    `<g class="wm">` + ['et', 'el', 'er', 'eb'].map(id => `<rect width="${W}" height="${H}" fill="url(#${id})"/>`).join('') + `</g>` +
    `<rect width="${W}" height="${H}" filter="url(#grain)" opacity=".035" style="mix-blend-mode:overlay"/>` +
    `</svg>`
  )
}
