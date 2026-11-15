// Testes do sistema de cor v4 (hooks/v4.ts): contraste dos números, tintas e o SVG com as duas paletas.
// Uso: node --import ./scripts/register.mjs scripts/check-v4.mjs
import assert from 'node:assert/strict'
import { faixa, faixaParts, FAIXA_LEFT_W, planFleet, tierOf, statusIcon, fleetPiece, gitPiece } from '../hooks/desenho.ts'
import { demoPeers, sessionStatus } from '../hooks/fleetcore.ts'
import { ambientScene } from '../hooks/ambient.ts'
import { textWidth } from '../hooks/measure.ts'
import { tokens, numeral, contrast, inkFor, svg, icon, themeAnchors, PRIMARY_NEUTRAL } from '../hooks/v4.ts'

const cases = []
const test = (name, fn) => cases.push([name, fn])
const HUES = [0, 30, 60, 85, 128, 185, 200, 250, 300, 350]

test('números da sessão: 4,5:1 sobre app, s2, s3, s4 e project/3 nos dois modos (10 sessões, todos os matizes)', () => {
  for (const dark of [true, false])
    for (const hue of HUES) {
      const k = tokens(hue, dark)
      for (let i = 0; i < 10; i++)
        for (const bg of ['app', 's2', 's3', 's4', 'p3']) {
          const c = contrast(k['n' + i], k[bg])
          assert.ok(c >= 4.5, `${dark ? 'escuro' : 'claro'} matiz ${hue} sessão ${i + 1} sobre ${bg}: ${c.toFixed(2)}:1`)
        }
    }
})

test('os neutros sobem no escuro e descem no claro; a décima sessão é neutra', () => {
  const d = tokens(250, true)
  const l = tokens(250, false)
  assert.ok(d.app < d.s2 && d.s2 < d.s3 && d.s3 < d.s4 && d.s4 < d.s5 && d.s5 < d.b6)
  assert.ok(l.app < l.s2 && l.s2 > l.s3 && l.s3 > l.s4 && l.s4 > l.s5 && l.s5 > l.b6)
  assert.equal(numeral(9, true), numeral(12, true))
  assert.notEqual(numeral(0, true), numeral(1, true))
})

test('texto: forte, secundário e fraco sobre os neutros e o projeto', () => {
  for (const dark of [true, false])
    for (const hue of HUES) {
      const k = tokens(hue, dark)
      const tag = `${dark ? 'escuro' : 'claro'} ${hue}`
      for (const bg of ['app', 's2', 's3']) {
        assert.ok(contrast(k.strong, k[bg]) >= 7, `forte ${bg} ${tag}`)
        assert.ok(contrast(k.sec, k[bg]) >= 4.5, `secundário ${bg} ${tag}`)
      }
      assert.ok(contrast(k.weak, k.s3) >= 4.5, `fraco s3 ${tag}: ${contrast(k.weak, k.s3).toFixed(2)}`)
      assert.ok(contrast(k.p12, k.p3) >= 7, `p12 sobre p3 ${tag}`)
      assert.ok(contrast(k.p11, k.p3) >= 4.5, `p11 sobre p3 ${tag}: ${contrast(k.p11, k.p3).toFixed(2)}`)
      assert.ok(contrast(k.a11, k.s3) >= 4.5, `a11 sobre s3 ${tag}: ${contrast(k.a11, k.s3).toFixed(2)}`)
      assert.ok(contrast(k.pink, k.p9) >= 4.5, `tinta sobre project/9 ${tag}: ${contrast(k.pink, k.p9).toFixed(2)}`)
    }
})

