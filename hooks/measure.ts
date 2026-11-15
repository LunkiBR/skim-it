// Largura de texto para o SVG da band (v4): o Svg não mede texto, então o mod estima por uma tabela de
// larguras (em de um corpo, para uma sans de interface como Segoe UI, SF e Inter). Puro, sem `$`.
// shortcut: é uma estimativa (erro de poucos por cento); se o texto desenhado passar do espaço, ajuste a tabela.
// Testada em scripts/check-measure.mjs.

const W: Record<string, number> = {}
const put = (chars: string, em: number) => {
  for (const c of chars) W[c] = em
}
put(' ', 0.27)
put('il.,:;|!\'', 0.25)
put('jI', 0.26)
put('ft()[]{}', 0.33)
put('r-', 0.36)
put('/', 0.38)
put('sJ', 0.44)
put('cvxyzk', 0.5)
put('aeSEFLZ', 0.54)
put('0123456789', 0.57)
put('bdghnopqu', 0.59)
put('BPRTYX', 0.6)
put('ACDGHKNUV', 0.7)
put('O', 0.8)
put('w', 0.78)
put('mM', 0.87)
put('W', 0.96)
put('+=<>~', 0.6)
put('•·', 0.4)
put('…', 0.9)
put('#%&@', 0.8)
put('_', 0.5)
put('?', 0.5)
put('"', 0.38)

const WEIGHT: Record<number, number> = { 400: 1, 500: 1.015, 600: 1.04, 700: 1.065 }
const FALLBACK = 0.58

const base = (c: string) => c.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Largura estimada em px de `text` no corpo `size` e peso `weight` (400, 500, 600 ou 700). */
export function textWidth(text: string, size: number, weight = 400): number {
  let em = 0
  for (const c of text) em += W[base(c)] ?? W[c] ?? FALLBACK
  return em * size * (WEIGHT[weight] ?? 1)
}

/** Corta com reticências até caber em `max` px; devolve o próprio texto quando já cabe. */
export function fitText(text: string, size: number, weight: number, max: number): string {
  if (textWidth(text, size, weight) <= max) return text
  const chars = [...text]
  while (chars.length > 0 && textWidth(chars.join('').trimEnd() + '…', size, weight) > max) chars.pop()
  return chars.length === 0 ? '' : chars.join('').trimEnd() + '…'
}
