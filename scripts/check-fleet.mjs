// Testes da lógica de sessões, Git e assunto (hooks/fleetcore.ts, gitinfo.ts, topic.ts).
// Uso: node --import ./scripts/register.mjs scripts/check-fleet.mjs
import assert from 'node:assert/strict'
import { parsePeer, sessionStatus, groupByProject, family, waitingCounter, waitingMine, sessionLabel, isScratch, MIN, HOUR, ago, statusWords, statusWord, nextCron, backgroundOf, archivable, deskActivity, toneIndex, inkOn, normPath } from '../hooks/fleetcore'
import { memo, addBounded } from '../hooks/cache'
import { parseRemote, parseShortstat, ciOf, gitLine } from '../hooks/gitinfo'
import { topicPrompt, cleanTopic } from '../hooks/topic'
import { endsAsking, showReturn, returnLine } from '../hooks/retorno'
import { parseConfig } from '../hooks/project'

const cases = []
const test = (name, fn) => cases.push([name, fn])

const NOW = 1_800_000_000_000
const peer = (o = {}) => ({
  id: 's1', host: 'local_1', root: '/r/a', cwd: '/r/a', label: 'a', topic: 't', kind: 'idle',
  lastTurnAt: NOW - 5 * MIN, lastEventAt: NOW - MIN, startedAt: NOW - 3 * HOUR, updatedAt: NOW - MIN, editedFiles: 0, ...o,
})
const st = (o) => sessionStatus(peer(o), NOW)

test('waiting vivo (arquivo de até 3 min) é precisa; morto cai nas paradas pelo último turno', () => {
  assert.equal(st({ kind: 'waiting', updatedAt: NOW - 3 * MIN }), 'precisa')
  assert.equal(st({ kind: 'waiting', updatedAt: NOW - 3 * MIN - 1 }), 'recente')
  assert.equal(st({ kind: 'waiting', updatedAt: NOW - 2 * HOUR, lastTurnAt: NOW - 3 * HOUR }), 'hoje')
  assert.equal(st({ kind: 'waiting', updatedAt: NOW - 24 * HOUR - 1 }), 'antiga')
})

test('working vivo: rodando até 10 min exatos sem evento, sem-sinal depois; morto nunca é rodando', () => {
  assert.equal(st({ kind: 'working', lastEventAt: NOW - 10 * MIN }), 'rodando')
  assert.equal(st({ kind: 'working', lastEventAt: NOW - 10 * MIN - 1 }), 'sem-sinal')
  assert.equal(st({ kind: 'working', updatedAt: NOW - 3 * MIN - 1, lastEventAt: NOW - 4 * MIN }), 'recente')
  assert.equal(st({ kind: 'working', updatedAt: NOW - 4 * MIN, lastTurnAt: NOW - 3 * HOUR }), 'hoje')
})

test('working calado com trabalho em segundo plano nunca é sem-sinal', () => {
  const quiet = NOW - 30 * MIN
  assert.equal(st({ kind: 'working', lastEventAt: quiet, background: { agents: 1, shells: 0 } }), 'segundo-plano')
  assert.equal(st({ kind: 'working', lastEventAt: quiet, background: { agents: 0, shells: 2 } }), 'segundo-plano')
  assert.equal(st({ kind: 'working', lastEventAt: quiet, background: { agents: 0, shells: 0, wakeAt: NOW + MIN } }), 'segundo-plano')
  assert.equal(st({ kind: 'working', lastEventAt: quiet, background: { agents: 0, shells: 0, wakeAt: NOW - MIN } }), 'sem-sinal')
})

test('working com sinal recente continua rodando mesmo com segundo plano', () => {
  assert.equal(st({ kind: 'working', background: { agents: 2, shells: 0 } }), 'rodando')
})

