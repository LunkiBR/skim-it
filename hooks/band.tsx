// Band acima do prompt (v4, 2026-11-15): faixa no matiz do projeto com o número da sessão e o estado desta
// sessão, aviso de quem espera, frota (chips com número e estado, em quatro larguras), linha Git e o painel
// das sessões do projeto, que abre no lugar. No celular só o chip, o ponto e a palavra de estado.
// O Desktop desenha só o `label` de um botão e uma Box não tem raio nem ícone dentro: faixa, chips, Git e
// peças do painel são SVG (hooks/desenho.ts); as ações são botões nativos.
//
// Claro ou escuro: nenhum hook de desenho recebe o esquema de cores (AbovePrompt e Placed não trazem
// colorScheme nem isDark; só o Backdrop lê `overrideColorScheme`, que este mod não define). O SVG leva as
// duas paletas e o `prefers-color-scheme` escolhe (hooks/v4.ts, como o fundo em ambient.ts); Box e Text usam
// chaves do tema (subtle, warning, dimColor), que seguem o look nos dois modos. Sem fundo na Box: não há
// chave de tema para a superfície, e um hex fixo erraria um dos modos.
import { atom, read, update } from 'claude-code'

import { oklchFit } from './color'
import { cardBand, cardPress } from './card'
import { amberIconPiece, blockPiece, branchIconPiece, countPill, countsPiece, dividerPiece, fleetPiece, groupHeader, numberPiece, pillPiece, planFleet, statusIcon, statusIconPiece, tierOf } from './desenho'
import type { CountItem, FleetItem } from './desenho'
import { draw } from './desenhar'
import { askArchive, clearArchive, confirmArchive, myId, openSession, togglePanel } from './fleet'
import { ago, demoPeers, family, groupByProject, inkOn, sessionStatus, statusWord, statusWords, toneIndex, waitingCounter, waitingMine, waitingText } from './fleetcore'
import type { PeerFile, Row, Status } from './fleetcore'
import { changesText, ciMark, prText } from './gitinfo'
import { loadGitDetail } from './gitlive'
import { cnt, getLang, tr } from './i18n'
import { sessionToneHex } from './project'
import type { ProjectState } from './project'
import { returnLine, showReturn } from './retorno'
import type { Volta } from './retorno'
import { voltaDismiss } from './volta'
import { toneHex } from './tom'
import { workPress } from './work'
import type { GitDetalhe, GitInfo, Links } from '../types'
import { SCENE_HUE } from './look'

// O engine só aceita read e update de um atom declarado neste arquivo: a mesma referência (plugin e key
// literais, mesmo valor inicial) do arquivo dono, declarada de novo aqui.
const arquivarIds = atom({ plugin: 'skim-it', key: 'arquivarIds' } as const, [] as string[])
const assunto = atom({ plugin: 'skim-it', key: 'assunto' } as const, '')
const confirma = atom({ plugin: 'skim-it', key: 'confirma' } as const, false)
const git = atom({ plugin: 'skim-it', key: 'git' } as const, null as GitInfo | null)
const gitAberto = atom({ plugin: 'skim-it', key: 'gitAberto' } as const, false)
const gitDetalhe = atom({ plugin: 'skim-it', key: 'gitDetalhe' } as const, null as GitDetalhe | null)
const hojeAberto = atom({ plugin: 'skim-it', key: 'hojeAberto' } as const, false)
const links = atom({ plugin: 'skim-it', key: 'links' } as const, { ok: false, titles: {}, links: {}, old: [] } as Links)
const painel = atom({ plugin: 'skim-it', key: 'painel' } as const, false)
const peers = atom({ plugin: 'skim-it', key: 'peers' } as const, [] as PeerFile[])
const projeto = atom({ plugin: 'skim-it', key: 'projeto' } as const, { root: '', hue: SCENE_HUE, tipo: 'projeto', hasConfig: false } as ProjectState)
const volta = atom({ plugin: 'skim-it', key: 'volta' } as const, { since: 0, turns: 0, files: 0, commits: 0, dismissed: false } as Volta)

const P = 'skim-b-' // prefixo das keys dos botões da band

