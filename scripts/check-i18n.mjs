// Testes do idioma (hooks/i18n.ts): resolução, tabelas, palavra mais perto e leitura dos comandos.
// Uso: node --import ./scripts/register.mjs scripts/check-i18n.mjs
import assert from 'node:assert/strict'
import { resolveLang, TABLES, tr, cnt, nearest, levenshtein, parseCommand, unknownText, commandWords } from '../hooks/i18n.ts'

const cases = []
const test = (name, fn) => cases.push([name, fn])

test('resolveLang: a escolha do mod vence', () => {
  assert.equal(resolveLang('pt', 'english', 'en-US'), 'pt')
  assert.equal(resolveLang('en', 'português', 'pt-BR'), 'en')
})

test('resolveLang: sem escolha, vale o language do Claude Code (texto livre)', () => {
  for (const s of ['portuguese', 'pt-BR', 'Português', 'PT', 'Portugues brasileiro']) assert.equal(resolveLang(undefined, s, 'en-US'), 'pt', s)
  for (const s of ['english', 'en', 'en-GB', 'Inglês', 'English (US)']) assert.equal(resolveLang('auto', s, 'pt-BR'), 'en', s)
})

test('resolveLang: sem language reconhecido, vale o locale; senão en', () => {
  assert.equal(resolveLang(undefined, undefined, 'pt-BR'), 'pt')
  assert.equal(resolveLang(null, 'spanish', 'pt-PT'), 'pt')
  assert.equal(resolveLang(undefined, '', 'en-US'), 'en')
  assert.equal(resolveLang(undefined, undefined, 'de-DE'), 'en')
  assert.equal(resolveLang(undefined, undefined, undefined), 'en')
})

test('as tabelas pt e en têm as mesmas chaves e nenhuma vazia', () => {
  const pt = Object.keys(TABLES.pt).sort()
  const en = Object.keys(TABLES.en).sort()
  assert.deepEqual(pt, en)
  for (const lang of ['pt', 'en']) for (const [k, v] of Object.entries(TABLES[lang])) assert.ok(v.length > 0, lang + ' ' + k)
})

test('as tabelas usam as mesmas {variáveis} e não têm travessão', () => {
  const vars = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')
  for (const k of Object.keys(TABLES.pt)) {
    assert.equal(vars(TABLES.pt[k]), vars(TABLES.en[k]), k)
    assert.ok(!TABLES.pt[k].includes(String.fromCharCode(0x2014)) && !TABLES.en[k].includes(String.fromCharCode(0x2014)), k)
  }
})

test('tr troca {var}; cnt escolhe singular e plural', () => {
  assert.equal(tr('en', 'work.worked', { time: '5s' }), 'Worked 5s')
  assert.equal(tr('pt', 'band.waiting', { n: 2 }), '2 esperando')
  assert.equal(cnt('en', 1, 'step'), '1 step')
  assert.equal(cnt('en', 2, 'step'), '2 steps')
  assert.equal(cnt('pt', 1, 'turn'), '1 turno')
})

test('nearest: a palavra de comando mais perto nas duas línguas', () => {
  assert.equal(levenshtein('densiade', 'densidade'), 1)
  assert.equal(nearest('densiade', commandWords('pt')), 'densidade')
  assert.equal(nearest('densiy', commandWords('en')), 'density')
  assert.equal(nearest('typografy', commandWords('pt')), 'typography')
  assert.equal(nearest('tipografa', commandWords('en')), 'tipografia')
  assert.equal(nearest('painal', commandWords('pt')), 'painel')
  assert.equal(nearest('imporar', commandWords('pt')), 'importar')
  assert.equal(nearest('xyzxyzxyz', commandWords('pt')), undefined)
})

test('parseCommand: comandos nas duas línguas', () => {
  assert.deepEqual(parseCommand('', 'pt'), { cmd: 'ajustes' })
  assert.deepEqual(parseCommand('  settings ', 'en'), { cmd: 'ajustes' })
  assert.deepEqual(parseCommand('ajuda', 'pt'), { cmd: 'ajuda' })
  assert.deepEqual(parseCommand('help', 'en'), { cmd: 'ajuda' })
  assert.deepEqual(parseCommand('tipografia on', 'pt'), { cmd: 'tipografia', on: true })
  assert.deepEqual(parseCommand('typography off', 'en'), { cmd: 'tipografia', on: false })
  assert.deepEqual(parseCommand('look desligado', 'pt'), { cmd: 'look', on: false })
  assert.deepEqual(parseCommand('densidade detalhado', 'pt'), { cmd: 'densidade', value: 'detalhado' })
  assert.deepEqual(parseCommand('density balanced', 'en'), { cmd: 'densidade', value: 'equilibrado' })
  assert.deepEqual(parseCommand('painel', 'pt'), { cmd: 'painel' })
  assert.deepEqual(parseCommand('panel', 'en'), { cmd: 'painel' })
  assert.deepEqual(parseCommand('fundo segue off', 'pt'), { cmd: 'fundo', on: false })
  assert.deepEqual(parseCommand('background follows on', 'en'), { cmd: 'fundo', on: true })
  assert.deepEqual(parseCommand('importar', 'pt'), { cmd: 'importar', mode: 'propor' })
  assert.deepEqual(parseCommand('import approve', 'en'), { cmd: 'importar', mode: 'aprovar' })
  assert.deepEqual(parseCommand('importar aprovar!', 'pt'), { cmd: 'importar', mode: 'aprovar!' })
  assert.deepEqual(parseCommand('import approve!', 'en'), { cmd: 'importar', mode: 'aprovar!' })
  assert.deepEqual(parseCommand('idioma pt', 'pt'), { cmd: 'idioma', value: 'pt' })
  assert.deepEqual(parseCommand('language English', 'en'), { cmd: 'idioma', value: 'en' })
  assert.deepEqual(parseCommand('idioma auto', 'pt'), { cmd: 'idioma', value: 'auto' })
})

test('parseCommand: comando sem valor abre os ajustes; palavra desconhecida diz a mais perto', () => {
  assert.deepEqual(parseCommand('densidade', 'pt'), { cmd: 'ajustes' })
  assert.deepEqual(parseCommand('densiade', 'pt'), { cmd: 'desconhecido', word: 'densiade', near: 'densidade' })
  assert.deepEqual(parseCommand('densidade compat', 'pt'), { cmd: 'desconhecido', word: 'compat', scope: 'densidade', near: 'compact' })
  assert.deepEqual(parseCommand('tipografia talvez', 'pt'), { cmd: 'desconhecido', word: 'talvez', scope: 'tipografia', near: undefined })
  assert.equal(parseCommand('qqqqqqqqqq', 'pt').near, undefined)
})

test('unknownText nas duas línguas', () => {
  const c = parseCommand('densiade', 'pt')
  assert.equal(unknownText('pt', c), 'Não conheço "densiade". Mais perto: densidade. Abri os ajustes.')
  assert.equal(unknownText('en', parseCommand('densiy', 'en')), 'I don\'t know "densiy". Closest: density. Opened the settings.')
  assert.equal(unknownText('pt', parseCommand('densidade compat', 'pt')), 'Não conheço "compat" em densidade. Mais perto: compact. Abri os ajustes.')
  assert.equal(unknownText('pt', parseCommand('qqqqqqqqqq', 'pt')), 'Não conheço "qqqqqqqqqq". Abri os ajustes.')
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