test('background vivo: segundo-plano com tarefas; sem tarefas, ou morto, cai no tempo', () => {
  assert.equal(st({ kind: 'background', background: { agents: 1, shells: 1 } }), 'segundo-plano')
  assert.equal(st({ kind: 'background', updatedAt: NOW - 5 * MIN, background: { agents: 1, shells: 1 } }), 'recente')
  assert.equal(st({ kind: 'background' }), 'recente')
  assert.equal(st({ kind: 'background', background: { agents: 0, shells: 0, wakeAt: NOW - 1 } }), 'recente')
})

test('review é pronta até 24 h do último turno, viva ou morta; depois, antiga', () => {
  assert.equal(st({ kind: 'review', lastTurnAt: NOW - 23 * HOUR, updatedAt: NOW - 23 * HOUR }), 'pronta')
  assert.equal(st({ kind: 'review', lastTurnAt: NOW - 24 * HOUR - 1 }), 'antiga')
})

test('idle: recente < 2 h, hoje < 24 h, antiga a partir daí (fronteiras)', () => {
  assert.equal(st({ lastTurnAt: NOW - 2 * HOUR + 1 }), 'recente')
  assert.equal(st({ lastTurnAt: NOW - 2 * HOUR }), 'hoje')
  assert.equal(st({ lastTurnAt: NOW - 24 * HOUR + 1 }), 'hoje')
  assert.equal(st({ lastTurnAt: NOW - 24 * HOUR }), 'antiga')
})

test('arquivo sem update há mais de 24 h é antiga, qualquer que seja o tipo', () => {
  const old = NOW - 24 * HOUR - 1
  for (const kind of ['working', 'waiting', 'background', 'review', 'idle']) {
    assert.equal(st({ kind, updatedAt: old, lastTurnAt: NOW - MIN, background: { agents: 3, shells: 0 } }), 'antiga')
  }
})

test('parsePeer: lixo vira null, sem lançar', () => {
  for (const bad of ['', 'nao json', '[]', 'null', '42', '{}', JSON.stringify({ ...peer(), kind: 'sleeping' }),
    JSON.stringify({ ...peer(), id: '' }), JSON.stringify({ ...peer(), updatedAt: 'x' }), JSON.stringify({ ...peer(), root: 3 })]) {
    assert.equal(parsePeer(bad), null)
  }
})

test('parsePeer: arquivo válido volta; opcionais ruins são descartados', () => {
  const p = parsePeer(JSON.stringify(peer({ parentHost: 'local_0', waitingWhat: 'aprovar Bash', background: { agents: 1, shells: 'x', wakeAt: NOW } })))
  assert.equal(p.parentHost, 'local_0')
  assert.equal(p.waitingWhat, 'aprovar Bash')
  assert.deepEqual(p.background, { agents: 1, shells: 0, wakeAt: NOW })
  const q = parsePeer(JSON.stringify({ ...peer(), waitingWhat: 'qualquer coisa', parentHost: 5, editedFiles: 'x', label: 9 }))
  assert.equal(q.waitingWhat, undefined)
  assert.equal(q.parentHost, undefined)
  assert.equal(q.editedFiles, 0)
  assert.equal(q.label, '')
})

test('groupByProject: meu projeto separado, ordem por estado, antigas só contadas', () => {
  const peers = [
    peer({ id: 'hoje', lastTurnAt: NOW - 5 * HOUR }),
    peer({ id: 'recente', lastTurnAt: NOW - 30 * MIN }),
    peer({ id: 'semsinal', kind: 'working', lastEventAt: NOW - 20 * MIN }),
    peer({ id: 'pronta', kind: 'review' }),
    peer({ id: 'bg', kind: 'background', background: { agents: 1, shells: 0 } }),
    peer({ id: 'roda', kind: 'working' }),
    peer({ id: 'precisa', kind: 'waiting' }),
    peer({ id: 'velha', lastTurnAt: NOW - 30 * HOUR }),
    peer({ id: 'outra', root: '/r/b', kind: 'working' }),
    peer({ id: 'outra-velha', root: '/r/b', lastTurnAt: NOW - 40 * HOUR }),
  ]
  const g = groupByProject(peers, '/r/a', NOW)
  assert.deepEqual(g.mine.map(r => r.peer.id), ['precisa', 'roda', 'bg', 'pronta', 'semsinal', 'recente', 'hoje'])
  assert.deepEqual(g.others.map(r => r.peer.id), ['outra'])
  assert.equal(g.antigas, 2)
})