const GROUPS: Status[] = ['precisa', 'rodando', 'segundo-plano', 'pronta', 'sem-sinal', 'recente', 'hoje']
const CELL = 7 // px de uma célula do Desktop, para converter bodyColumns e larguras de coluna

// Git da demonstração (/skim-it demo).
const DEMO_GIT_DETALHE: GitDetalhe = {
  gh: true,
  files: [{ status: 'M', path: 'hooks/band.tsx' }, { status: 'M', path: 'hooks/desenho.ts' }],
  branches: [{ name: 'main', when: 'há 5 minutos', current: true }, { name: 'band-v4', when: 'há 2 horas', current: false }, { name: 'cartao-ajustes', when: 'ontem', current: false }],
  prs: [
    { num: 14, title: 'Band v4: faixa, frota e aviso', state: 'OPEN', draft: false, ci: 'pass', branch: 'band-v4', url: '' },
    { num: 12, title: 'Cartão de ajustes no sistema novo', state: 'OPEN', draft: true, ci: 'pending', branch: 'cartao-ajustes', url: '' },
  ],
}
const DEMO_GIT: GitInfo = { repo: 'skim-it', branch: 'main', files: 2, add: 14, del: 3, ahead: 0, behind: 0, pr: { num: 14, state: 'OPEN', draft: false, ci: 'pass' } }

function titleOf(p: PeerFile, titles: Record<string, string>) {
  return p.topic || titles[p.host] || p.label || tr(getLang(), 'band.nosubject')
}

