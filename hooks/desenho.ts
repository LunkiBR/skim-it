// Desenho da band v4 em SVG (faixa, frota, Git e peças do painel): o Desktop só desenha o `label` de um botão
// e uma Box não tem raio, então tudo o que precisa de raio exato, ícone ou texto dentro de forma é SVG.
// Puro, sem `$`: devolve o texto do SVG e a largura; band.tsx os põe em `Svg`. As cores vêm de classes do
// hooks/v4.ts (duas paletas no próprio SVG). Medidas do Figma da band v4; testado em scripts/check-v4.mjs.
import type { Status } from './fleetcore'
import { fitText, textWidth } from './measure'
import { esc, icon, svg, txt } from './v4'
import type { IconKind } from './v4'

export type Tier = 'wide' | 'medium' | 'narrow' | 'minimal'

/** A largura útil em px (a célula do Desktop mede cerca de 7 px) decide a forma da frota. */
export function tierOf(px: number): Tier {
  return px >= 900 ? 'wide' : px >= 680 ? 'medium' : px >= 480 ? 'narrow' : 'minimal'
}

/** Ícone do estado; esperando é "aprovar" quando o pedido é de aprovação e "responder" nos outros casos. */
export function statusIcon(status: Status, waitingWhat?: string): IconKind {
  switch (status) {
    case 'precisa': return waitingWhat?.startsWith('aprovar') ? 'approve' : 'answer'
    case 'rodando': return 'running'
    case 'segundo-plano': return 'background'
    case 'pronta': return 'ready'
    case 'sem-sinal': return 'nosignal'
    default: return 'stopped'
  }
}

export type Piece = { source: string; width: number; height: number }

const numClass = (idx: number) => 'f-n' + Math.min(Math.max(0, idx), 9)

// ---- bloco do projeto, número e contagens ----

/** O bloco do projeto (altura 28, raio 6, fundo project/9, nome 13/600 na tinta) sem o SVG em volta. */
function blockBody(x: number, y: number, name: string, nameW: number): string {
  return `<rect x="${x}" y="${y}" width="${20 + nameW}" height="28" rx="6" class="f-p9"/>` + txt(x + 10, y + 14, name, 13, 600, 'f-pink')
}

/** O bloco do projeto sozinho (cartão de ajustes). */
export function blockPiece(name: string, hue: number, max = 220): Piece {
  const text = fitText(name, 13, 600, max)
  const nameW = textWidth(text, 13, 600)
  return { source: svg(20 + nameW, 28, blockBody(0, 0, text, nameW), hue), width: 20 + nameW, height: 28 }
}

/** O número da sessão: 12 negrito, sem quadrado, centrado num espaço de 20 px; colorido, ou em `cls` (a faixa usa o texto forte). */
export function numberPiece(idx: number, hue: number, cls?: string): Piece {
  return { source: svg(20, 20, txt(10, 10, String(idx + 1), 12, 700, cls ?? numClass(idx), ' text-anchor="middle"'), hue), width: 20, height: 20 }
}

/** Pílula de contagem (altura 20, redonda): `fill` é um token (s3, s4, s5). */
export function countPill(text: string, fill: string, hue: number): Piece {
  const w = Math.max(20, Math.ceil(textWidth(text, 12, 500)) + 16)
  const body = `<rect width="${w}" height="20" rx="10" class="f-${fill}"/>` + txt(w / 2, 10, text, 12, 500, 'f-sec', ' text-anchor="middle"')
  return { source: svg(w, 20, body, hue), width: w, height: 20 }
}

/** Cabeçalho de grupo do painel: rótulo em caixa alta 11/600 com 6% de tracking, e a contagem em pílula. */
export function groupHeader(label: string, count: number, hue: number): Piece {
  const up = label.toUpperCase()
  const tw = textWidth(up, 11, 600) + up.length * 0.66
  const c = String(count)
  const pw = Math.max(20, Math.ceil(textWidth(c, 11, 500)) + 14)
  const w = Math.ceil(tw) + 8 + pw
  const body =
    txt(0, 10, up, 11, 600, 'f-weak', ' letter-spacing="0.66"') +
    `<rect x="${Math.ceil(tw) + 8}" width="${pw}" height="20" rx="10" class="f-s3"/>` +
    txt(Math.ceil(tw) + 8 + pw / 2, 10, c, 11, 500, 'f-weak', ' text-anchor="middle"')
  return { source: svg(w, 20, body, hue), width: w, height: 20 }
}