test('groupByProject: no mesmo estado, a mais recente primeiro', () => {
  const g = groupByProject([peer({ id: 'a', lastTurnAt: NOW - 50 * MIN }), peer({ id: 'b', lastTurnAt: NOW - 10 * MIN })], '/r/a', NOW)
  assert.deepEqual(g.mine.map(r => r.peer.id), ['b', 'a'])
})

test('family: mãe pelo parentHost, filhas pelo meu host, com estado', () => {
  const me = peer({ id: 'me', host: 'local_me', parentHost: 'local_mae' })
  const mae = peer({ id: 'mae', host: 'local_mae', kind: 'working' })
  const filha = peer({ id: 'f1', host: 'local_f1', parentHost: 'local_me', kind: 'waiting' })
  const prima = peer({ id: 'p', host: 'local_p', parentHost: 'local_mae' })
  const f = family([me, mae, filha, prima], me, NOW)
  assert.equal(f.mother.peer.id, 'mae')
  assert.equal(f.mother.status, 'rodando')
  assert.deepEqual(f.children.map(c => [c.peer.id, c.status]), [['f1', 'precisa']])
  const solo = family([me], peer({ id: 'x', host: 'local_x' }), NOW)
  assert.equal(solo.mother, null)
  assert.deepEqual(solo.children, [])
})

test('waitingCounter: conta as outras que esperam; linha âmbar só para filha', () => {
  const me = peer({ id: 'me', host: 'local_me', kind: 'waiting' })
  const outra = peer({ id: 'o', host: 'local_o', kind: 'waiting' })
  const antiga = peer({ id: 'v', host: 'local_v', kind: 'waiting', updatedAt: NOW - 30 * HOUR })
  const roda = peer({ id: 'r', host: 'local_r', kind: 'working' })
  let w = waitingCounter([me, outra, antiga, roda], me, NOW)
  assert.deepEqual([w.count, w.childWaiting, w.child], [1, false, undefined])
  const filha = peer({ id: 'f', host: 'local_f', parentHost: 'local_me', kind: 'waiting' })
  w = waitingCounter([me, outra, filha], me, NOW)
  assert.equal(w.count, 2)
  assert.equal(w.childWaiting, true)
  assert.equal(w.child.id, 'f')
  const filhaRodando = peer({ id: 'f', host: 'local_f', parentHost: 'local_me', kind: 'working' })
  assert.equal(waitingCounter([me, filhaRodando], me, NOW).childWaiting, false)
})

test('waitingMine: outras sessões do projeto que esperam, na ordem do painel, sem esta nem as de outro projeto', () => {
  const me = peer({ id: 'me', host: 'local_me', kind: 'waiting' })
  const velha = peer({ id: 'a', host: 'local_a', kind: 'waiting', lastTurnAt: NOW - 5 * MIN })
  const nova = peer({ id: 'b', host: 'local_b', kind: 'waiting', lastTurnAt: NOW - MIN })
  const fora = peer({ id: 'c', host: 'local_c', kind: 'waiting', root: '/outro' })
  const roda = peer({ id: 'r', host: 'local_r', kind: 'working' })
  assert.deepEqual(waitingMine([me, velha, nova, fora, roda], me, NOW).map(r => r.peer.id), ['b', 'a'])
  assert.deepEqual(waitingMine([me, roda], me, NOW), [])
})

test('parsePeer: sem lastEventAt vale o updatedAt', () => {
  const o = peer()
  delete o.lastEventAt
  assert.equal(parsePeer(JSON.stringify(o)).lastEventAt, o.updatedAt)
})

