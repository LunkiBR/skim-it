// Testes dos leitores do painel do Git (hooks/gitinfo.ts).
// Uso: node --import ./scripts/register.mjs scripts/check-git.mjs
import assert from 'node:assert/strict'
import { parseStatus, parseBranches, parsePrs, ciMark } from '../hooks/gitinfo.ts'

const cases = []
const test = (name, fn) => cases.push([name, fn])

test('status: código e caminho; renomeado mostra o destino; linha curta some', () => {
  const f = parseStatus(' M hooks/band.tsx\n?? novo.ts\nR  velho.ts -> novo2.ts\n\n')
  assert.deepEqual(f, [{ status: 'M', path: 'hooks/band.tsx' }, { status: '??', path: 'novo.ts' }, { status: 'R', path: 'novo2.ts' }])
})

test('branches: nome, quando e a atual', () => {
  const b = parseBranches('main\t2 hours ago\t*\nfeat/x\t3 days ago\t \n')
  assert.deepEqual(b, [{ name: 'main', when: '2 hours ago', current: true }, { name: 'feat/x', when: '3 days ago', current: false }])
})

test('PRs: lista e um só; CI; URL só https; lixo vira vazio', () => {
  const list = parsePrs(JSON.stringify([
    { number: 14, title: 'Band v4', state: 'OPEN', isDraft: false, headRefName: 'band', url: 'https://github.com/a/b/pull/14', statusCheckRollup: [{ conclusion: 'SUCCESS' }] },
    { number: 9, title: 'x', state: 'OPEN', isDraft: true, url: 'javascript:alert(1)', statusCheckRollup: [{ conclusion: 'FAILURE' }] },
  ]))
  assert.equal(list.length, 2)
  assert.equal(list[0].ci, 'pass')
  assert.equal(list[1].ci, 'fail')
  assert.equal(list[1].url, '')
  assert.equal(list[1].draft, true)
  assert.equal(parsePrs(JSON.stringify({ number: 3, title: 't', state: 'OPEN', statusCheckRollup: [] }))[0].num, 3)
  assert.deepEqual(parsePrs('no pull requests found'), [])
  assert.equal(ciMark('pass'), '✓')
  assert.equal(ciMark(''), '')
})

let failed = 0
for (const [name, fn] of cases) {
  try {
    fn()
  } catch (error) {
    failed++
    console.log('FALHA ' + name + '\n' + error.message)
  }
}
console.log(failed ? failed + ' falha(s)' : cases.length + ' ok')
process.exit(failed ? 1 : 0)