/** Linha fina de 1 px na cor de borda (divisória do cartão de ajustes). */
export function rulePiece(width: number, hue: number): Piece {
  const w = Math.max(1, Math.round(width))
  return { source: svg(w, 1, `<rect width="${w}" height="1" class="f-b6"/>`, hue), width: w, height: 1 }
}

// ---- faixa ----

export type FaixaIn = {
  w: number
  hue: number
  name: string
  /** índice da sessão a partir de 0 (o número desenhado é idx + 1) */
  idx: number
  topic: string
  status: Status
  waitingWhat?: string
  statusLabel: string
  /** "de 3" ou "of 3" */
  ofText: string
  /** "Sessão 2", para a descrição */
  seqLabel: string
  minimal: boolean
  /** quantas esperam por você (o contador âmbar da forma mínima) */
  waiting: number
  /** a frase da descrição para quem espera, por exemplo "2 esperando" */
  waitingAlt: string
  /** sessão sozinha no projeto: sem número e sem "de 1" (o número só identifica entre várias) */
  solo?: boolean
}

/** A faixa: altura 36, raio 8, fundo project/3 e borda project/6; bloco, número, assunto e o estado desta sessão. */
export function faixa(o: FaixaIn): { source: string; alt: string; height: number } {
  const w = Math.max(120, Math.round(o.w))
  const attention = o.status === 'precisa'
  const border = attention ? 's-a6' : o.status === 'pronta' ? 's-p6' : 's-b6'
  const labelColor = attention ? 'f-a11' : o.status === 'pronta' ? 'f-p11' : 'f-sec'
  const labelW = textWidth(o.statusLabel, 12, 500)
  const pillW = o.minimal ? 28 : Math.ceil(10 + 14 + 6 + labelW + 10)
  let right = w - 4 - pillW
  let body = `<rect x=".5" y=".5" width="${w - 1}" height="35" rx="7.5" class="f-p3 s-p6"/>`
  body += `<rect x="${right + 0.5}" y="4.5" width="${pillW - 1}" height="27" rx="5.5" class="f-s3 ${border}"/>`
  const kind = statusIcon(o.status, o.waitingWhat)
  body += o.minimal ? icon(kind, right + 7, 11) : icon(kind, right + 10, 11) + txt(right + 10 + 14 + 6, 18, o.statusLabel, 12, 500, labelColor)
  if (o.minimal && o.waiting > 0) {
    const c = String(o.waiting)
    const cw = Math.ceil(10 + 14 + 6 + textWidth(c, 12, 500) + 10)
    right -= 8 + cw
    body += `<rect x="${right + 0.5}" y="4.5" width="${cw - 1}" height="27" rx="5.5" class="f-s3 s-a6"/>` + icon('approve', right + 10, 11) + txt(right + 10 + 14 + 6, 18, c, 12, 500, 'f-a11')
  }
  const numW = o.solo ? 0 : 20 + (o.minimal ? 0 : 4 + Math.ceil(textWidth(o.ofText, 12, 500)))
  const nameMax = Math.max(30, o.minimal ? right - 8 - 4 - 20 - 8 - numW : Math.min(220, right - 8 - 4 - 20 - 8 - numW - 120))
  const name = fitText(o.name, 13, 600, nameMax)
  const nameW = Math.ceil(textWidth(name, 13, 600))
  body += blockBody(4, 4, name, nameW)
  const numX = 4 + 20 + nameW + 8
  if (!o.solo) {
    body += txt(numX + 10, 18, String(o.idx + 1), 12, 700, numClass(o.idx), ' text-anchor="middle"')
    if (!o.minimal) body += txt(numX + 24, 18, o.ofText, 12, 500, 'f-p11')
  }
  let shownTopic = ''
  if (!o.minimal) {
    const divX = o.solo ? numX : numX + numW + 8
    const tx = divX + 1 + 8
    const tMax = right - 8 - tx
    if (tMax >= 40 && o.topic) {
      shownTopic = fitText(o.topic, 13, 400, tMax)
      body += `<rect x="${divX}" y="10" width="1" height="16" class="f-p6"/>` + txt(tx, 18, shownTopic, 13, 400, 'f-p12')
    }
  }
  const alt = [o.name, o.solo ? '' : `${o.seqLabel} ${o.ofText}`, o.topic, o.statusLabel, o.waiting > 0 ? o.waitingAlt : ''].filter(Boolean).join('. ')
  return { source: svg(w, 36, body, o.hue), alt, height: 36 }
}

/** Largura da peça esquerda da faixa: sempre maior que a janela; a caixa que a contém corta onde a linha acaba. */
export const FAIXA_LEFT_W = 2400

