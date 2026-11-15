// Cartão de ajustes (v0.5; visual v4 de 2026-11-15, as mesmas medidas e regras de cor da band): /skim-it
// sozinho, /skim-it ajustes e qualquer palavra desconhecida o abrem, como o /custom-theme do plugin oficial.
// O Desktop o desenha numa linha colocada ($.ui.place, hook de Placed); onde ninguém desenha linhas
// colocadas ele cai na band acima do prompt (cardBand, chamado pelo hook de AbovePrompt do band.tsx).
// Os cliques passam por cardPress, chamado pelo único ui.press do mod.
import { atom, read, update } from 'claude-code'

import { blockPiece, rulePiece } from './desenho'
import { draw } from './desenhar'
import { alternarPainel, autoLang, runImportar, setDensidade, setFundoSegue, setIdioma, setLook, setTipografia, storedLang } from './ajustes'
import { myId } from './fleet'
import type { PeerFile } from './fleetcore'
import { LANG_NAME, getLang, tr } from './i18n'
import { SCENE_HUE } from './look'
import type { ProjectState } from './project'
import { getDensity } from './work'
import { DENSITIES } from './worklog'
import type { Density } from './worklog'
import type { CartaoState } from '../types'

// O engine só aceita read e update de um atom declarado neste arquivo: a mesma referência (plugin e key
// literais, mesmo valor inicial) do arquivo dono, declarada de novo aqui.
const cartao = atom({ plugin: 'skim-it', key: 'cartao' } as const, { inBand: false, away: false, note: '' } as CartaoState)
const painel = atom({ plugin: 'skim-it', key: 'painel' } as const, false)
const peers = atom({ plugin: 'skim-it', key: 'peers' } as const, [] as PeerFile[])
const projeto = atom({ plugin: 'skim-it', key: 'projeto' } as const, { root: '', hue: SCENE_HUE, tipo: 'projeto', hasConfig: false } as ProjectState)
const tipografia = atom({ plugin: 'skim-it', key: 'tipografia' } as const, false)

const CARD = 'skim-it-ajustes'
const K = 'skim-c-' // prefixo das keys dos botões do cartão

/** Abre o cartão: colocado onde o Desktop desenha linhas colocadas, senão na band. */
export async function openCard($: any) {
  const placed = await $.ui.place({ id: CARD })
  await update($, cartao, (was: CartaoState) => ({ ...was, inBand: !placed.isPlaced, away: false }))
}

// Controle segmentado (shadcn Tabs): as opções lado a lado. Só um Button nativo recebe o clique e o
// Desktop desenha o `label`, nunca os filhos nem o raio. A trilha virou só botões: numa Box com borda ela
// saía uma moldura pesada e o fundo surface-3 não pintou (visto em 2026-11-15). A escolhida é o botão
// primário; as outras, botões sem moldura e apagados.
function segmented(Button: any, Box: any, items: [string, string, boolean][]) {
  return (
    <Box flexDirection="row" alignItems="center" gap="xs">
      {items.map(([key, label, isOn]) =>
        isOn ? (
          <Button key={K + key} label={label} variant="primary" onPress={() => {}} />
        ) : (
          <Button key={K + key} label={label} plain dimColor onPress={() => {}} />
        ),
      )}
    </Box>
  )
}