test('statusWords e statusWord dizem o quê', () => {
  const row = (o, status) => ({ peer: peer(o), status })
  assert.equal(statusWords(row({ waitingWhat: 'aprovar Bash' }, 'precisa'), NOW), 'aprovar Bash')
  assert.equal(statusWords(row({ background: { agents: 2, shells: 1 } }, 'segundo-plano'), NOW), 'segundo plano · 2 agentes, 1 comando')
  assert.equal(statusWords(row({ lastEventAt: NOW - 12 * MIN }, 'sem-sinal'), NOW), 'sem sinal há 12 min')
  assert.equal(statusWords(row({ lastTurnAt: NOW - 3 * HOUR }, 'hoje'), NOW), 'parada há 3 h')
  assert.equal(statusWords(row({}, 'pronta'), NOW), 'pronta para revisar')
  assert.equal(statusWord('hoje'), 'parada')
  assert.equal(ago(45_000), '45 s')
  assert.equal(ago(40 * 86400_000), '40 d')
})

test('nextCron: horário fixo, passo e fora de alcance', () => {
  const base = new Date(2026, 10, 15, 13, 40, 20).getTime()
  const at = (h, m) => new Date(2026, 10, 15, h, m).getTime()
  assert.equal(nextCron('30 14 * * *', base), at(14, 30))
  assert.equal(nextCron('*/15 * * * *', base), at(13, 45))
  assert.equal(nextCron('0 9 * * *', base), new Date(2026, 10, 16, 9, 0).getTime())
  assert.equal(nextCron('0 0 1 1 *', base), undefined)
  assert.equal(nextCron('lixo', base), undefined)
  assert.equal(nextCron('1 2 3', base), undefined)
})

test('backgroundOf: conta agentes e comandos, despertador mais próximo, vazio some', () => {
  const base = new Date(2026, 10, 15, 13, 40).getTime()
  assert.equal(backgroundOf([], [], base), undefined)
  assert.equal(backgroundOf(undefined, undefined, base), undefined)
  assert.deepEqual(backgroundOf([{ type: 'subagent' }, { type: 'shell' }, { type: 'monitor' }], [], base), { agents: 1, shells: 2 })
  const b = backgroundOf([], [{ schedule: '0 18 * * *' }, { schedule: '30 14 * * *' }], base)
  assert.deepEqual([b.agents, b.shells, b.wakeAt], [0, 0, new Date(2026, 10, 15, 14, 30).getTime()])
})

test('archivable: só paradas há mais de 30 dias, nunca pinada nem rodando, nunca sem data', () => {
  const day = 86400_000
  const rows = [
    { sessionId: 'velha', lastActivityAt: NOW - 31 * day },
    { sessionId: 'nova', lastActivityAt: NOW - 29 * day },
    { sessionId: 'pinada', lastActivityAt: NOW - 90 * day, pinned: true },
    { sessionId: 'rodando', lastActivityAt: NOW - 90 * day, isRunning: true },
    { sessionId: 'semdata' },
    { sessionId: 'iso', updatedAt: new Date(NOW - 60 * day).toISOString() },
    { sessionId: 'seg', lastActivityAt: Math.floor((NOW - 60 * day) / 1000) },
  ]
  assert.deepEqual(archivable(rows, NOW, 'eu').map(r => r.sessionId), ['velha', 'iso', 'seg'])
  assert.equal(deskActivity({ sessionId: 'x' }), undefined)
})

