export type CiState = '' | 'pass' | 'fail' | 'pending'

export type GitInfo = {
  repo: string
  branch: string
  files: number
  add: number
  del: number
  ahead: number
  behind: number
  pr?: { num: number; state: string; draft: boolean; ci: CiState }
}

export type PeerKind = 'working' | 'background' | 'waiting' | 'review' | 'idle'
export type WaitingWhat = 'responder pergunta' | `aprovar ${string}`

export type PeerFile = {
  id: string
  host: string // id da sessão no Desktop (local_...)
  parentHost?: string
  root: string // diretório comum do git, ou a pasta
  cwd: string
  label: string // nome do projeto
  topic: string
  kind: PeerKind
  waitingWhat?: WaitingWhat
  background?: { agents: number; shells: number; wakeAt?: number }
  lastTurnAt: number
  lastEventAt: number // último passo de turno ou ferramenta (para sem-sinal)
  startedAt: number
  updatedAt: number
  editedFiles: number // arquivos editados no último turno
}

export type Links = { ok: boolean; titles: Record<string, string>; links: Record<string, string>; old: { host: string; title: string }[] }

// Uma entrada da lista aberta: o que o modelo disse entre ferramentas, ou uma ferramenta.
export type Entry = { kind: 'say'; text: string } | { kind: 'tool'; tool: string; gist: string; failed: boolean }

// Um turno terminado cujo trabalho a linha recolhe.
// items: o que o turno desenhou: 't:<texto>' (passo), 'u:<tool_use_id>' (ferramenta),
// 'r:<id da mensagem>' (bloco desenhado, inclusive o resumo que o Desktop mostra no lugar da narração).
export type DoneTurn = {
  durationMs: number
  steps: number
  failures: number
  files: number
  items: string[]
  first: string
  final: string
  log: Entry[]
}

export type Intensidade = 'vibrante' | 'denso'

/** Estado do projeto desta sessão, lido de `.claude/skim-it.json` e da raiz do git. */
export type ProjectState = { root: string; hue: number; accent?: string; intensidade?: Intensidade; tipo: 'projeto' | 'espaço'; hasConfig: boolean }

export type Volta = { since: number; turns: number; files: number; commits: number; dismissed: boolean }

// Detalhe do Git, carregado quando o painel do Git abre: arquivos alterados, branches recentes e PRs.
export type GitArquivo = { status: string; path: string }
export type GitBranch = { name: string; when: string; current: boolean }
export type GitPr = { num: number; title: string; state: string; draft: boolean; ci: CiState; branch: string; url: string }
export type GitDetalhe = { files: GitArquivo[]; branches: GitBranch[]; prs: GitPr[]; current?: GitPr; gh: boolean }

/** Cartão de ajustes: inBand quando o Desktop não o desenha no lugar (cai na band), away depois de Fechar, note a resposta da cor do projeto. */
export type CartaoState = { inBand: boolean; away: boolean; note: string }

declare module 'claude-code' {
  interface PluginState {
    // tipografia: títulos e réguas na resposta.
    // turns: turnos terminados cujo trabalho a linha recolhe; open: ids abertos; densidade: compacto | equilibrado | detalhado.
    // peers: arquivos das sessões lidos de ~/.claude/skim-it/fleet; painel: painel da band aberto; hojeAberto: grupo "paradas hoje" aberto;
    // confirma: segunda etapa do arquivamento em lote; links: o que o Desktop diz (títulos, links, sessões antigas);
    // arquivarIds: ids listados no passo de confirmar; turnoVivo: turno da conversa principal rodando;
    // assunto: assunto automático desta sessão; git: branch, alterações e PR;
    // projeto: raiz, matiz, acento, intensidade e tipo; volta: o que rodou sem você desde o último pedido;
    // cartao: o cartão de ajustes (/skim-it).
    'skim-it': {
      tipografia: boolean
      turns: Record<string, DoneTurn>
      open: string[]
      densidade: string
      peers: PeerFile[]
      painel: boolean
      hojeAberto: boolean
      confirma: boolean
      arquivarIds: string[]
      turnoVivo: boolean
      links: Links
      assunto: string
      git: GitInfo | null
      projeto: ProjectState
      volta: Volta
      cartao: CartaoState
      gitAberto: boolean
      gitDetalhe: GitDetalhe | null
    }
  }
}
