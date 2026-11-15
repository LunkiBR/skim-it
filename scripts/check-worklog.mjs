// Testes da lógica da linha de trabalho (hooks/worklog.ts).
// Uso: node --import ./scripts/register.mjs scripts/check-worklog.mjs
import assert from 'node:assert/strict'
import { textKey, KEY_CAP, norm, duration, summaryText, failureText, gist, editedFile, newLive, finish, owner, isFirstKey, keepLast, groupCounts } from '../hooks/worklog.ts'

const cases = []
const test = (name, fn) => cases.push([name, fn])

const turn = (over = {}) => ({ durationMs: 1000, steps: 1, failures: 0, files: 0, items: [], first: '', final: '', log: [], ...over })

test('norm junta espaços e corta em 4000', () => {
  assert.equal(norm('  a \n\n b\tc  '), 'a b c')
  assert.equal(norm('x'.repeat(5000)).length, 4000)
})

test('textKey guarda no máximo 300 caracteres normalizados; dono e primeiro item casam pelo mesmo corte', () => {
  const long = 'palavra '.repeat(100)
  assert.equal(textKey(long).length, 2 + KEY_CAP)
  assert.equal(textKey(' a \n b '), 't:a b')
  const key = textKey(long)
  const t = turn({ items: [key], first: key, final: 'outra coisa' })
  assert.equal(owner({ A: t }, textKey(long))[0], 'A')
  assert.ok(isFirstKey(t, textKey(long)))
  // trecho de uma narração longa (meio do texto) ainda acha o dono
  assert.equal(owner({ A: t }, 't:' + long.slice(8, 120).trim())?.[0], 'A')
  // a resposta final sai dos itens mesmo cortada
  const l = newLive('x', 0, new Set())
  l.items.push(textKey(long), 'u:1')
  assert.deepEqual(finish(l, long, 1).items, ['u:1'])
})

test('duration: s, m, h', () => {
  assert.equal(duration(0), '1s')
  assert.equal(duration(42_000), '42s')
  assert.equal(duration(477_000), '7m 57s')
  assert.equal(duration(3_600_000 + 5 * 60_000), '1h 5m')
})

test('summaryText e failureText com plural', () => {
  assert.equal(summaryText(turn({ durationMs: 477_000, steps: 54, files: 3 })), 'Trabalhou 7m 57s · 54 passos · 3 arquivos')
  assert.equal(summaryText(turn({ durationMs: 5000, steps: 1, files: 1 })), 'Trabalhou 5s · 1 passo · 1 arquivo')
  assert.equal(summaryText(turn({ steps: 2 })), 'Trabalhou 1s · 2 passos')
  assert.equal(failureText(1), '1 falha')
  assert.equal(failureText(3), '3 falhas')
})

test('summaryText e failureText em inglês', () => {
  assert.equal(summaryText(turn({ durationMs: 477_000, steps: 54, files: 3 }), 'en'), 'Worked 7m 57s · 54 steps · 3 files')
  assert.equal(summaryText(turn({ durationMs: 5000, steps: 1, files: 1 }), 'en'), 'Worked 5s · 1 step · 1 file')
  assert.equal(failureText(1, 'en'), '1 failure')
  assert.equal(failureText(3, 'en'), '3 failures')
})

test('gist: primeiro campo conhecido, uma linha, cortado', () => {
  assert.equal(gist({ command: 'ls  -la\n/tmp' }), 'ls -la /tmp')
  assert.equal(gist({ file_path: 'a.ts' }), 'a.ts')
  assert.equal(gist(null), '')
  const long = gist({ command: 'x'.repeat(200) })
  assert.equal(long.length, 90)
  assert.ok(long.endsWith('…'))
})

test('editedFile só para ferramentas de edição', () => {
  assert.equal(editedFile('Edit', { file_path: 'a.ts' }), 'a.ts')
  assert.equal(editedFile('NotebookEdit', { notebook_path: 'n.ipynb' }), 'n.ipynb')
  assert.equal(editedFile('Read', { file_path: 'a.ts' }), undefined)
  assert.equal(editedFile('Write', {}), undefined)
})