test('archivable: nunca esta sessão, sem sessionId texto, pinada de qualquer forma, rodando de qualquer forma, filha de rodando', () => {
  const old = NOW - 90 * 86400_000
  const rows = [
    { sessionId: 'eu', lastActivityAt: old },
    { lastActivityAt: old },
    { sessionId: 7, lastActivityAt: old },
    { sessionId: 'p1', lastActivityAt: old, isPinned: true },
    { sessionId: 'r1', lastActivityAt: old, running: true },
    { sessionId: 'r2', lastActivityAt: old, status: 'running' },
    { sessionId: 'mae', lastActivityAt: old, isRunning: true },
    { sessionId: 'filha', lastActivityAt: old, parentSessionId: 'mae' },
    { sessionId: 'filha2', lastActivityAt: old, startedBy: 'mae' },
    { sessionId: 'ok', lastActivityAt: old, parentSessionId: 'outra' },
  ]
  assert.deepEqual(archivable(rows, NOW, 'eu').map(r => r.sessionId), ['ok'])
  assert.deepEqual(archivable(rows, NOW, ''), [])
  assert.deepEqual(archivable(rows, NOW, undefined), [])
})

test('normPath: barras, sem barra final, unidade minúscula só no Windows', () => {
  assert.equal(normPath('C:\\Projetos\\X\\'), 'c:/projetos/x')
  assert.equal(normPath('/Home/U/'), '/Home/U')
})

test('memo e addBounded: teto com descarte do mais antigo', () => {
  const m = new Map()
  for (let i = 0; i < 5; i++) memo(m, i, () => i * 2, 3)
  assert.deepEqual([...m.keys()], [2, 3, 4])
  assert.equal(memo(m, 3, () => 99, 3), 6)
  const s = new Set()
  for (let i = 0; i < 5; i++) addBounded(s, i, 3)
  assert.deepEqual([...s], [2, 3, 4])
  addBounded(s, 2, 3)
  assert.deepEqual([...s], [3, 4, 2])
})

test('toneIndex: ordem por início e id, só no mesmo projeto', () => {
  const ps = [peer({ id: 'b', startedAt: 2 }), peer({ id: 'a', startedAt: 2 }), peer({ id: 'c', startedAt: 1 }), peer({ id: 'z', root: '/r/b', startedAt: 0 })]
  assert.deepEqual(toneIndex(ps, '/r/a', 'a'), { index: 1, total: 3 })
  assert.deepEqual(toneIndex(ps, '/r/a', 'c'), { index: 0, total: 3 })
  assert.deepEqual(toneIndex([], '/r/a', 'x'), { index: 0, total: 1 })
})

test('inkOn: claro sobre fundo escuro e escuro sobre fundo claro', () => {
  assert.equal(inkOn('#000000'), '#ffffff')
  assert.equal(inkOn('#ffffff'), '#111111')
  assert.equal(inkOn('#2f8adc'), '#111111')
  assert.equal(inkOn('#1a3a8a'), '#ffffff')
})

test('sessionLabel e chat de rascunho', () => {
  assert.equal(sessionLabel('C:\\Users\\leo\\Projetos\\Skim-It'), 'skim-it')
  assert.equal(sessionLabel('C:\\x\\y\\', 'MeuRepo'), 'meurepo')
  assert.equal(sessionLabel('C:\\Users\\leo\\AppData\\Claude\\scratch-workspaces\\abc'), 'chat')
  assert.equal(sessionLabel('/home/u/scratch-2026-11-15-ab12'), 'chat')
  assert.equal(sessionLabel('/home/u/scratch-workspaces/x', 'repo'), 'repo')
  assert.equal(sessionLabel('/home/u/.treehouse/repo/2/repo', 'repo'), 'repo#2')
  assert.equal(sessionLabel(''), 'sessão')
  assert.equal(isScratch('/home/u/projeto'), false)
})

test('parseRemote', () => {
  assert.equal(parseRemote('git@github.com:dono/nome.git'), 'dono/nome')
  assert.equal(parseRemote('https://github.com/dono/nome\n'), 'dono/nome')
  assert.equal(parseRemote('https://github.com/dono/nome.git/'), 'dono/nome')
  assert.equal(parseRemote(''), '')
})

