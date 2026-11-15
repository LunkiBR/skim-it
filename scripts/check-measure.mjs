// Testes da medida de texto do SVG (hooks/measure.ts).
// Uso: node --import ./scripts/register.mjs scripts/check-measure.mjs
import assert from 'node:assert/strict'
import { textWidth, fitText } from '../hooks/measure.ts'

const cases = []
const test = (name, fn) => cases.push([name, fn])

test('letras estreitas medem menos que largas, e o peso aumenta a largura', () => {
  assert.ok(textWidth('iiii', 13) < textWidth('nnnn', 13))
  assert.ok(textWidth('nnnn', 13) < textWidth('mmmm', 13))
  assert.ok(textWidth('Sessão', 13, 600) > textWidth('Sessão', 13, 400))
  assert.ok(textWidth('abc', 13) > textWidth('abc', 12))
  assert.equal(textWidth('', 13), 0)
})

test('acento mede como a letra base, e o desconhecido tem largura', () => {
  assert.equal(textWidth('ã', 13), textWidth('a', 13))
  assert.ok(textWidth('日本', 13) > 0)
})

test('ordem de grandeza: 20 letras em 13 px ficam entre 110 e 150 px', () => {
  const w = textWidth('aaaaaaaaaaaaaaaaaaaa', 13)
  assert.ok(w > 110 && w < 150, String(w))
})

test('fitText: devolve igual quando cabe, nunca passa do limite e termina em reticências', () => {
  const t = 'Implementar a band v4 e o cartão de ajustes do skim-it'
  assert.equal(fitText(t, 13, 400, 9999), t)
  for (const max of [10, 40, 80, 150, 300]) {
    const out = fitText(t, 13, 400, max)
    assert.ok(textWidth(out, 13, 400) <= max, `${max}: ${out}`)
    if (out) assert.ok(out.endsWith('…'), out)
  }
  assert.equal(fitText(t, 13, 400, 3), '')
})

let failed = 0
for (const [name, fn] of cases) {
  try {
    fn()
    console.log('ok   ' + name)
  } catch (error) {
    failed++
    console.log('FALHA ' + name + '\n' + error.message)
  }
}
console.log(failed ? failed + ' falha(s)' : cases.length + ' ok')
process.exit(failed ? 1 : 0)
