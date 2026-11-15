// Testes do quebrador de markdown (hooks/blocks.ts). Uso: node scripts/check-blocks.mjs
import assert from 'node:assert/strict'
import { splitBlocks, plain, absolutize } from '../hooks/blocks.ts'

const cases = []
const test = (name, fn) => cases.push([name, fn])

test('sem título, o app desenha como sempre', () => {
  assert.equal(splitBlocks('Só um parágrafo.\n\n- e uma lista'), null)
})

test('títulos e régua antes de cada ##, menos o primeiro bloco', () => {
  const out = splitBlocks('Resumo em uma frase.\n\n## Primeira\n\nTexto um.\n\n## Segunda\n\nTexto dois.')
  assert.deepEqual(out.map(b => b.kind), ['markdown', 'rule', 'heading', 'markdown', 'rule', 'heading', 'markdown'])
  assert.equal(out[2].text, 'Primeira')
})

test('resposta que começa com ## não ganha régua no topo', () => {
  const out = splitBlocks('## Começo\n\nTexto.')
  assert.equal(out[0].kind, 'heading')
})

test('# não ganha régua; ### fica no markdown', () => {
  const out = splitBlocks('# Título\n\nTexto.\n\n### Menor\n\nMais.')
  assert.deepEqual(out.map(b => b.kind), ['heading', 'markdown'])
  assert.match(out[1].text, /### Menor/)
})

test('cerquilha dentro de cerca de código não é título', () => {
  const md = 'Antes.\n\n```bash\n# comentário\n## outro\n```\n\n## Depois\n\nFim.'
  const out = splitBlocks(md)
  assert.deepEqual(out.map(b => b.kind), ['markdown', 'rule', 'heading', 'markdown'])
  assert.match(out[0].text, /# comentário/)
})

test('cerca de til e cerca mais longa fecham certo', () => {
  const md = '~~~~\n## não\n~~~\n## ainda não\n~~~~\n\n## sim'
  const out = splitBlocks(md)
  assert.equal(out.filter(b => b.kind === 'heading').length, 1)
  assert.equal(out.find(b => b.kind === 'heading').text, 'sim')
})

test('cerquilhas de fecho e marcas inline saem do título', () => {
  const out = splitBlocks('## O **novo** `look` ##\n\nx')
  assert.equal(out[0].text, 'O novo look')
  assert.equal(plain('um *dois* três'), 'um dois três')
})

test('#sem espaço não é título', () => {
  assert.equal(splitBlocks('#hashtag e texto'), null)
})

test('--- antes de ## não vira régua dupla', () => {
  const out = splitBlocks('Intro.\n\n---\n\n## Próxima\n\nTexto.')
  assert.deepEqual(out.map(b => b.kind), ['markdown', 'rule', 'heading', 'markdown'])
  assert.equal(out[0].text, 'Intro.')
})

test('--- colado no texto é título setext e fica', () => {
  const out = splitBlocks('Título setext\n---\n\n## Próxima')
  assert.match(out[0].text, /---/)
})

test('## logo abaixo de # não ganha régua', () => {
  const out = splitBlocks('# Título\n\n## Seção\n\nTexto.')
  assert.deepEqual(out.map(b => b.kind), ['heading', 'heading', 'markdown'])
})

test('plain protege código e tira link', () => {
  assert.equal(plain('O método `__init__`'), 'O método __init__')
  assert.equal(plain('Veja [docs](hooks/x.ts)'), 'Veja docs')
  assert.equal(plain('a * b * c'), 'a * b * c')
  assert.equal(plain('um **dois** e *três*'), 'um dois e três')
})

test('fecho de cerca com informação não fecha; abertura com crase inline não abre', () => {
  const md = '```js\ncódigo\n```js\n# ainda código\n```\n\n## Fora'
  const out = splitBlocks(md)
  assert.equal(out.filter(b => b.kind === 'heading').length, 1)
  assert.equal(splitBlocks('Texto com ```inline``` aqui.\n\n## Título').filter(b => b.kind === 'heading').length, 1)
})

test('título recuado dentro de lista fica na lista', () => {
  assert.equal(splitBlocks('- item\n  ## não é seção\n- outro'), null)
})

test('HTML de bloco, definição de link e rodapé desligam a quebra', () => {
  assert.equal(splitBlocks('## A\n\n<details>\n\n## B\n\n</details>'), null)
  assert.equal(splitBlocks('## A\n\n[ref]: https://x.y\n\nTexto [ref].'), null)
  assert.equal(splitBlocks('## A\n\nNota[^1].\n\n[^1]: rodapé'), null)
})

test('HTML dentro de código não desliga', () => {
  const out = splitBlocks('## A\n\n```html\n<div>x</div>\n```\n\nUse `Array<string>`.')
  assert.ok(out)
})

test('CRLF funciona', () => {
  assert.equal(splitBlocks('## A\r\n\r\nTexto.').length, 2)
})

test('link relativo vira file:/// e o resto fica', () => {
  const md = 'Ver [x](hooks/x.ts#L10), [w](https://a.b), [s](#sec) e `[c](d)`.\n```\n[e](f)\n```'
  const out = absolutize(md, 'C:\\Users\\leo\\repo')
  assert.match(out, /\[x\]\(file:\/\/\/C:\/Users\/leo\/repo\/hooks\/x\.ts#L10\)/)
  assert.match(out, /\[w\]\(https:\/\/a\.b\)/)
  assert.match(out, /\[s\]\(#sec\)/)
  assert.match(out, /`\[c\]\(d\)`/)
  assert.match(out, /\n\[e\]\(f\)\n/)
})

let failed = 0
for (const [name, fn] of cases) {
  try { fn(); console.log('ok   ' + name) } catch (error) { failed++; console.log('FALHA ' + name + '\n  ' + error.message) }
}
console.log(failed ? `${failed} falha(s)` : `${cases.length} ok`)
process.exit(failed ? 1 : 0)