test('parseShortstat', () => {
  assert.deepEqual(parseShortstat(' 3 files changed, 10 insertions(+), 2 deletions(-)'), { files: 3, add: 10, del: 2 })
  assert.deepEqual(parseShortstat(' 1 file changed, 1 insertion(+)'), { files: 1, add: 1, del: 0 })
  assert.deepEqual(parseShortstat(''), { files: 0, add: 0, del: 0 })
})

test('ciOf', () => {
  assert.equal(ciOf(undefined), '')
  assert.equal(ciOf([]), '')
  assert.equal(ciOf([{ conclusion: 'SUCCESS' }, { state: 'SUCCESS' }]), 'pass')
  assert.equal(ciOf([{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }, { status: 'IN_PROGRESS' }]), 'fail')
  assert.equal(ciOf([{ conclusion: 'SUCCESS' }, { status: 'IN_PROGRESS', conclusion: '' }]), 'pending')
  assert.equal(ciOf([{ state: 'PENDING' }]), 'pending')
})

test('gitLine', () => {
  const base = { repo: 'a/b', branch: 'main', files: 0, add: 0, del: 0, ahead: 0, behind: 0 }
  assert.equal(gitLine({ ...base, branch: 'feat', ahead: 2, behind: 1, files: 3, pr: { num: 12, state: 'OPEN', draft: false, ci: 'pass' } }),
    'feat · PR #12 ✓ · ↑2 ↓1 · 3 arquivos')
  assert.equal(gitLine({ ...base, files: 1 }), 'main · 1 arquivo')
  assert.equal(gitLine({ ...base, pr: { num: 3, state: 'OPEN', draft: true, ci: 'fail' } }), 'main · PR #3 rascunho ✗')
  assert.equal(gitLine({ ...base, pr: { num: 4, state: 'MERGED', draft: false, ci: '' } }), 'main · PR #4 mergeado')
  assert.equal(gitLine({ ...base, branch: '' }), '')
  assert.equal(gitLine(null), '')
})

test('cleanTopic', () => {
  assert.equal(cleanTopic('  "Ajustar o Painel."\nexplicação'), 'ajustar o painel')
  assert.equal(cleanTopic('`band de sessões`'), 'band de sessões')
  assert.equal(cleanTopic('x'.repeat(80)).length, 40)
  assert.equal(cleanTopic(''), '')
})

test('topicPrompt: assunto atual, pedido e o que foi feito entram; continuação mantém', () => {
  const p = topicPrompt('painel de sessões', 'sim', 'editou fleet.ts')
  assert.match(p, /2 a 5 palavras/)
  assert.match(p, /Assunto atual: painel de sessões/)
  assert.match(p, /Último pedido: sim/)
  assert.match(p, /editou fleet\.ts/)
  assert.match(p, /pode ir/)
  assert.match(topicPrompt('', 'oi'), /Assunto atual: \(nenhum\)/)
  assert.doesNotMatch(topicPrompt('', 'oi'), /O que a sessão fez/)
  assert.ok(topicPrompt('', 'a'.repeat(2000)).length < 1500)
})

test('endsAsking: pergunta no fim, com fecha-aspas ou negrito depois', () => {
  assert.ok(endsAsking('Quer que eu siga?'))
  assert.ok(endsAsking('Posso seguir? \n'))
  assert.ok(endsAsking('Faço isso **agora?**'))
  assert.ok(endsAsking('Ele disse "vamos?"'))
  assert.ok(!endsAsking('Feito. Por que isso? Porque sim.'))
  assert.ok(!endsAsking('Pronto.'))
  assert.ok(!endsAsking(''))
})

test('cartão de retorno: só depois de 10 min, com turno rodado e sem dispensar', () => {
  const v = { since: NOW - 11 * MIN, turns: 1, files: 0, commits: 0, dismissed: false }
  assert.ok(showReturn(v, NOW))
  assert.ok(!showReturn({ ...v, since: NOW - 10 * MIN }, NOW))
  assert.ok(!showReturn({ ...v, turns: 0 }, NOW))
  assert.ok(!showReturn({ ...v, dismissed: true }, NOW))
})