/**
 * A faixa em duas peças, para encher a linha sem saber a largura em px (o Desktop só dá colunas):
 * a esquerda (bloco, número, assunto) é larga e a Box com overflow corta onde a linha acaba; a direita
 * (contador e estado) fica colada na borda. O fundo e a borda continuam de uma peça na outra sem emenda.
 * `o.w` é a largura estimada e serve só para o assunto caber antes do estado (estimativa baixa: corta antes).
 */
export function faixaParts(o: FaixaIn): { left: Piece; right: Piece; alt: string } {
  const attention = o.status === 'precisa'
  const border = attention ? 's-a6' : o.status === 'pronta' ? 's-p6' : 's-b6'
  const labelColor = attention ? 'f-a11' : o.status === 'pronta' ? 'f-p11' : 'f-sec'
  const pillW = o.minimal ? 28 : Math.ceil(10 + 14 + 6 + textWidth(o.statusLabel, 12, 500) + 10)
  // Direita: 8 de folga, o contador âmbar (só na mínima), o estado e 4 até a borda.
  let rx = 8
  let rbody = ''
  if (o.minimal && o.waiting > 0) {
    const c = String(o.waiting)
    const cw = Math.ceil(10 + 14 + 6 + textWidth(c, 12, 500) + 10)
    rbody += `<rect x="${rx + 0.5}" y="4.5" width="${cw - 1}" height="27" rx="5.5" class="f-s3 s-a6"/>` + icon('approve', rx + 10, 11) + txt(rx + 10 + 14 + 6, 18, c, 12, 500, 'f-a11')
    rx += cw + 8
  }
  rbody += `<rect x="${rx + 0.5}" y="4.5" width="${pillW - 1}" height="27" rx="5.5" class="f-s3 ${border}"/>`
  const kind = statusIcon(o.status, o.waitingWhat)
  rbody += o.minimal ? icon(kind, rx + 7, 11) : icon(kind, rx + 10, 11) + txt(rx + 10 + 14 + 6, 18, o.statusLabel, 12, 500, labelColor)
  const rw = rx + pillW + 4
  // O fundo da direita começa fora da peça (x negativo) para a borda de cima e de baixo emendar com a esquerda.
  const right = svg(rw, 36, `<rect x="-20" y=".5" width="${rw + 20 - 0.5}" height="35" rx="7.5" class="f-p3 s-p6"/>` + rbody, o.hue)
  // Esquerda: o fundo passa da largura da peça, então o lado direito dela nunca mostra canto nem borda.
  const room = Math.max(120, Math.round(o.w)) - rw
  const numW = o.solo ? 0 : 20 + (o.minimal ? 0 : 4 + Math.ceil(textWidth(o.ofText, 12, 500)))
  const nameMax = Math.max(30, o.minimal ? room - 4 - 20 - 8 - numW : Math.min(220, room - 4 - 20 - 8 - numW - 120))
  const name = fitText(o.name, 13, 600, nameMax)
  const nameW = Math.ceil(textWidth(name, 13, 600))
  let lbody = `<rect x=".5" y=".5" width="${FAIXA_LEFT_W + 20}" height="35" rx="7.5" class="f-p3 s-p6"/>` + blockBody(4, 4, name, nameW)
  const numX = 4 + 20 + nameW + 8
  if (!o.solo) {
    lbody += txt(numX + 10, 18, String(o.idx + 1), 12, 700, numClass(o.idx), ' text-anchor="middle"')
    if (!o.minimal) lbody += txt(numX + 24, 18, o.ofText, 12, 500, 'f-p11')
  }
  if (!o.minimal) {
    const divX = o.solo ? numX : numX + numW + 8
    const tx = divX + 9
    const tMax = room - tx
    if (tMax >= 40 && o.topic) lbody += `<rect x="${divX}" y="10" width="1" height="16" class="f-p6"/>` + txt(tx, 18, fitText(o.topic, 13, 400, tMax), 13, 400, 'f-p12')
  }
  const alt = [o.name, o.solo ? '' : `${o.seqLabel} ${o.ofText}`, o.topic, o.statusLabel, o.waiting > 0 ? o.waitingAlt : ''].filter(Boolean).join('. ')
  return { left: { source: svg(FAIXA_LEFT_W, 36, lbody, o.hue), width: FAIXA_LEFT_W, height: 36 }, right: { source: right, width: rw, height: 36 }, alt }
}

// ---- frota ----

export type FleetItem = { idx: number; status: Status; waitingWhat?: string; title: string; detail: string }
export type Chip = FleetItem & { titled: number }

