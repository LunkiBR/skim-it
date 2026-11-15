// Tom desta sessão entre as vivas do projeto: o mesmo da band, para a barra das mensagens e o ponto da linha de trabalho.
import { atom, read } from 'claude-code'

import { myId } from './fleet'
import { toneIndex } from './fleetcore'
import type { PeerFile } from './fleetcore'
import { sessionToneHex } from './project'
import type { ProjectState } from './project'
import { SCENE_HUE } from './look'

// O engine só aceita read e update de um atom declarado neste arquivo: a mesma referência (plugin e key
// literais, mesmo valor inicial) do arquivo dono, declarada de novo aqui.
const peers = atom({ plugin: 'skim-it', key: 'peers' } as const, [] as PeerFile[])
const projeto = atom({ plugin: 'skim-it', key: 'projeto' } as const, { root: '', hue: SCENE_HUE, tipo: 'projeto', hasConfig: false } as ProjectState)

export async function toneHex($: any): Promise<string> {
  const all = (await read($, peers)) as PeerFile[]
  const proj = (await read($, projeto)) as ProjectState
  const id = myId()
  const mine = all.find(p => p.id === id)
  const t = mine ? toneIndex(all, mine.root, id) : { index: 0, total: 1 }
  return sessionToneHex(proj.hue, t.index, t.total)
}
