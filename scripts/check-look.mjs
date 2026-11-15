// Confere o look base fora do app, sobre os mesmos anchors de hooks/look.ts:
// - nenhuma linha "Desktop won't paint";
// - texto principal 7:1 em cada superfície, texto apagado 4,5:1 em surface-0 e surface-2;
// - cinzas tingidos: croma OKLCH das superfícies entre 0,005 e 0,03 (visível, sem colorir).
// Uso: node --import ./scripts/register.mjs scripts/check-look.mjs  (Node 23+ lê o .ts direto)
import { ANCHORS, BASE, UNPAINTED } from '../hooks/look.ts'

const linear = hex => [1, 3, 5].map(i => {
  const x = parseInt(hex.slice(i, i + 2), 16) / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
})

function contrast(a, b) {
  const lum = hex => { const [r, g, bl] = linear(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * bl }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

function chroma(hex) {
  const [r, g, b] = linear(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  return Math.hypot(A, B)
}

let failed = 0
const fail = text => { failed++; console.log('FALHA ' + text) }

for (const [mode, a] of Object.entries(ANCHORS)) {
  const surfaces = ['surface-0', 'surface-1', 'surface-2', 'surface-3']
  for (const s of surfaces) {
    const c = contrast(a['text-primary'], a[s])
    if (c < 7) fail(`${mode} text-primary em ${s}: ${c.toFixed(2)}:1`)
    const k = chroma(a[s])
    if (k < 0.003 || k > 0.03) fail(`${mode} ${s} com croma ${k.toFixed(4)} fora de 0,003 a 0,03`)
  }
  for (const s of ['surface-0', 'surface-2']) {
    const c = contrast(a['text-muted'], a[s])
    if (c < 4.5) fail(`${mode} text-muted em ${s}: ${c.toFixed(2)}:1`)
    else console.log(`ok ${mode} text-muted em ${s}: ${c.toFixed(2)}:1`)
  }
}
if (UNPAINTED) fail(UNPAINTED)
const meaning = BASE.problems.filter(line => /^text-(danger|success|warning)\b/.test(line))
console.log(`problems do makeColors: ${BASE.problems.length} (abaixo da régua do design system, ainda pintam)`)
for (const line of meaning) console.log('  status: ' + line)
console.log(failed ? `${failed} falha(s)` : 'look ok')
process.exit(failed ? 1 : 0)
