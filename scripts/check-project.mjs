// Testes da cor por projeto (hooks/project.ts, lookgen.ts, importer.ts).
// Uso: node --import ./scripts/register.mjs scripts/check-project.mjs
import assert from 'node:assert/strict'
import { oklch } from '../hooks/color.ts'
import { parseConfig, hexToOklch, projectHue, areaFor, sessionTone, relPath, FALLBACK_HUES } from '../hooks/project.ts'
import { projectLook, contrast } from '../hooks/lookgen.ts'
import { proposeConfig, rootRefusal } from '../hooks/importer.ts'

const cases = []
const test = (name, fn) => cases.push([name, fn])
const dh = (a, b) => Math.abs(((a - b + 540) % 360) - 180)

test('parseConfig válido', () => {
  const { config, errors } = parseConfig('{"tipo":"projeto","marca":{"primaria":"#4b63ce","neutra":"#222222"},"areas":[{"caminho":"web/**","intensidade":"vibrante"}]}')
  assert.deepEqual(errors, [])
  assert.equal(config.marca.primaria, '#4b63ce')
})
test('parseConfig rejeita hex ruim, chave desconhecida, tipo errado, JSON quebrado', () => {
  assert.ok(parseConfig('{"tipo":"projeto","marca":{"primaria":"azul"}}').errors.some(e => /hex/.test(e)))
  assert.ok(parseConfig('{"tipo":"projeto","cor":1}').errors.some(e => /desconhecida/.test(e)))
  assert.ok(parseConfig('{"tipo":"time"}').errors.some(e => /tipo/.test(e)))
  assert.ok(parseConfig('{"tipo":"projeto","areas":[{"caminho":"a","intensidade":"x"}]}').errors.length)
  assert.equal(parseConfig('{').config, null)
  assert.equal(parseConfig('[]').config, null)
})
test('hexToOklch ida e volta com color.ts', () => {
  for (const [L, C, H] of [[0.62, 0.15, 250], [0.7, 0.1, 30], [0.5, 0.12, 128], [0.8, 0.05, 330]]) {
    const o = hexToOklch(oklch(L, C, H))
    assert.ok(Math.abs(o.L - L) < 0.01 && Math.abs(o.C - C) < 0.01 && dh(o.H, H) < 2, `${L} ${C} ${H}`)
  }
})
test('projectHue: arquivo, hash estável, paleta longe dos reservados', () => {
  assert.ok(dh(projectHue({ tipo: 'projeto', marca: { primaria: '#2f8adc' } }, 'x'), hexToOklch('#2f8adc').H) < 0.01)
  assert.ok(FALLBACK_HUES.includes(projectHue(null, 'C:\\Projetos\\familia')))
  assert.ok(FALLBACK_HUES.includes(projectHue(null, 'c:/projetos/liga-ia')))
  assert.equal(projectHue(null, '/a/b'), projectHue(null, '/a/b'))
  assert.ok(new Set(['/a', '/b', '/c', '/d', '/e', '/f', '/g', '/h', '/i', '/j'].map(k => projectHue(null, k))).size > 3)
  assert.ok(FALLBACK_HUES.length >= 8 && FALLBACK_HUES.length <= 10)
  for (const h of FALLBACK_HUES) for (const r of [29, 85, 142]) assert.ok(dh(h, r) >= 35, `${h} perto de ${r}`)
})
test('rootRefusal: raiz dentro de .git é recusada', () => {
  assert.ok(rootRefusal('C:/repo/.git/modules/sub'))
  assert.ok(rootRefusal('C:\\repo\\.git'))
  assert.equal(rootRefusal('C:/repo/.github'), undefined)
  assert.equal(rootRefusal('C:/repo'), undefined)
})
test('areaFor com **, * e ?', () => {
  const c = { tipo: 'projeto', areas: [{ caminho: 'web/**', intensidade: 'vibrante' }, { caminho: 'api/*.ts', intensidade: 'denso' }, { caminho: 'x/?.md', intensidade: 'denso' }] }
  assert.equal(areaFor(c, 'web/a/b.tsx').intensidade, 'vibrante')
  assert.equal(areaFor(c, 'api/s.ts').intensidade, 'denso')
  assert.equal(areaFor(c, 'api/sub/s.ts'), undefined)
  assert.ok(areaFor(c, 'x/a.md') && !areaFor(c, 'x/ab.md'))
  assert.ok(areaFor(c, 'web\\z.css'))
  assert.equal(areaFor(null, 'a'), undefined)
})
test('sessionTone: separação de 12 pontos e repetição', () => {
  for (const total of [1, 2, 3, 4]) {
    const Ls = Array.from({ length: total }, (_, i) => sessionTone(i, total).L).sort()
    for (let i = 1; i < Ls.length; i++) assert.ok(Ls[i] - Ls[i - 1] >= 0.12, `total ${total}`)
  }
  assert.equal(sessionTone(4, 6).L, sessionTone(0, 6).L)
})
test('importer: tailwind, variáveis CSS, tokens, SKILL.md, package.json', () => {
  const tw = proposeConfig([{ path: 'tailwind.config.js', text: "theme:{extend:{colors:{brand:{DEFAULT:'#e5322d'}, primary:'#1e6bd6', accent:'#ff9900', gray:'#888888'}}}" }])
  assert.equal(tw.config.marca.primaria, '#1e6bd6')
  assert.equal(tw.config.marca.secundaria, '#ff9900')
  assert.ok(tw.evidence.some(e => e.startsWith('tailwind.config.js:')))
  const css = proposeConfig([{ path: 'src/app.css', text: ':root{--primary:#0a7;--text:#111111;--color-accent:#d0f}' }])
  assert.equal(css.config.marca.primaria, '#00aa77')
  const tok = proposeConfig([{ path: 'tokens.json', text: '{"color":{"brand":{"500":{"$value":"#7c3aed","$type":"color"}},"bg":{"$value":"#ffffff"}}}' }])
  assert.equal(tok.config.marca.primaria, '#7c3aed')
  const md = proposeConfig([{ path: 'SKILL.md', text: '# Identidade\n\nCor primária: #4B63CE\nFundo #ffffff' }])
  assert.equal(md.config.marca.primaria, '#4b63ce')
  const pkg = proposeConfig([{ path: 'package.json', text: '{"brand":{"color":"#12a150"}}' }, { path: 'README.md', text: 'brand color #4b63ce' }])
  assert.equal(pkg.config.marca.primaria, '#12a150')
  const none = proposeConfig([{ path: 'a.css', text: 'a{color:#333}' }])
  assert.equal(none.config.marca, undefined)
  assert.deepEqual(none.evidence, [])
})
test("projectLook: metas de contraste, croma e sem 'Desktop won't paint'", () => {
  const chroma = hex => hexToOklch(hex).C
  for (const hue of [0, 30, 60, 128, 200, 250, 300, 350])
    for (const intensidade of [undefined, 'vibrante', 'denso']) {
      const { anchors, problems, theme } = projectLook(hue, { intensidade })
      const tag = `matiz ${hue} ${intensidade ?? ''}`
      assert.ok(theme, tag)
      assert.equal(problems.find(p => p.startsWith("Desktop won't paint")), undefined, tag)
      for (const [mode, a] of Object.entries(anchors)) {
        for (const s of ['surface-0', 'surface-1', 'surface-2', 'surface-3']) {
          assert.ok(contrast(a['text-primary'], a[s]) >= 7, `${tag} ${mode} primário em ${s}`)
          const k = chroma(a[s])
          assert.ok(k >= 0.003 && k <= 0.03, `${tag} ${mode} ${s} croma ${k.toFixed(4)}`)
        }
        for (const s of ['surface-0', 'surface-2']) assert.ok(contrast(a['text-muted'], a[s]) >= 4.5, `${tag} ${mode} apagado em ${s}`)
      }
    }
  assert.equal(projectLook(250, { accentHex: '#4b63ce' }).roles.accent, '#4b63ce')
})

test('relPath: dentro, na raiz, fora; Windows sem diferenciar maiúsculas e com barra invertida', () => {
  assert.equal(relPath('/r/a', '/r/a/web/src'), 'web/src')
  assert.equal(relPath('/r/a/', '/r/a'), '')
  assert.equal(relPath('/r/a', '/r/ab/x'), null)
  assert.equal(relPath('/r/a', '/r/b'), null)
  assert.equal(relPath('c:/users/x/p', String.raw`C:\Users\x\p\web\a`), 'web/a')
  assert.equal(relPath('c:/users/x/p', String.raw`D:\other`), null)
})

let failed = 0
for (const [name, fn] of cases) {
  try { fn(); console.log('ok ' + name) } catch (e) { failed++; console.log('FALHA ' + name + '\n  ' + e.message) }
}
console.log(failed ? `${failed} falha(s)` : `${cases.length} testes ok`)
process.exit(failed ? 1 : 0)