test('inkFor escolhe o de maior contraste e tokens devolve hex', () => {
  assert.equal(inkFor('#000000'), '#ffffff')
  assert.notEqual(inkFor('#ffffff'), '#ffffff')
  for (const v of Object.values(tokens(250, true))) assert.match(v, /^#[0-9a-f]{6}$/)
})

test('svg: só as classes usadas, duas paletas e hover opcional', () => {
  const s = svg(40, 20, `<rect class="f-s3 s-b6" width="40" height="20"/>${icon('ready', 0, 0)}`, 250, true)
  assert.match(s, /\.f-s3\{fill:#/)
  assert.match(s, /\.s-b6\{stroke:#/)
  assert.match(s, /prefers-color-scheme: light/)
  assert.match(s, /\.hv:hover \.bg/)
  assert.ok(!s.includes('f-a9'), 'classe não usada fica de fora')
  assert.ok(!s.includes(String.fromCharCode(0x2014)))
})

test('âncoras do tema: o texto principal tem 7:1 em todas as superfícies', () => {
  for (const dark of [true, false]) {
    const a = themeAnchors(dark)
    for (const s of ['surface-0', 'surface-1', 'surface-2', 'surface-3']) assert.ok(contrast(a['text-primary'], a[s]) >= 7, `${dark} ${s}`)
    for (const s of ['surface-0', 'surface-2']) assert.ok(contrast(a['text-muted'], a[s]) >= 4.5, `${dark} muted ${s}`)
  }
  assert.equal(PRIMARY_NEUTRAL, false)
})

test('faixa: a descrição diz tudo, o SVG tem a largura pedida e o assunto some quando não cabe', () => {
  const base = { hue: 250, name: 'skim-it', idx: 1, topic: 'Implementar a band v4', status: 'precisa', waitingWhat: 'aprovar Bash', statusLabel: 'precisa de você', ofText: 'de 3', seqLabel: 'Sessão 2', minimal: false, waiting: 2, waitingAlt: '2 esperando' }
  const wide = faixa({ ...base, w: 900 })
  assert.match(wide.source, /width="900" height="36"/)
  for (const part of ['skim-it', 'Sessão 2 de 3', 'Implementar a band v4', 'precisa de você', '2 esperando']) assert.ok(wide.alt.includes(part), part)
  assert.ok(wide.source.includes('Implementar a band v4'))
  const tiny = faixa({ ...base, w: 300, topic: 'um assunto muito comprido que não cabe aqui de jeito nenhum' })
  assert.ok(!tiny.source.includes('comprido que não cabe aqui de jeito nenhum'))
  const min = faixa({ ...base, w: 400, minimal: true })
  assert.ok(!min.source.includes('Implementar') && min.source.includes('f-a11'))
  assert.equal(tierOf(900), 'wide'); assert.equal(tierOf(899), 'medium'); assert.equal(tierOf(680), 'medium'); assert.equal(tierOf(679), 'narrow'); assert.equal(tierOf(479), 'minimal')
  assert.equal(statusIcon('precisa', 'aprovar Bash'), 'approve'); assert.equal(statusIcon('precisa', 'responder pergunta'), 'answer'); assert.equal(statusIcon('hoje'), 'stopped')
})

test('faixa em duas peças: esquerda larga cortada pela caixa, direita colada na borda, sem número quando sozinha', () => {
  const base = { hue: 190, name: 'photo-collector', idx: 2, topic: 'Grupos de linhas vazias', status: 'rodando', statusLabel: 'Rodando', ofText: 'de 7', seqLabel: 'Sessão 3', minimal: false, waiting: 0, waitingAlt: '' }
  const p = faixaParts({ ...base, w: 900 })
  assert.equal(p.left.width, FAIXA_LEFT_W)
  assert.match(p.left.source, new RegExp('width="' + FAIXA_LEFT_W + '" height="36"'))
  assert.ok(p.right.width > 40 && p.right.width < 160, 'direita só com o estado: ' + p.right.width)
  assert.ok(p.left.source.includes('de 7') && p.left.source.includes('Grupos de linhas vazias'))
  assert.ok(p.right.source.includes('Rodando') && !p.left.source.includes('Rodando'))
  const solo = faixaParts({ ...base, w: 900, solo: true })
  assert.ok(!solo.left.source.includes('de 7') && !solo.alt.includes('Sessão 3'))
  const min = faixaParts({ ...base, w: 400, minimal: true, waiting: 2, status: 'precisa', waitingWhat: 'aprovar Bash' })
  assert.ok(min.right.source.includes('f-a11') && !min.left.source.includes('Grupos'))
  assert.ok(min.right.width > p.right.width - 60, 'contador âmbar na direita da mínima')
})

test('demonstração: 7 sessões no projeto desta, esta é a terceira e rodando, uma de cada estado', () => {
  const now = Date.now()
  const me = { id: 'eu', host: 'h', root: 'c:/x', cwd: 'C:/x', label: 'x', topic: 't', kind: 'idle', lastTurnAt: now - 3600e3, lastEventAt: now - 3600e3, startedAt: now - 10e3, updatedAt: now, editedFiles: 0 }
  const all = demoPeers(me, now)
  assert.equal(all.length, 7)
  const order = [...all].sort((a, b) => a.startedAt - b.startedAt).map(p => p.id)
  assert.equal(order[2], 'eu')
  const st = all.map(p => sessionStatus(p, now))
  for (const s of ['rodando', 'precisa', 'pronta', 'segundo-plano']) assert.ok(st.includes(s), s)
  assert.equal(sessionStatus(all.find(p => p.id === 'eu'), now), 'rodando')
})

test('frota: espera com título, uma sessão a mais na larga, +N quando não cabe e nunca passa da largura', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ idx: i, status: i < 2 ? 'precisa' : i < 4 ? 'rodando' : 'recente', waitingWhat: 'aprovar Bash', title: 'Sessão número ' + i + ' com um título comprido', detail: 'rodando' }))
  const wide = planFleet(items, 916 + 100, 'wide')
  assert.ok(wide.chips[0].titled === 160 && wide.chips[2].titled === 96 && wide.chips[3].titled === 0)
  const med = planFleet(items, 800, 'medium')
  assert.ok(med.chips.length <= 5 && med.chips[2].titled === 0 && med.plus === 10 - med.chips.length)
  for (const [px, tier] of [[1000, 'wide'], [800, 'medium'], [700, 'medium']]) {
    const plan = planFleet(items, px, tier)
    assert.ok(fleetPiece(plan.chips, plan.plus, 250, 'Sessão').width <= px - 104, px + ' ' + tier)
  }
  assert.ok(planFleet(items, 300, 'wide').plus > 0)
  assert.ok(gitPiece({ branch: 'main', changes: '· 3 alterações', pr: 'PR #12' }, 250).width > textWidth('main', 12, 500))
  assert.equal(gitPiece({ branch: '', changes: '', pr: '' }, 250), null)
})

test('fosco: os três estados se distinguem (repouso apagado, trabalhando na cor do projeto, esperando em âmbar)', () => {
  const num = (s, re) => Number(s.match(re)?.[1])
  for (const hue of [190, 272]) {
    const [idle, working, waiting] = ['idle', 'working', 'waiting'].map(state => ambientScene({ hue, state }))
    const glow = s => num(s, /\.gl\{opacity:([\d.]+)/)
    const amber = s => num(s, /\.wm\{mix-blend-mode:screen;opacity:([\d.]+)/)
    const ground = s => s.match(/\.a\{stop-color:(#[0-9a-f]{6})/)?.[1]
    assert.ok(glow(idle) <= 0.06 && amber(idle) === 0, 'repouso')
    assert.ok(glow(working) >= 0.4 && amber(working) === 0, 'trabalhando')
    assert.ok(glow(waiting) === 0 && amber(waiting) >= 0.6, 'esperando')
    assert.notEqual(ground(idle), ground(working), 'o chão muda com o trabalho')
    assert.ok(waiting.includes(tokens(hue, true).a9), 'o âmbar é o da band')
  }
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