const plusWidth = (n: number) => Math.ceil(10 + textWidth('+' + n, 12, 500) + 10)

function chipTitle(c: Chip): string {
  return c.titled > 0 ? fitText(c.title, 12, 500, c.titled) : ''
}

/** Chip: altura 28, padding esquerdo 4 e direito 10, espaço de 6; número (20), ícone (14) e título opcional. */
export function chipWidth(c: Chip): number {
  const t = chipTitle(c)
  return Math.ceil(4 + 20 + 6 + 14 + (t ? 6 + textWidth(t, 12, 500) : 0) + 10)
}

function stripWidth(chips: Chip[], plus: number): number {
  const widths = chips.map(chipWidth)
  if (plus > 0) widths.push(plusWidth(plus))
  return widths.length === 0 ? 0 : 4 + widths.reduce((a, b) => a + b, 0) + 8 * (widths.length - 1)
}

/**
 * Quais chips cabem. Larga: quem espera com título (até 160 px), mais uma sessão com título (até 96) e as
 * outras só com número e ícone; média: o mesmo sem a sessão extra, no máximo 5 chips. O que não cabe vira "+N".
 */
export function planFleet(items: FleetItem[], px: number, tier: 'wide' | 'medium', reserve = 104): { chips: Chip[]; plus: number } {
  const avail = px - reserve
  let extra = tier === 'wide' ? 1 : 0
  const all: Chip[] = items.map(it => ({ ...it, titled: it.status === 'precisa' ? 160 : extra-- > 0 ? 96 : 0 }))
  const chips = all.slice(0, tier === 'medium' ? 5 : all.length)
  while (chips.length > 0 && stripWidth(chips, items.length - chips.length) > avail) chips.pop()
  return { chips, plus: items.length - chips.length }
}

function chipBody(x: number, w: number, waiting: boolean, inner: string, tip: string): string {
  const rect = waiting
    ? `<rect x=".5" y=".5" width="${w - 1}" height="27" rx="5.5" class="bg f-s3 s-a6"/>`
    : `<rect width="${w}" height="28" rx="6" class="bg f-s3"/>`
  return `<g class="hv" transform="translate(${x} 0)"><title>${esc(tip)}</title>${rect}${inner}</g>`
}

/** A frota em um só SVG (chips e "+N"); o título de cada chip carrega o detalhe para o tooltip. Peça interativa. */
export function fleetPiece(chips: Chip[], plus: number, hue: number, sessionWord: string): Piece {
  let x = 4
  let body = ''
  for (const c of chips) {
    const w = chipWidth(c)
    const t = chipTitle(c)
    const inner =
      txt(14, 14, String(c.idx + 1), 12, 700, numClass(c.idx), ' text-anchor="middle"') +
      icon(statusIcon(c.status, c.waitingWhat), 30, 7) +
      (t ? txt(50, 14, t, 12, 500, 'f-strong') : '')
    body += chipBody(x, w, c.status === 'precisa', inner, `${sessionWord} ${c.idx + 1} · ${c.title} · ${c.detail}`)
    x += w + 8
  }
  if (plus > 0) {
    const w = plusWidth(plus)
    body += `<g transform="translate(${x} 0)"><rect width="${w}" height="28" rx="6" class="f-s3"/>${txt(w / 2, 14, '+' + plus, 12, 500, 'f-sec', ' text-anchor="middle"')}</g>`
    x += w + 8
  }
  const width = Math.max(1, x - 8)
  return { source: svg(width, 28, body, hue, true), width, height: 28 }
}

export type CountItem = { kind: IconKind; count: number; label: string; waiting?: boolean }

/** Largura estreita: um chip por estado, com ícone e contagem (quem espera aparece no aviso). */
export function countsPiece(items: CountItem[], hue: number): Piece {
  let x = 4
  let body = ''
  for (const it of items) {
    const c = String(it.count)
    const w = Math.ceil(4 + 14 + 6 + textWidth(c, 12, 500) + 10)
    const inner = icon(it.kind, 8, 7) + txt(8 + 14 + 6, 14, c, 12, 500, 'f-strong')
    body += chipBody(x, w, false, inner, it.count + ' ' + it.label)
    x += w + 8
  }
  const width = Math.max(1, x - 8)
  return { source: svg(width, 28, body, hue, true), width, height: 28 }
}

// ---- Git ----