const liveWith = (items, blocks = {}, order = []) => {
  const l = newLive('T', 0, new Set())
  l.items = items
  l.blocks = blocks
  l.order = order
  l.steps = 3
  l.log = [{ kind: 'say', text: 'passo um' }, { kind: 'tool', tool: 'Bash', gist: 'ls', failed: false }, { kind: 'say', text: 'Resposta final.' }]
  return l
}

test('finish tira a resposta final dos itens e da lista', () => {
  const l = liveWith(['t:passo um', 'u:1', 't:Resposta final.'])
  const t = finish(l, 'Resposta final.', 9000)
  assert.deepEqual(t.items, ['t:passo um', 'u:1'])
  assert.equal(t.final, 'Resposta final.')
  assert.equal(t.log.length, 2)
  assert.equal(t.steps, 3)
  assert.equal(t.durationMs, 9000)
})

test('finish: bloco fora da resposta vira narração r:, trecho da resposta em streaming fica de fora', () => {
  const l = liveWith(['u:1'], { m1: 'Vou olhar o arquivo.', m2: 'Resposta' }, [])
  const t = finish(l, 'Resposta final.', 1)
  assert.deepEqual(t.items, ['u:1', 'r:m1'])
})

test('finish: first é o item desenhado mais cedo', () => {
  const l = liveWith(['t:passo um', 'u:1'], {}, ['u:1', 't:passo um'])
  assert.equal(finish(l, 'x', 1).first, 'u:1')
  const sem = liveWith(['t:passo um', 'u:1'], {}, ['u:9'])
  assert.equal(finish(sem, 'x', 1).first, 't:passo um')
})

test('finish: nada a recolher devolve null', () => {
  const l = newLive('T', 0, new Set())
  assert.equal(finish(l, 'só a resposta', 1), null)
  const l2 = liveWith(['t:só a resposta'])
  l2.log = []
  assert.equal(finish(l2, 'só a resposta', 1), null)
})

const doneTurns = () => ({
  A: turn({ items: ['u:1', 't:Agora vou ler os arquivos do projeto com calma'], first: 'u:1', final: 'A resposta final inteira do turno A aqui.' }),
})

test('owner: chave exata', () => {
  assert.equal(owner(doneTurns(), 'u:1')[0], 'A')
  assert.equal(owner(doneTurns(), 'u:2'), null)
})

test('owner: trecho de narração, nunca da resposta final', () => {
  assert.equal(owner(doneTurns(), 't:vou ler os arquivos do projeto')[0], 'A')
  assert.equal(owner(doneTurns(), 't:vou ler'), null)
  assert.equal(owner(doneTurns(), 't:A resposta final inteira do turno A'), null)
})

test('isFirstKey: exata ou começo de um t:', () => {
  const t = turn({ first: 't:Vou olhar o arquivo e depois mexer' })
  assert.ok(isFirstKey(t, 't:Vou olhar o arquivo'))
  assert.ok(!isFirstKey(t, 't:outra coisa'))
  assert.ok(isFirstKey(turn({ first: 'u:1' }), 'u:1'))
  assert.ok(!isFirstKey(turn({ first: 'u:1' }), 't:u:1'))
})

test('keepLast: limite de 60 e troca do mesmo id', () => {
  let all = {}
  for (let i = 0; i < 70; i++) all = keepLast(all, 'id' + i, turn({ steps: i }))
  assert.equal(Object.keys(all).length, 60)
  assert.ok(!('id9' in all))
  assert.ok('id10' in all)
  all = keepLast(all, 'id30', turn({ steps: 99 }))
  assert.equal(Object.keys(all).length, 60)
  assert.equal(all.id30.steps, 99)
  assert.equal(Object.keys(all).at(-1), 'id30')
})

test('groupCounts agrupa e conta', () => {
  assert.equal(groupCounts(['Bash', 'Edit', 'Bash', 'Bash']), 'Bash ×3 · Edit')
  assert.equal(groupCounts([]), '')
})

let failed = 0
for (const [name, fn] of cases) {
  try {
    fn()
    console.log('ok     ' + name)
  } catch (error) {
    failed += 1
    console.log('FALHA  ' + name + '\n       ' + String(error.message).split('\n').join('\n       '))
  }
}
console.log(failed === 0 ? '\n' + cases.length + ' testes ok' : '\n' + failed + ' de ' + cases.length + ' falharam')
process.exit(failed === 0 ? 0 : 1)