// A resposta do importar traz a proposta inteira (JSON); no cartão vale só o que se lê: as frases, sem o
// corpo do arquivo, no máximo três (visto em 2026-11-15: o JSON cru tomava o grupo).
export function noteSummary(note: string): string {
  const lines = note.split('\n').map(l => l.trim()).filter(l => l && !/^[{}\[\]"]/.test(l))
  return lines.slice(0, 3).join(' ')
}

// Linha de ajuste como numa página de configurações: nome (13/500) e descrição (12, secundária) à
// esquerda, controle à direita; em janela estreita (menos de 520 px) o controle desce para baixo do nome.
function settingRow(el: any, key: string, label: string, help: string, control: any, narrow: boolean) {
  const { Box, Text } = el
  return (
    <Box key={key} flexDirection={narrow ? 'column' : 'row'} justifyContent="space-between" alignItems={narrow ? 'flex-start' : 'center'} columnGap="lg" rowGap="xs" paddingX="sm" paddingY="xs">
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        <Text weight="medium">{label}</Text>
        <Text size="footnote" dimColor>
          {help}
        </Text>
      </Box>
      <Box flexDirection="row" flexShrink={0} alignItems="center" gap="xs">
        {control}
      </Box>
    </Box>
  )
}

// Seção: rótulo pequeno em caixa alta (11/600) e um grupo com borda fina; as linhas se separam por uma
// divisória de 1 px (SVG, na cor de borda dos dois modos), de largura estimada pela janela.
function section(el: any, key: string, title: string, rows: any[], ruleW: number, hue: number) {
  const { Box, Text } = el
  const parts: any[] = []
  rows.forEach((row, i) => {
    if (i > 0) parts.push(<Box key={key + '-d' + i}>{draw(el, rulePiece(ruleW, hue), '-')}</Box>)
    parts.push(row)
  })
  return (
    <Box key={key} flexDirection="column" gap="xs">
      <Text size="caption" weight="semibold" dimColor>
        {title}
      </Text>
      <Box flexDirection="column" borderStyle="round" borderColor="subtle">
        {parts}
      </Box>
    </Box>
  )
}

async function cardView($: any, e: any) {
  const lang = getLang()
  const el = $.ui.resolve(e)
  const { Box, Text, Button } = el
  const px = Math.round((typeof e.props?.bodyColumns === 'number' ? e.props.bodyColumns : 120) * 7)
  const narrow = px < 520
  const ruleW = Math.max(40, px - 2 * 16 - 2) // a janela menos o padding do cartão e as bordas
  const lookOn = (await $.store.get('look')) !== false
  const follows = (await $.store.get('fundoSegue')) !== false
  const typoOn = (await read($, tipografia)) === true
  const density = await getDensity($)
  const panelOpen = (await read($, painel)) === true
  const proj = (await read($, projeto)) as ProjectState
  const me = ((await read($, peers)) as PeerFile[]).find(p => p.id === myId())
  const name = me?.label || (proj.root.split('/').filter(Boolean).pop() ?? '') || tr(lang, 'label.session')
  const note = ((await read($, cartao)) as CartaoState).note
  const chosen = await storedLang($)
  const autoName = LANG_NAME[await autoLang($)]
  const word = (d: Density) => tr(lang, ('d.' + d) as 'd.compacto').replace(/^./, c => c.toUpperCase())
  const seg = (items: [string, string, boolean][]) => segmented(Button, Box, items)
  const sec = (key: string, title: string, rows: any[]) => section(el, key, title, rows, ruleW, proj.hue)
  const row = (key: string, label: string, help: string, control: any) => settingRow(el, key, label, help, control, narrow)

  // Cartão: raio 10, borda de 1 px, padding 16 e espaço 18. Fundo surface-2: chave do tema do Desktop, vale nos dois modos.
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="subtle" backgroundColor="surface-2" paddingX="md" paddingY="md" gap="lg">
      <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start" columnGap="md">
        <Box flexDirection="column" flexShrink={1}>
          <Text size="title" weight="semibold">
            {tr(lang, 'card.title')}
          </Text>
          <Text size="footnote" dimColor>
            {tr(lang, 'card.subtitle')}
          </Text>
        </Box>
        <Button key={K + 'fechar'} label={tr(lang, 'card.close')} role="dismiss" plain dimColor autoFocus onPress={() => {}} />
      </Box>

      {sec('s-look', tr(lang, 'card.secLook'), [
        row('r-look', tr(lang, 'card.look'), tr(lang, 'card.lookHelp'), seg([['look-on', tr(lang, 'card.on'), lookOn], ['look-off', tr(lang, 'card.off'), !lookOn]])),
        row('r-fundo', tr(lang, 'card.follow'), tr(lang, 'card.followHelp'), seg([['fundo-on', tr(lang, 'card.yes'), follows], ['fundo-off', tr(lang, 'card.no'), !follows]])),
        row('r-tip', tr(lang, 'card.typo'), tr(lang, 'card.typoHelp'), seg([['tip-on', tr(lang, 'card.typoOn'), typoOn], ['tip-off', tr(lang, 'card.typoOff'), !typoOn]])),
      ])}

      {sec('s-read', tr(lang, 'card.secRead'), [
        // Só a descrição da densidade escolhida: a frase das três juntas não se lia.
        row('r-dens', tr(lang, 'card.density'), tr(lang, ('card.dens.' + density) as 'card.dens.compacto'),
          seg(DENSITIES.map(d => ['dens-' + d, word(d), density === d] as [string, string, boolean]))),
      ])}

      {sec('s-proj', tr(lang, 'card.secProject'), [
        row('r-cor', tr(lang, 'card.color'), tr(lang, proj.hasConfig ? 'card.colorFile' : 'card.colorAuto'),
          <Box key="chip">{draw(el, blockPiece(name, proj.hue, 180), name)}</Box>),
        row('r-marca', tr(lang, 'card.brand'), tr(lang, 'card.brandHelp'), [
          <Button key={K + 'cor-propor'} label={tr(lang, 'card.propose')} variant="secondary" onPress={() => {}} />,
          <Button key={K + 'cor-aprovar'} label={tr(lang, 'card.approve')} variant="secondary" onPress={() => {}} />,
          ...(proj.hasConfig ? [<Button key={K + 'cor-substituir'} label={tr(lang, 'card.replace')} variant="secondary" dimColor onPress={() => {}} />] : []),
        ]),
        ...(note
          ? [
              <Box key="nota" paddingX="sm" paddingY="xs">
                <Text size="footnote" dimColor>
                  {noteSummary(note)}
                </Text>
              </Box>,
            ]
          : []),
        row('r-painel', tr(lang, 'card.sessions'), tr(lang, 'card.sessionsHelp'),
          seg([['painel-on', tr(lang, 'card.show'), panelOpen], ['painel-off', tr(lang, 'card.hide'), !panelOpen]])),
      ])}

      {sec('s-geral', tr(lang, 'card.secGeneral'), [
        row('r-lang', tr(lang, 'card.lang'), tr(lang, 'card.langHelp', { name: autoName }),
          seg([
            ['lang-auto', tr(lang, 'card.auto'), chosen === 'auto'],
            ['lang-pt', LANG_NAME.pt, chosen === 'pt'],
            ['lang-en', LANG_NAME.en, chosen === 'en'],
          ])),
      ])}

      <Box flexDirection="row" alignItems="center" flexWrap="wrap" columnGap="sm">
        <Text size="footnote" dimColor>
          {tr(lang, 'card.foot')}
        </Text>
        {/* Sem caixa: a moldura redonda do Desktop pesava mais que o próprio comando. */}
        <Text size="footnote" mono>
          {tr(lang, 'card.footEx')}
        </Text>
        <Text size="footnote" dimColor>
          {tr(lang, 'card.footHelp')}
        </Text>
      </Box>
    </Box>
  )
}

/** O cartão para a band, quando ele está aberto e o Desktop não o desenha no lugar; senão null. */
export async function cardBand($: any, e: any) {
  const state = (await read($, cartao)) as CartaoState
  if (state.inBand !== true || state.away === true) return null
  return cardView($, e)
}

export function registerCard(on: any) {
  // A linha colocada: o cartão, ou nada depois de Fechar (um hook que passa desenha uma linha vazia).
  on('ui.render', { component: 'Placed' }, async ($: any, e: any, next: any) => {
    if (e.props.plugin !== 'skim-it' || e.props.id !== CARD) return next(e)
    if (((await read($, cartao)) as CartaoState).away === true) return next(e)
    return cardView($, e)
  })
}

/** Clique num botão do cartão (key 'skim-c-...'): faz o mesmo que o comando. true quando o clique era dele. */
export async function cardPress($: any, e: any): Promise<boolean> {
  const key = String(e.element)
  if (!key.startsWith(K)) return false
  const what = key.slice(K.length)
  try {
    if (what === 'fechar') await update($, cartao, (was: CartaoState) => ({ ...was, inBand: false, away: true }))
    else if (what === 'look-on' || what === 'look-off') await setLook($, what === 'look-on')
    else if (what === 'fundo-on' || what === 'fundo-off') await setFundoSegue($, what === 'fundo-on')
    else if (what === 'tip-on' || what === 'tip-off') await setTipografia($, what === 'tip-on')
    else if (what.startsWith('dens-') && (DENSITIES as readonly string[]).includes(what.slice(5))) await setDensidade($, what.slice(5) as Density)
    else if (what === 'painel' || what === 'painel-on' || what === 'painel-off') {
      // Mostrar e Ocultar só alternam quando o painel não está já como pedido.
      const isOpen = (await read($, painel)) === true
      if (what === 'painel' || isOpen !== (what === 'painel-on')) await alternarPainel($)
    }
    else if (what === 'cor-propor' || what === 'cor-aprovar' || what === 'cor-substituir') {
      const text = await runImportar($, what === 'cor-propor' ? 'propor' : what === 'cor-aprovar' ? 'aprovar' : 'aprovar!')
      await update($, cartao, (was: CartaoState) => ({ ...was, note: text }))
    } else if (what === 'lang-auto' || what === 'lang-pt' || what === 'lang-en') await setIdioma($, what.slice(5) as 'auto' | 'pt' | 'en')
  } catch (error) {
    $.ui.toast(String(error).slice(0, 160))
  }
  // A escolha marcada no cartão só muda com um redesenho.
  $.ui.invalidate('ui.render')
  return true
}