const BRANCH =
  '<g fill="none" class="s-weak" stroke-width="1.3" stroke-linecap="round"><circle cx="3.5" cy="3" r="1.6"/><circle cx="3.5" cy="11" r="1.6"/><circle cx="10.5" cy="5" r="1.6"/><path d="M3.5 4.6 V9.4"/><path d="M10.5 6.6 C10.5 9 3.5 7.6 3.5 9.4"/></g>'

/** A linha Git: ramo, "· N alterações" e a pílula do PR (altura 20). null quando não há o que dizer. */
export function gitPiece(g: { branch: string; changes: string; pr: string }, hue: number): Piece | null {
  if (!g.branch && !g.changes && !g.pr) return null
  let x = 0
  let body = ''
  if (g.branch) {
    const b = fitText(g.branch, 12, 500, 160)
    body += `<g transform="translate(0 3)">${BRANCH}</g>` + txt(20, 10, b, 12, 500, 'f-strong')
    x = 20 + Math.ceil(textWidth(b, 12, 500))
  }
  if (g.changes) {
    body += txt(x + (x ? 6 : 0), 10, g.changes, 12, 400, 'f-sec')
    x += (x ? 6 : 0) + Math.ceil(textWidth(g.changes, 12, 400))
  }
  if (g.pr) {
    const pw = Math.ceil(textWidth(g.pr, 12, 500)) + 16
    const px = x + (x ? 8 : 0)
    body += `<rect x="${px}" width="${pw}" height="20" rx="10" class="f-s3"/>` + txt(px + 8, 10, g.pr, 12, 500, 'f-sec')
    x = px + pw
  }
  return { source: svg(x, 20, body, hue), width: x, height: 20 }
}

// ---- peças soltas da faixa nativa ----
// O Desktop encolhe um SVG largo para caber (não corta): a faixa virou uma Box nativa com borda redonda e
// tinta translúcida, e só as peças de largura fixa são SVG (visto em 2026-11-15, a faixa larga saía minúscula).

/** A pílula de estado desta sessão (altura 28), com o contador âmbar antes dela na forma mínima. */
export function pillPiece(o: { status: Status; waitingWhat?: string; statusLabel: string; minimal: boolean; waiting: number }, hue: number): Piece {
  const attention = o.status === 'precisa'
  const border = attention ? 's-a6' : o.status === 'pronta' ? 's-p6' : 's-b6'
  const labelColor = attention ? 'f-a11' : o.status === 'pronta' ? 'f-p11' : 'f-sec'
  const pillW = o.minimal ? 28 : Math.ceil(10 + 14 + 6 + textWidth(o.statusLabel, 12, 500) + 10)
  let x = 0
  let body = ''
  if (o.minimal && o.waiting > 0) {
    const c = String(o.waiting)
    const cw = Math.ceil(10 + 14 + 6 + textWidth(c, 12, 500) + 10)
    body += `<rect x=".5" y=".5" width="${cw - 1}" height="27" rx="5.5" class="f-s3 s-a6"/>` + icon('approve', 10, 7) + txt(10 + 14 + 6, 14, c, 12, 500, 'f-a11')
    x = cw + 8
  }
  body += `<rect x="${x + 0.5}" y=".5" width="${pillW - 1}" height="27" rx="5.5" class="f-s3 ${border}"/>`
  const kind = statusIcon(o.status, o.waitingWhat)
  body += o.minimal ? icon(kind, x + 7, 7) : icon(kind, x + 10, 7) + txt(x + 10 + 14 + 6, 14, o.statusLabel, 12, 500, labelColor)
  const w = x + pillW
  return { source: svg(w, 28, body, hue), width: w, height: 28 }
}

/**
 * Divisória de 1 × 16 na cor de borda do projeto (entre o número e o assunto), num SVG de 5 px de largura:
 * com 1 px o Desktop arredondava a imagem e a linha sumia (visto em 2026-11-15).
 */
export function dividerPiece(hue: number): Piece {
  return { source: svg(5, 16, '<rect x="2" width="1" height="16" class="f-p6"/>', hue), width: 5, height: 16 }
}

/** O ícone de branch do Git, 14 × 14. */
export function branchIconPiece(hue: number): Piece {
  return { source: svg(14, 14, BRANCH, hue), width: 14, height: 14 }
}

// ---- ícone e número soltos (painel) ----

export function statusIconPiece(status: Status, waitingWhat: string | undefined, hue: number): Piece {
  const k = statusIcon(status, waitingWhat)
  return { source: svg(14, 14, icon(k, 0, 0), hue), width: 14, height: 14 }
}

export function amberIconPiece(kind: IconKind, hue: number): Piece {
  return { source: svg(14, 14, icon(kind, 0, 0), hue), width: 14, height: 14 }
}