export function registerBand(on: any) {
  // Identidade: uma barra fina no tom da sessão à esquerda das suas mensagens (desktop e terminal).
  on('ui.render', { component: 'UserMessage' }, async ($: any, e: any, next: any) => {
    if (e.props?.origin?.kind !== 'composer') return next(e)
    const tone = await toneHex($).catch(() => undefined)
    const inner = await next(e)
    if (!tone) return inner
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" columnGap={1}>
        <Box width={1} backgroundColor={tone} />
        <Box flexGrow={1} flexShrink={1}>
          {inner}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($: any, e: any, next: any) => {
    if (e.props.hasSurvey) return next(e)
    const lang = getLang()
    // O cartão de ajustes, quando o Desktop não o desenha no lugar (Placed), aparece aqui.
    const settings = await cardBand($, e)
    if (settings) return settings
    const el = $.ui.resolve(e)
    const { Box, Text, Button } = el
    const real = (await read($, peers)) as PeerFile[]
    const topic = String(await read($, assunto))
    const info = await read($, links)
    const id = myId()
    const now = await $.clock.now()
    // /skim-it demo: a band desenha uma frota de exemplo (7 sessões, uma esperando, Git) no lugar da real.
    const demo = (await $.store.get('demo')) === true
    const realMe = real.find(p => p.id === id)
    const all = demo && realMe ? demoPeers(realMe, now) : real
    const meFile = all.find(p => p.id === id)
    const label = meFile?.label || tr(lang, 'label.session')
    const proj = (await read($, projeto)) as ProjectState
    const isSpace = proj.tipo === 'espaço'
    const CHIP = proj.accent ?? oklchFit(0.62, 0.15, proj.hue)
    const tone = meFile ? toneIndex(all, meFile.root, id) : { index: 0, total: 1 }

    if (e.surface === 'mobile') {
      const dot = sessionToneHex(proj.hue, tone.index, tone.total)
      const status = meFile ? statusWord(sessionStatus(meFile, now), lang) : tr(lang, 'sw.parada')
      return (
        <Box flexDirection="row" alignItems="center" columnGap={1}>
          <Box paddingX={1} backgroundColor={CHIP}>
            <Text color={inkOn(CHIP)} weight="semibold" wrap="truncate">{label}</Text>
          </Box>
          <Text color={dot}>●</Text>
          <Text dimColor wrap="truncate">{status}</Text>
        </Box>
      )
    }

    const px = Math.round((typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 120) * CELL)
    const tier = tierOf(px)
    const hue = proj.hue
    const wait = meFile ? waitingCounter(all, meFile, now) : { count: 0, childWaiting: false, child: undefined }
    const group = meFile ? groupByProject(all, meFile.root, now) : { mine: [] as Row[], others: [] as Row[], antigas: 0 }
    const waits = meFile && !isSpace ? waitingMine(all, meFile, now) : []
    const isOpen = !isSpace && (await read($, painel)) === true
    const gitInfo = demo ? DEMO_GIT : await read($, git)
    const fam = meFile && !isSpace ? family(all, meFile, now) : { mother: null, children: [] as Row[] }
    const motherTitle = isSpace ? '' : fam.mother ? titleOf(fam.mother.peer, info.titles) : meFile?.parentHost ? info.titles[meFile.parentHost] ?? '' : ''
    const numOf = (peerId: string) => (meFile ? toneIndex(all, meFile.root, peerId).index : 0)
    const otherKids = meFile ? fam.children.filter(c => c.peer.root !== meFile.root) : []
    const sessionWord = tr(lang, 'band.sessionN', { n: '' }).trim()

    // Faixa: identidade (bloco e número), assunto e o estado desta sessão. Uma Box nativa com a borda redonda
    // do Desktop (a mesma do aviso) e tinta translúcida da cor do projeto, que vale no claro e no escuro; dentro,
    // só peças SVG de largura fixa e o assunto em texto nativo, que o próprio Desktop corta com reticências.
    // (Um SVG largo é encolhido para caber, não cortado: a faixa saía minúscula, visto em 2026-11-15.)
    const myStatus: Status = meFile ? sessionStatus(meFile, now) : 'recente'
    const statusLabel = statusWord(myStatus, lang)
    const solo = tone.total <= 1
    const minimal = tier === 'minimal'
    const tint = oklchFit(0.62, 0.12, hue)
    const head = (
      <Box flexDirection="row" alignItems="center" columnGap="sm" borderStyle="round" borderColor={tint + '66'} backgroundColor={tint + '1f'} padding="xs">
        {draw(el, blockPiece(label, hue, minimal ? 140 : 220), label)}
        {solo ? null : (
          <Box flexDirection="row" alignItems="center" columnGap="xs" flexShrink={0}>
            {draw(el, numberPiece(tone.index, hue, 'f-strong'), tr(lang, 'band.sessionN', { n: tone.index + 1 }) + ' ' + tr(lang, 'band.of', { n: tone.total }))}
            {minimal ? null : <Text size="footnote" dimColor>{tr(lang, 'band.of', { n: tone.total })}</Text>}
          </Box>
        )}
        {minimal ? null : draw(el, dividerPiece(hue), '')}
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          {minimal ? null : <Text wrap="truncate">{topic || tr(lang, 'band.nosubject')}</Text>}
        </Box>
        {draw(el, pillPiece({ status: myStatus, waitingWhat: meFile?.waitingWhat, statusLabel, minimal, waiting: wait.count }, hue), minimal && wait.count > 0 ? statusLabel + '. ' + tr(lang, 'band.waiting', { n: wait.count }) : statusLabel)}
      </Box>
    )

    // Aviso: outra sessão deste projeto espera por você. Borda âmbar em volta, sem barra e sem fundo tingido.
    const first = waits[0]
    const alert =
      first && tier !== 'minimal' ? (
        <Box flexDirection="row" alignItems="center" columnGap={1} borderStyle="round" borderColor="warning" backgroundColor="surface-3" paddingLeft={1}>
          {draw(el, amberIconPiece(statusIcon('precisa', first.peer.waitingWhat), hue), tr(lang, 'sw.precisa'))}
          <Text weight="semibold">{tr(lang, 'band.needsYou', { n: numOf(first.peer.id) + 1 })}</Text>
          <Box flexShrink={1}>
            <Text dimColor wrap="truncate">
              {(first.peer.waitingWhat ? waitingText(first.peer.waitingWhat, lang) : tr(lang, 'st.waits')) + ' · ' + titleOf(first.peer, info.titles)}
            </Text>
          </Box>
          {waits.length > 1 ? draw(el, countPill('+' + (waits.length - 1), 's5', hue), tr(lang, 'band.waiting', { n: waits.length - 1 })) : null}
          <Box flexGrow={1} />
          <Button key={P + 'abrir-alerta'} variant="secondary" label={tr(lang, 'band.openN', { n: numOf(first.peer.id) + 1 })} onPress={() => {}} />
        </Box>
      ) : null

    // Frota: o que cabe em cada largura (larga, média, estreita; a mínima não tem frota).
    // A frota são as outras sessões do projeto: esta já está na faixa (visto em 2026-11-15, "1 ☾" repetia a própria).
    const others = group.mine.filter(r => r.peer.id !== id)
    const items: FleetItem[] = others.map(r => ({
      idx: numOf(r.peer.id),
      status: r.status,
      waitingWhat: r.peer.waitingWhat,
      title: titleOf(r.peer, info.titles),
      detail: statusWords(r, now, lang),
    }))
    let fleet: any = null
    if (!isSpace && tier !== 'minimal' && items.length > 0) {
      const alt = tr(lang, 'band.fleetAlt', { list: items.map(i => `${sessionWord} ${i.idx + 1} ${i.title}: ${i.detail}`).join('; ') })
      if (tier === 'narrow') {
        const counts = new Map<string, CountItem>()
        for (const r of others) {
          if (r.status === 'precisa') continue
          const key = r.status === 'recente' || r.status === 'hoje' ? 'parada' : r.status
          const was = counts.get(key)
          if (was) was.count++
          else counts.set(key, { kind: statusIcon(r.status), count: 1, label: statusWord(r.status, lang) })
        }
        if (counts.size > 0) {
          const piece = countsPiece([...counts.values()], hue)
          fleet = draw(el, piece, alt, true)
        }
      } else {
        const plan = planFleet(items, px, tier)
        const piece = fleetPiece(plan.chips, plan.plus, hue, sessionWord)
        fleet = draw(el, piece, alt, true)
      }
    }
    // Git em texto nativo: encolhe e corta com reticências no espaço que sobrar (a estimativa de px o escondia).
    const changes = gitInfo ? changesText(gitInfo, lang) : ''
    const prLabel = gitInfo ? prText(gitInfo, lang) : ''
    // Clicar no Git abre o painel com PRs, alterações e branches (pedido em 2026-11-15). Só um Button recebe
    // clique e ele desenha só o rótulo: a linha virou um botão sem moldura, com o ícone de branch antes.
    const gitOpen = (await read($, gitAberto)) === true
    const gitLabel = gitInfo ? [gitInfo.branch, changes.replace(/^· /, ''), prLabel].filter(Boolean).join(' · ') : ''
    const gitEl =
      gitInfo && gitInfo.branch && tier !== 'narrow' && !minimal ? (
        <Box flexDirection="row" alignItems="center" columnGap="xs" flexShrink={1} minWidth={0}>
          {draw(el, branchIconPiece(hue), '')}
          <Button key={P + 'git'} plain label={gitLabel + (gitOpen ? '  ▴' : '  ▾')} onPress={() => {}} />
        </Box>
      ) : null

    // Painel do Git: PRs (com CI e link), arquivos alterados e branches recentes. Carrega ao abrir.
    const { Link } = el
    const detail = demo ? DEMO_GIT_DETALHE : ((await read($, gitDetalhe)) as GitDetalhe | null)
    const ciColor = (ci: string) => (ci === 'pass' ? 'success' : ci === 'fail' ? 'error' : ci === 'pending' ? 'warning' : undefined)
    const gitPanel =
      gitOpen && gitInfo ? (
        <Box flexDirection="column" borderStyle="round" borderColor="subtle" backgroundColor="surface-2" paddingX="md" paddingY="sm" gap="sm">
          <Box flexDirection="row" alignItems="center" columnGap="sm">
            {draw(el, branchIconPiece(hue), '')}
            <Text weight="semibold">{gitInfo.branch}</Text>
            {gitInfo.ahead || gitInfo.behind ? <Text size="footnote" dimColor>{'↑' + gitInfo.ahead + ' ↓' + gitInfo.behind}</Text> : null}
            {gitInfo.repo ? (
              <Box flexShrink={1} minWidth={0}>
                <Text size="footnote" dimColor wrap="truncate">{gitInfo.repo}</Text>
              </Box>
            ) : null}
            <Box flexGrow={1} />
            <Button key={P + 'git'} plain dimColor label={tr(lang, 'git.close')} onPress={() => {}} />
          </Box>
          {!detail ? (
            <Text size="footnote" dimColor>{tr(lang, 'git.loading')}</Text>
          ) : (
            <Box flexDirection="column" gap="sm">
              <Box flexDirection="column">
                {draw(el, groupHeader(tr(lang, 'git.prsH'), detail.prs.length, hue), tr(lang, 'git.prsH') + ': ' + detail.prs.length)}
                {!detail.gh ? (
                  <Text size="footnote" dimColor>{tr(lang, 'git.noGh')}</Text>
                ) : detail.prs.length === 0 ? (
                  <Text size="footnote" dimColor>{tr(lang, 'git.noPrs')}</Text>
                ) : (
                  detail.prs.map(pr => (
                    <Box key={'pr-' + pr.num} flexDirection="row" alignItems="center" columnGap="md">
                      <Text size="footnote" weight="semibold">{'#' + pr.num}</Text>
                      <Box flexGrow={1} flexShrink={1} minWidth={0}>
                        <Text wrap="truncate">{pr.title}</Text>
                      </Box>
                      <Box flexShrink={1} minWidth={0}>
                        <Text size="footnote" dimColor wrap="truncate">{pr.branch + (detail.current?.num === pr.num ? ' · ' + tr(lang, 'git.current') : '')}</Text>
                      </Box>
                      <Text size="footnote" color={ciColor(pr.ci)} dimColor={pr.ci === ''}>{(ciMark(pr.ci) || '·') + (pr.draft ? ' ' + tr(lang, 'git.draft') : '')}</Text>
                      {pr.url && Link ? <Link href={pr.url} label={tr(lang, 'git.openPr')} /> : null}
                    </Box>
                  ))
                )}
              </Box>
              <Box flexDirection="column">
                {draw(el, groupHeader(tr(lang, 'git.changesH'), detail.files.length, hue), tr(lang, 'git.changesH') + ': ' + detail.files.length)}
                {detail.files.length === 0 ? (
                  <Text size="footnote" dimColor>{tr(lang, 'git.clean')}</Text>
                ) : (
                  detail.files.slice(0, 8).map(f => (
                    <Box key={'f-' + f.path} flexDirection="row" columnGap="md">
                      <Text size="footnote" mono dimColor>{f.status.padEnd(2, ' ')}</Text>
                      <Box flexShrink={1} minWidth={0}>
                        <Text size="footnote" wrap="truncate-start">{f.path}</Text>
                      </Box>
                    </Box>
                  ))
                )}
                {detail.files.length > 8 ? <Text size="footnote" dimColor>{tr(lang, 'git.more', { n: detail.files.length - 8 })}</Text> : null}
              </Box>
              <Box flexDirection="column">
                {draw(el, groupHeader(tr(lang, 'git.branchesH'), detail.branches.length, hue), tr(lang, 'git.branchesH') + ': ' + detail.branches.length)}
                {detail.branches.map(b => (
                  <Box key={'b-' + b.name} flexDirection="row" columnGap="md">
                    <Box flexShrink={1} minWidth={0}>
                      <Text size="footnote" weight={b.current ? 'semibold' : undefined} wrap="truncate">{b.name}</Text>
                    </Box>
                    <Box flexGrow={1} />
                    <Text size="footnote" dimColor>{b.current ? tr(lang, 'git.current') + ' · ' + b.when : b.when}</Text>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      ) : null

    // Sozinha no projeto, sem Git e sem filhas: nenhuma segunda linha (o "Sessões" sozinho sobrava, visto em 2026-11-15).
    const showPanelBtn = others.length > 0 || isOpen
    const hasRow = !!fleet || !!gitEl || otherKids.length > 0 || (!!motherTitle && tier === 'wide') || showPanelBtn
    const fleetRow = isSpace ? (
      <Box flexDirection="row" alignItems="center" columnGap={2}>
        {wait.count > 0 ? <Text dimColor>{tr(lang, 'band.waiting', { n: wait.count })}</Text> : null}
        <Box flexGrow={1} />
        {gitEl}
      </Box>
    ) : (
      <Box flexDirection="row" alignItems="center" columnGap={2} display={hasRow ? 'flex' : 'none'}>
        {fleet}
        {motherTitle && tier === 'wide' ? <Text dimColor wrap="truncate">{tr(lang, 'band.from', { title: motherTitle })}</Text> : null}
        {/* Filhas desta sessão em outro projeto não estão na frota (ela é só deste projeto): uma linha curta cada. */}
        {tier === 'wide' || tier === 'medium'
          ? otherKids.slice(0, 2).map(c => (
              <Text key={'kid-' + c.peer.id} color={c.status === 'precisa' ? 'warning' : undefined} dimColor={c.status !== 'precisa'} wrap="truncate">
                {'↳ ' + titleOf(c.peer, info.titles) + ' · ' + statusWord(c.status, lang)}
              </Text>
            ))
          : null}
        <Box flexGrow={1} />
        {gitEl}
        {showPanelBtn ? <Button
          key={P + 'painel'}
          variant={isOpen ? 'primary' : 'secondary'}
          plain={tier === 'minimal' ? true : undefined}
          dimColor={tier === 'minimal' ? true : undefined}
          label={tr(lang, 'band.panelBtn')}
          onPress={() => {}}
        /> : null}
      </Box>
    )

    // Cartão de retorno: só dados registrados pelo mod, sem modelo.
    const back = (await read($, volta)) as Volta
    const card = showReturn(back, now) ? (
      <Box flexDirection="row" alignItems="center" columnGap={1}>
        <Box flexShrink={1}>
          <Text dimColor wrap="truncate">{returnLine(back, now, lang)}</Text>
        </Box>
        <Button key={P + 'volta-fim'} plain dimColor label={tr(lang, 'band.dismiss')} onPress={() => {}} />
      </Box>
    ) : null

    if (!isOpen) {
      return (
        <Box flexDirection="column" rowGap={1}>
          {head}
          {alert}
          {fleetRow}
          {gitPanel}
          {card}
        </Box>
      )
    }

    const showToday = (await read($, hojeAberto)) === true
    const asking = (await read($, confirma)) === true
    const pending = ((await read($, arquivarIds)) as string[]).length

    // Linha do painel: número, título, coluna de estado (220 px), tempo (52 px) e ação (84 px).
    const sessionRow = (r: Row) => {
      const isMe = r.peer.id === id
      return (
        <Box key={'row-' + r.peer.id} flexDirection="row" alignItems="center" columnGap="md">
          {draw(el, numberPiece(numOf(r.peer.id), hue), tr(lang, 'band.sessionN', { n: numOf(r.peer.id) + 1 }))}
          <Box flexGrow={1} flexShrink={1}>
            <Text wrap="truncate">{titleOf(r.peer, info.titles)}</Text>
          </Box>
          <Box width={Math.round(220 / CELL)} flexShrink={0} flexDirection="row" alignItems="center" columnGap="sm">
            {draw(el, statusIconPiece(r.status, r.peer.waitingWhat, hue), statusWord(r.status, lang))}
            <Box flexShrink={1}>
              <Text dimColor wrap="truncate">{statusWords(r, now, lang)}</Text>
            </Box>
          </Box>
          <Box width={Math.round(52 / CELL)} flexShrink={0} justifyContent="flex-end">
            <Text dimColor wrap="truncate">{ago(now - r.peer.lastEventAt)}</Text>
          </Box>
          <Box width={Math.round(84 / CELL)} flexShrink={0}>
            {isMe ? (
              <Text dimColor>{tr(lang, 'band.thisWindow')}</Text>
            ) : (
              // Sempre à vista (apagado, acende sob o ponteiro): só no hover a ação some se a revelação falhar.
              <Button key={P + 'abrir-' + r.peer.id} plain dimColor label={tr(lang, 'band.openCap')} onPress={() => {}} />
            )}
          </Box>
        </Box>
      )
    }

    const sections = GROUPS.map(status => {
      const rows = group.mine.filter(r => r.status === status)
      if (rows.length === 0) return null
      if (status === 'hoje' && !showToday) {
        return <Button key={P + 'hoje'} plain dimColor label={tr(lang, rows.length === 1 ? 'band.todayOne' : 'band.todayMany', { n: rows.length })} onPress={() => {}} />
      }
      const title = tr(lang, ('band.g.' + status) as 'band.g.precisa')
      return (
        <Box key={'g-' + status} flexDirection="column" rowGap={0}>
          {draw(el, groupHeader(title, rows.length, hue), title + ': ' + rows.length)}
          {rows.map(sessionRow)}
        </Box>
      )
    })

    const archiveAsk = asking ? (
      <Box flexDirection="row" alignItems="center" columnGap={1}>
        <Text color="warning" wrap="truncate">{tr(lang, 'band.archiveAsk', { count: cnt(lang, pending, 'band.session') })}</Text>
        <Button key={P + 'arquivar-sim'} plain label={tr(lang, 'band.archiveYes')} onPress={() => {}} />
        <Button key={P + 'arquivar-nao'} plain dimColor label={tr(lang, 'band.archiveNo')} onPress={() => {}} />
      </Box>
    ) : null

    return (
      <Box flexDirection="column" rowGap={1}>
        {head}
        {alert}
        {fleetRow}
        {gitPanel}
        {card}
        {/* surface-2 e surface-3 são chaves do tema do Desktop: valem no claro e no escuro sem o mod saber o modo. */}
        <Box flexDirection="column" borderStyle="round" borderColor="subtle" backgroundColor="surface-2" paddingX="md" paddingY="sm" gap="sm">
          <Box flexDirection="row" alignItems="center" columnGap="sm">
            <Text weight="semibold">{tr(lang, 'band.sessionsOf', { label })}</Text>
            {draw(el, countPill(String(group.mine.length), 's4', hue), String(group.mine.length))}
            <Box flexGrow={1} />
            {info.old.length === 0 || asking ? null : <Button key={P + 'arquivar'} plain dimColor label={tr(lang, 'band.archiveBtn', { n: info.old.length })} onPress={() => {}} />}
          </Box>
          {archiveAsk}
          {sections}
          {group.antigas > 0 ? <Text dimColor>{tr(lang, group.antigas === 1 ? 'band.old' : 'band.olds', { n: group.antigas })}</Text> : null}
          {group.others.length > 0 ? <Text dimColor>{tr(lang, 'band.others', { n: group.others.length })}</Text> : null}
        </Box>
      </Box>
    )
  })

  // Os cliques: a função do botão some num redesenho, então tudo passa por aqui, pela key.
  // É o único ui.press do mod: também atende o clique da linha de trabalho (work.tsx).
  on('ui.press', async ($: any, e: any, next: any) => {
    if (await workPress($, e)) return { element: e.element }
    if (await cardPress($, e)) return { element: e.element }
    const key = String(e.element)
    if (!key.startsWith(P)) return next(e)
    try {
      const what = key.slice(P.length)
      if (what === 'painel' || what === 'esperando') await togglePanel($)
      else if (what === 'volta-fim') await voltaDismiss($)
      else if (what === 'hoje') await update($, hojeAberto, (v: boolean) => !v)
      else if (what === 'git') {
        const open = (await read($, gitAberto)) !== true
        await update($, gitAberto, () => open)
        if (open) void loadGitDetail($)
      }
      else if (what === 'arquivar') await askArchive($)
      else if (what === 'arquivar-nao') await clearArchive($)
      else if (what === 'arquivar-sim') await confirmArchive($)
      else if (what === 'abrir-alerta') {
        const all = (await read($, peers)) as PeerFile[]
        const me = all.find(p => p.id === myId())
        const first = me ? waitingMine(all, me, await $.clock.now())[0] : undefined
        if (first) await openSession($, first.peer.host)
      } else if (what.startsWith('abrir-')) {
        const peer = ((await read($, peers)) as PeerFile[]).find(p => p.id === what.slice('abrir-'.length))
        if (peer) await openSession($, peer.host)
      }
    } catch {
      // um clique que falha não derruba nada
    }
    $.ui.invalidate('ui.render')
    return { element: e.element }
  })
}
