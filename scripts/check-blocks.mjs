// Testes da reescrita de títulos (hooks/blocks.ts). Uso: node scripts/check-blocks.mjs
import assert from 'node:assert/strict'
import { sections } from '../hooks/blocks.ts'

const cases = []
const test = (name, fn) => cases.push([name, fn])

test('sem título, o app desenha como sempre', () => {
  assert.equal(sections('Só um parágrafo.\n\n- e uma lista'), null)
})

test('## vira # com régua antes de cada seção, menos no topo', () => {
  assert.equal(
    sections('Resumo em uma frase.\n\n## Primeira\n\nTexto um.\n\n## Segunda\n\nTexto dois.'),
    'Resumo em uma frase.\n\n---\n\n# Primeira\n\nTexto um.\n\n---\n\n# Segunda\n\nTexto dois.',
  )
})

test('resposta que começa com ## não ganha régua no topo', () => {
  assert.equal(sections('## Começo\n\nTexto.'), '# Começo\n\nTexto.')
})

test('# fica #, sem régua; ### fica como está', () => {
  assert.equal(sections('# Título\n\nTexto.\n\n### Menor\n\nMais.'), '# Título\n\nTexto.\n\n### Menor\n\nMais.')
})

test('cerquilha dentro de cerca de código não é título', () => {
  const out = sections('Antes.\n\n```bash\n# comentário\n## outro\n```\n\n## Depois\n\nFim.')
  assert.equal(out, 'Antes.\n\n```bash\n# comentário\n## outro\n```\n\n---\n\n# Depois\n\nFim.')
})

test('cerca de til e cerca mais longa fecham certo', () => {
  const out = sections('~~~~\n## não\n~~~\n## ainda não\n~~~~\n\n## sim')
  assert.equal(out.match(/^# /gm).length, 1)
  assert.match(out, /~~~~\n\n---\n\n# sim$/)
})

test('cerquilhas de fecho saem; marcas inline ficam para o app', () => {
  assert.equal(sections('## O **novo** `look` ##\n\nx'), '# O **novo** `look`\n\nx')
})

test('#sem espaço não é título', () => {
  assert.equal(sections('#hashtag e texto'), null)
})

test('--- antes de ## não vira régua dupla', () => {
  assert.equal(sections('Intro.\n\n---\n\n## Próxima\n\nTexto.'), 'Intro.\n\n---\n\n# Próxima\n\nTexto.')
})

test('--- colado no texto é título setext e fica, sem régua a mais', () => {
  assert.equal(sections('Título setext\n---\n\n## Próxima'), 'Título setext\n---\n\n# Próxima')
})

test('## logo abaixo de # não ganha régua', () => {
  assert.equal(sections('# Título\n\n## Seção\n\nTexto.'), '# Título\n\n# Seção\n\nTexto.')
})

test('fecho de cerca com informação não fecha; abertura com crase inline não abre', () => {
  const out = sections('```js\ncódigo\n```js\n# ainda código\n```\n\n## Fora')
  assert.equal(out.match(/^# /gm).length, 2)
  assert.match(out, /^# Fora$/m)
  assert.match(sections('Texto com ```inline``` aqui.\n\n## Título'), /\n---\n\n# Título$/)
})

test('título recuado dentro de lista fica na lista', () => {
  assert.equal(sections('- item\n  ## não é seção\n- outro'), null)
})

test('HTML, definição de link e rodapé ficam intactos', () => {
  assert.equal(sections('## A\n\n[ref]: https://x.y\n\nTexto [ref].'), '# A\n\n[ref]: https://x.y\n\nTexto [ref].')
  assert.equal(sections('Nota[^1].\n\n## B\n\n[^1]: rodapé'), 'Nota[^1].\n\n---\n\n# B\n\n[^1]: rodapé')
})

test('CRLF funciona', () => {
  assert.equal(sections('## A\r\n\r\nTexto.'), '# A\n\nTexto.')
})

let failed = 0
for (const [name, fn] of cases) {
  try { fn(); console.log('ok   ' + name) } catch (error) { failed++; console.log('FALHA ' + name + '\n  ' + error.message) }
}
console.log(failed ? `${failed} falha(s)` : `${cases.length} ok`)
process.exit(failed ? 1 : 0)