test('em inglês: estado, espera, segundo plano, Git, retorno, assunto e rótulo', () => {
  const row = (over, status) => ({ peer: { id: 'a', host: 'h', root: '/r', cwd: '/r', label: 'r', topic: '', kind: 'idle', lastTurnAt: NOW, lastEventAt: NOW, startedAt: 0, updatedAt: NOW, editedFiles: 0, ...over }, status })
  assert.equal(statusWords(row({ waitingWhat: 'aprovar Bash' }, 'precisa'), NOW, 'en'), 'approve Bash')
  assert.equal(statusWords(row({ waitingWhat: 'responder pergunta' }, 'precisa'), NOW, 'en'), 'answer question')
  assert.equal(statusWords(row({}, 'precisa'), NOW, 'en'), 'waits for you')
  assert.equal(statusWords(row({ background: { agents: 2, shells: 1 } }, 'segundo-plano'), NOW, 'en'), 'background · 2 agents, 1 command')
  assert.equal(statusWords(row({ lastEventAt: NOW - 12 * MIN }, 'sem-sinal'), NOW, 'en'), 'no signal for 12 min')
  assert.equal(statusWords(row({ lastTurnAt: NOW - 3 * HOUR }, 'hoje'), NOW, 'en'), 'idle for 3 h')
  assert.equal(statusWords(row({}, 'pronta'), NOW, 'en'), 'ready to review')
  assert.equal(statusWord('hoje', 'en'), 'idle')
  assert.equal(statusWord('precisa', 'en'), 'needs you')
  const base = { repo: 'a/b', branch: 'main', files: 0, add: 0, del: 0, ahead: 0, behind: 0 }
  assert.equal(gitLine({ ...base, files: 1 }, 'en'), 'main · 1 file')
  assert.equal(gitLine({ ...base, pr: { num: 3, state: 'OPEN', draft: true, ci: 'fail' } }, 'en'), 'main · PR #3 draft ✗')
  assert.equal(gitLine({ ...base, pr: { num: 4, state: 'MERGED', draft: false, ci: '' } }, 'en'), 'main · PR #4 merged')
  const v = { since: NOW - 37 * MIN, turns: 3, files: 5, commits: 2, dismissed: false }
  assert.equal(returnLine(v, NOW, 'en'), 'While you were away (37 min): 3 turns · 5 files · 2 commits')
  assert.equal(returnLine({ ...v, turns: 1, files: 1, commits: 1 }, NOW, 'en'), 'While you were away (37 min): 1 turn · 1 file · 1 commit')
  assert.match(topicPrompt('x', 'oi', 'fez', 'en'), /in English/)
  assert.match(topicPrompt('', 'oi', '', 'en'), /Current topic: \(none\)/)
  assert.equal(sessionLabel('/', undefined, 'en'), 'session')
  assert.ok(parseConfig('{"tipo":"time"}', 'en').errors.some(e => /must be/.test(e)))
})

test('returnLine: texto completo, singular e partes zeradas somem', () => {
  const v = { since: NOW - 37 * MIN, turns: 3, files: 5, commits: 2, dismissed: false }
  assert.equal(returnLine(v, NOW), 'Enquanto você estava fora (37 min): 3 turnos · 5 arquivos · 2 commits')
  assert.equal(returnLine({ ...v, turns: 1, files: 1, commits: 1 }, NOW), 'Enquanto você estava fora (37 min): 1 turno · 1 arquivo · 1 commit')
  assert.equal(returnLine({ ...v, files: 0, commits: 0 }, NOW), 'Enquanto você estava fora (37 min): 3 turnos')
})

let failed = 0
for (const [name, fn] of cases) {
  try { fn(); console.log('ok   ' + name) } catch (error) { failed++; console.log('FALHA ' + name + '\n  ' + error.message) }
}
console.log(failed ? `${failed} falha(s)` : `${cases.length} ok`)
process.exit(failed ? 1 : 0)
