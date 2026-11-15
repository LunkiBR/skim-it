// Fosco: o fundo do skim-it depois de 2026-11-15. Sem ilustração, para não disputar com o texto em
// várias sessões abertas ao mesmo tempo (em tela dividida só a sessão em foco ganha vidro fosco).
// Só cor: o chão na cor do projeto, um brilho muito suave em dois cantos e um grão fino de papel.
// O estado aparece na luz, nunca em desenho: repouso quase neutro, trabalhando com a cor do projeto
// mais presente, esperando você com um brilho quente na borda de cima.
// Cores só da paleta indexada (hooks/palette.ts); modo claro pela media query do próprio SVG.
import { scenePalette } from './palette'

// Estado da sessão que o fundo mostra.
export type SceneState = 'idle' | 'working' | 'waiting'

const W = 1600
const H = 1000

// Força do brilho do projeto nos cantos, por estado e modo.
const GLOW: Record<SceneState, { dark: number; light: number }> = {
  idle: { dark: 0.1, light: 0.07 },
  working: { dark: 0.2, light: 0.14 },
  waiting: { dark: 0.1, light: 0.07 },
}

export function ambientScene(o: { hue: number; state: SceneState }): string {
  const { dark, light } = scenePalette({ hue: o.hue })
  const g = GLOW[o.state]
  const breathe = o.state === 'working' ? 'animation:breathe 14s ease-in-out infinite alternate' : ''
  const warm = o.state === 'waiting' ? 'opacity:1;animation:pulse 3.6s ease-in-out infinite' : 'opacity:0'

  const style =
    `.a{stop-color:${dark.ground0}}.b{stop-color:${dark.ground1}}.p{stop-color:${dark.inkStrong}}.w{stop-color:${dark.warm}}` +
    `.gl{opacity:${g.dark};${breathe}}.wm{mix-blend-mode:screen;${warm}}` +
    `@media (prefers-color-scheme: light){.wm{mix-blend-mode:multiply}.a{stop-color:${light.ground0}}.b{stop-color:${light.ground1}}.p{stop-color:${light.inkStrong}}.w{stop-color:${light.warm}}.gl{opacity:${g.light}}}` +
    `@keyframes breathe{from{opacity:${g.dark * 0.75}}to{opacity:${g.dark * 1.15}}}` +
    `@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}` +
    `@media (prefers-reduced-motion: reduce){*{animation:none!important}}`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">` +
    `<style>${style}</style><defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" class="a"/><stop offset="1" class="b"/></linearGradient>` +
    `<radialGradient id="tr" cx="1" cy="0" r="0.75"><stop offset="0" class="p"/><stop offset="1" class="p" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="bl" cx="0" cy="1" r="0.6"><stop offset="0" class="p"/><stop offset="1" class="p" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="w" stop-opacity=".42"/><stop offset=".26" class="w" stop-opacity="0"/></linearGradient>` +
    `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>` +
    `<g class="gl"><rect width="${W}" height="${H}" fill="url(#tr)"/><rect width="${W}" height="${H}" fill="url(#bl)"/></g>` +
    `<rect class="wm" width="${W}" height="${H}" fill="url(#top)"/>` +
    `<rect width="${W}" height="${H}" filter="url(#grain)" opacity=".035" style="mix-blend-mode:overlay"/>` +
    `</svg>`
  )
}
