// Idioma do mod (v0.5): pt e en, tabelas de texto, resolução do idioma e leitura dos comandos nas
// duas línguas. Puro, sem `$`: o que precisa do engine (settings, store) mora em ajustes.ts.
// Testada em scripts/check-i18n.mjs.

export type Lang = 'pt' | 'en'

/** Texto livre do `language` do Claude Code ("portuguese", "pt-BR", "Português", "english"...). */
function langOf(text: string | null | undefined): Lang | undefined {
  const s = (text ?? '').trim()
  if (/^pt|portug/i.test(s)) return 'pt'
  if (/^en|engl|ingl/i.test(s)) return 'en'
  return undefined
}

/** O idioma: a escolha do mod ('pt'|'en') vence; senão o `language` do Claude Code; senão o locale; senão en. */
export function resolveLang(override: string | null | undefined, settingLanguage: string | null | undefined, locale: string | null | undefined): Lang {
  if (override === 'pt' || override === 'en') return override
  const fromSetting = langOf(settingLanguage)
  if (fromSetting) return fromSetting
  return /^pt/i.test((locale ?? '').trim()) ? 'pt' : 'en'
}

// O idioma atual é uma variável do módulo: todo arquivo o lê daqui, sem atom. ajustes.ts o escreve
// (session.start e o cartão) e invalida o desenho.
let current: Lang = 'pt'
export const getLang = (): Lang => current
export function setLang(lang: Lang) {
  current = lang
}

export const LANG_NAME: Record<Lang, string> = { pt: 'Português', en: 'English' }

const PT = {
  // linha de trabalho
  'work.worked': 'Trabalhou {time}',
  'step.one': 'passo',
  'step.many': 'passos',
  'file.one': 'arquivo',
  'file.many': 'arquivos',
  'failure.one': 'falha',
  'failure.many': 'falhas',
  'work.failed': 'falhou',
  'work.last': 'última resposta {time} · {steps}',
  'work.spinner': 'passo',
  // sessões em paralelo
  'st.waits': 'espera você',
  'st.running': 'rodando',
  'st.bg': 'segundo plano',
  'st.ready': 'pronta para revisar',
  'st.nosignal': 'sem sinal há {t}',
  'st.idle': 'parada há {t}',
  'sw.precisa': 'precisa de você',
  'sw.rodando': 'rodando',
  'sw.segundo-plano': 'segundo plano',
  'sw.pronta': 'pronta',
  'sw.sem-sinal': 'sem sinal',
  'sw.parada': 'parada',
  'wait.question': 'responder pergunta',
  'wait.approve': 'aprovar {tool}',
  'agent.one': 'agente',
  'agent.many': 'agentes',
  'shell.one': 'comando',
  'shell.many': 'comandos',
  'label.session': 'sessão',
  // retorno e Git
  'back.line': 'Enquanto você estava fora ({ago}): {parts}',
  'turn.one': 'turno',
  'turn.many': 'turnos',
  'commit.one': 'commit',
  'commit.many': 'commits',
  'git.draft': 'rascunho',
  'git.title': 'Git',
  'git.changesH': 'Alterações',
  'git.branchesH': 'Branches recentes',
  'git.prsH': 'Pull requests',
  'git.loading': 'Carregando o Git…',
  'git.noGh': 'Sem PRs: o gh não está disponível ou sem login.',
  'git.noPrs': 'Nenhum PR aberto.',
  'git.clean': 'Nada alterado.',
  'git.more': '+{n} arquivos',
  'git.current': 'atual',
  'git.openPr': 'Abrir',
  'git.close': 'Fechar',
  'git.thisPr': 'PR desta branch',
  'git.merged': 'mergeado',
  'git.closed': 'fechado',
  // band
  'band.nosubject': 'sem assunto',
  'band.from': '↳ de {title}',
  'band.waiting': '{n} esperando',
  'band.waitingBtn': '{n} esperando ▸',
  'band.panelOpen': '▴ painel',
  'band.panelClosed': '▾ painel',
  'band.waitsYou': '{title} espera você',
  'band.more': ' · +{n} esperando',
  'band.open': 'abrir',
  'band.dismiss': 'dispensar',
  'band.thisSession': 'esta sessão',
  'band.g.precisa': 'Precisa de você',
  'band.g.rodando': 'Rodando',
  'band.g.segundo-plano': 'Em segundo plano',
  'band.g.pronta': 'Prontas para revisar',
  'band.g.sem-sinal': 'Sem sinal',
  'band.g.recente': 'Paradas recentes',
  'band.g.hoje': 'Paradas hoje',
  'band.todayOne': '▸ {n} parada hoje',
  'band.todayMany': '▸ {n} paradas hoje',
  'band.archiveAsk': 'Arquivar {count}? O Desktop ainda pede aprovação de cada uma.',
  'band.session.one': 'sessão',
  'band.session.many': 'sessões',
  'band.archiveYes': 'arquivar',
  'band.archiveNo': 'cancelar',
  'band.archiveOld': 'arquivar paradas há mais de 30 dias ({n})',
  'band.sessionsOf': 'Sessões de {label}',
  'band.old': '{n} antiga',
  'band.olds': '{n} antigas',
  'band.others': 'outros projetos: {n}',
  'band.of': 'de {n}',
  'band.sessionN': 'Sessão {n}',
  'band.needsYou': 'Sessão {n} precisa de você',
  'band.openN': 'Abrir sessão {n}',
  'band.panelBtn': 'Sessões',
  'band.openCap': 'Abrir',
  'band.thisWindow': 'esta janela',
  'band.archiveBtn': 'Arquivar paradas ({n})',
  'band.fleetAlt': 'Sessões do projeto: {list}',
  'change.one': 'alteração',
  'change.many': 'alterações',
  // arquivamento (toasts e motivo)
  'arch.done': 'arquivadas {done} de {n}',
  'arch.fail': 'não consegui arquivar: {err}',
  'arch.reason': 'parada há mais de 30 dias',
  'desk.timeout': 'o Desktop não respondeu a tempo',
  // assunto automático
  'topic.head': 'Diga em 2 a 5 palavras o trabalho que esta sessão está fazendo agora, em português, minúsculas, sem pontuação. Baseie-se no que foi feito, não só no pedido. Responda só com o assunto.',
  'topic.current': 'Assunto atual: {v}',
  'topic.none': '(nenhum)',
  'topic.asked': 'Último pedido: {v}',
  'topic.did': 'O que a sessão fez e respondeu: {v}',
  'topic.tail': 'Se o trabalho continua o mesmo, ou o pedido for só continuação (sim, ok, pode ir, gostei, números ou escolhas), responda exatamente o assunto atual.',
  // fundo
  'alt.idle': 'Fundo fosco na cor do projeto',
  'alt.working': 'Fundo fosco com a cor do projeto mais presente: trabalhando',
  'alt.waiting': 'Fundo fosco com brilho quente no alto: a sessão espera você',
  'scene.idle': 'em repouso',
  'scene.working': 'trabalhando',
  'scene.waiting': 'esperando você',
  // look
  'look.unset': 'look ainda não aplicado',
  'look.off': 'look desligado',
  'look.base': 'look base',
  'look.baseBad': 'look base (o do projeto não pinta no Desktop: {why})',
  'look.project': 'look do projeto (matiz {hue}{extra})',
  'look.refused': 'look recusado pelo engine: {err}',
  'look.none': 'nenhuma',
  'look.applied': '{kind} aplicado (telas: {surf})',
  'look.notDrawn': '{kind} não desenhado{kept}: {reason} (telas: {surf})',
  'look.kept': ', guardado para quando uma tela que pinta temas conectar',
  // comandos
  'cmd.description': 'skim-it: ajustes, look, tipografia, densidade e painel. Sozinho abre o cartão de ajustes; também /skim-it tipografia on|off · /skim-it densidade compacto|equilibrado|detalhado · /skim-it look on|off · /skim-it painel · /skim-it idioma auto|pt|en',
  'cmd.tipOn': 'tipografia ligada nesta sessão',
  'cmd.tipOff': 'tipografia desligada nesta sessão',
  'cmd.dens': 'densidade {v}',
  'cmd.panel': 'painel alternado',
  'cmd.lookOff': 'look desligado: o Desktop volta ao tema dele',
  'cmd.fundoOn': 'fundo segue ligado: {look}',
  'cmd.fundoOff': 'fundo segue desligado: {look}',
  'cmd.lang': 'idioma: {name}',
  'cmd.langAuto': 'idioma: automático ({name})',
  'cmd.noProject': 'Projeto ainda não identificado.',
  'cmd.card': 'Ajustes abertos: escolha no cartão.',
  'cmd.demoOn': 'Demonstração ligada: a band mostra uma frota de exemplo com 7 sessões. /skim-it demo desliga.',
  'cmd.demoOff': 'Demonstração desligada: a band volta às sessões reais.',
  'cmd.importFail': 'importar falhou: {err}',
  'unk': 'Não conheço "{word}"{scope}.{near} Abri os ajustes.',
  'unk.in': ' em {cmd}',
  'unk.near': ' Mais perto: {near}.',
  'help':
    'skim-it v0.4\n' +
    '/skim-it                    abre os ajustes (também para qualquer palavra que eu não conheça)\n' +
    '/skim-it tipografia on|off  títulos um degrau acima e régua entre seções na resposta\n' +
    '/skim-it densidade compacto|equilibrado|detalhado  quanto do trabalho do turno aparece\n' +
    '/skim-it look on|off        look base do skim-it no Desktop\n' +
    '/skim-it painel             abre ou fecha o painel de sessões na band\n' +
    '/skim-it fundo segue on|off o look segue o projeto da sessão onde você digitou por último (off: look base fixo)\n' +
    '/skim-it importar           propõe .claude/skim-it.json a partir dos arquivos do projeto; "importar aprovar" grava (já existindo, só "importar aprovar!" troca)\n' +
    '/skim-it idioma auto|pt|en  idioma do mod (auto segue o idioma do Claude Code)',
  'help.now': 'agora: tipografia {tip}; {look}; fundo {scene}; frota: {fleet}; {desk}',
  'help.on': 'ligada',
  'help.off': 'desligada',
  'help.fleet.one': 'sessão',
  'help.fleet.many': 'sessões',
  'help.deskOk': 'Desktop respondendo',
  'help.deskDown': 'Desktop sem resposta (mãe, títulos e arquivamento indisponíveis)',
  // importar
  'imp.written': 'Proposta gravada em .claude/skim-it.proposta.json ({n} arquivos lidos):',
  'imp.evidence': 'Evidência:',
  'imp.noColor': 'Nenhuma cor de marca encontrada; sem marca o matiz vem da paleta de reserva.',
  'imp.exists': 'Já existe .claude/skim-it.json: /skim-it importar aprovar recusa; só /skim-it importar aprovar! copia a proposta por cima dele.',
  'imp.fresh': '/skim-it importar aprovar copia a proposta para .claude/skim-it.json.',
  'imp.existsStop': 'Já existe .claude/skim-it.json e nada foi gravado. Para trocá-lo pela proposta, digite /skim-it importar aprovar!',
  'imp.noProposal': 'Não há proposta: rode /skim-it importar primeiro.',
  'imp.invalid': 'A proposta não é válida ({errs}); nada foi gravado.',
  'imp.saved': '.claude/skim-it.json gravado a partir da proposta.',
  'imp.refusal': 'A raiz ({root}) fica dentro de .git (submódulo ou repositório bare): não leio nem gravo aqui.',
  // skim-it.json
  'cfg.badJson': 'JSON inválido: {msg}',
  'cfg.root': 'a raiz deve ser um objeto',
  'cfg.unknownKey': 'chave desconhecida: {k}',
  'cfg.tipo': 'tipo deve ser "projeto" ou "espaço"',
  'cfg.marcaObj': 'marca deve ser um objeto',
  'cfg.marcaKey': 'chave desconhecida em marca: {k}',
  'cfg.marcaHex': 'marca.{k} deve ser hex #rrggbb',
  'cfg.marcaReq': 'marca.primaria é obrigatória',
  'cfg.areasList': 'areas deve ser uma lista',
  'cfg.areaObj': 'areas[{i}] deve ser um objeto',
  'cfg.areaKey': 'chave desconhecida em areas[{i}]: {k}',
  'cfg.areaPath': 'areas[{i}].caminho deve ser um texto não vazio',
  'cfg.areaInt': 'areas[{i}].intensidade deve ser "vibrante" ou "denso"',
  'cfg.invalid': 'skim-it.json inválido: {err}',
  // densidades
  'd.compacto': 'compacto',
  'd.equilibrado': 'equilibrado',
  'd.detalhado': 'detalhado',
  // cartão de ajustes
  'card.title': 'Ajustes do skim-it',
  'card.subtitle': 'Aparência, leitura e sessões. Vale para todas as janelas.',
  'card.close': 'Fechar',
  'card.secLook': 'APARÊNCIA',
  'card.secRead': 'LEITURA',
  'card.secProject': 'PROJETO',
  'card.secGeneral': 'GERAL',
  'card.look': 'Look',
  'card.lookHelp': 'Paleta calma e fundo fosco do skim-it',
  'card.on': 'Ligado',
  'card.off': 'Desligado',
  'card.follow': 'Fundo segue o projeto',
  'card.followHelp': 'A cor vem do projeto da última sessão em que você digitou',
  'card.yes': 'Sim',
  'card.no': 'Não',
  'card.typo': 'Tipografia',
  'card.typoHelp': 'Títulos maiores e uma régua entre as seções da resposta',
  'card.typoOn': 'Ligada',
  'card.typoOff': 'Desligada',
  'card.density': 'Densidade do trabalho',
  'card.dens.compacto': 'Uma linha por turno; um clique abre o que foi feito',
  'card.dens.equilibrado': 'Narração apagada e uma linha por grupo de ferramentas',
  'card.dens.detalhado': 'Tudo, como o app desenha',
  'card.color': 'Cor do projeto',
  'card.colorAuto': 'Sorteada pelo caminho da pasta; o projeto não tem arquivo de marca',
  'card.colorFile': 'Do arquivo .claude/skim-it.json',
  'card.brand': 'Arquivo de marca',
  'card.brandHelp': 'Propõe .claude/skim-it.json a partir das cores do repositório',
  'card.propose': 'Propor',
  'card.approve': 'Aprovar',
  'card.replace': 'Substituir',
  'card.sessions': 'Painel de sessões',
  'card.sessionsHelp': 'As sessões deste projeto por estado, acima do campo de texto',
  'card.show': 'Mostrar',
  'card.hide': 'Ocultar',
  'card.lang': 'Idioma',
  'card.langHelp': 'Automático segue o Claude Code e o sistema (agora: {name})',
  'card.auto': 'Automático',
  'card.foot': 'Cada ajuste também é um comando:',
  'card.footEx': '/skim-it densidade equilibrado',
  'card.footHelp': '/skim-it ajuda lista todos.',
} as const

export type Key = keyof typeof PT

const EN: Record<Key, string> = {
  'work.worked': 'Worked {time}',
  'step.one': 'step',
  'step.many': 'steps',
  'file.one': 'file',
  'file.many': 'files',
  'failure.one': 'failure',
  'failure.many': 'failures',
  'work.failed': 'failed',
  'work.last': 'last answer {time} · {steps}',
  'work.spinner': 'step',
  'st.waits': 'waits for you',
  'st.running': 'running',
  'st.bg': 'background',
  'st.ready': 'ready to review',
  'st.nosignal': 'no signal for {t}',
  'st.idle': 'idle for {t}',
  'sw.precisa': 'needs you',
  'sw.rodando': 'running',
  'sw.segundo-plano': 'background',
  'sw.pronta': 'ready',
  'sw.sem-sinal': 'no signal',
  'sw.parada': 'idle',
  'wait.question': 'answer question',
  'wait.approve': 'approve {tool}',
  'agent.one': 'agent',
  'agent.many': 'agents',
  'shell.one': 'command',
  'shell.many': 'commands',
  'label.session': 'session',
  'back.line': 'While you were away ({ago}): {parts}',
  'turn.one': 'turn',
  'turn.many': 'turns',
  'commit.one': 'commit',
  'commit.many': 'commits',
  'git.draft': 'draft',
  'git.title': 'Git',
  'git.changesH': 'Changes',
  'git.branchesH': 'Recent branches',
  'git.prsH': 'Pull requests',
  'git.loading': 'Loading Git…',
  'git.noGh': 'No PRs: gh is unavailable or not signed in.',
  'git.noPrs': 'No open PRs.',
  'git.clean': 'Nothing changed.',
  'git.more': '+{n} files',
  'git.current': 'current',
  'git.openPr': 'Open',
  'git.close': 'Close',
  'git.thisPr': 'PR for this branch',
  'git.merged': 'merged',
  'git.closed': 'closed',
  'band.nosubject': 'no topic',
  'band.from': '↳ from {title}',
  'band.waiting': '{n} waiting',
  'band.waitingBtn': '{n} waiting ▸',
  'band.panelOpen': '▴ panel',
  'band.panelClosed': '▾ panel',
  'band.waitsYou': '{title} is waiting for you',
  'band.more': ' · +{n} waiting',
  'band.open': 'open',
  'band.dismiss': 'dismiss',
  'band.thisSession': 'this session',
  'band.g.precisa': 'Needs you',
  'band.g.rodando': 'Running',
  'band.g.segundo-plano': 'In the background',
  'band.g.pronta': 'Ready to review',
  'band.g.sem-sinal': 'No signal',
  'band.g.recente': 'Recently idle',
  'band.g.hoje': 'Idle today',
  'band.todayOne': '▸ {n} idle today',
  'band.todayMany': '▸ {n} idle today',
  'band.archiveAsk': 'Archive {count}? The Desktop still asks you to approve each one.',
  'band.session.one': 'session',
  'band.session.many': 'sessions',
  'band.archiveYes': 'archive',
  'band.archiveNo': 'cancel',
  'band.archiveOld': 'archive sessions idle for over 30 days ({n})',
  'band.sessionsOf': '{label} sessions',
  'band.old': '{n} old',
  'band.olds': '{n} old',
  'band.others': 'other projects: {n}',
  'band.of': 'of {n}',
  'band.sessionN': 'Session {n}',
  'band.needsYou': 'Session {n} needs you',
  'band.openN': 'Open session {n}',
  'band.panelBtn': 'Sessions',
  'band.openCap': 'Open',
  'band.thisWindow': 'this window',
  'band.archiveBtn': 'Archive idle ({n})',
  'band.fleetAlt': 'Project sessions: {list}',
  'change.one': 'change',
  'change.many': 'changes',
  'arch.done': 'archived {done} of {n}',
  'arch.fail': 'could not archive: {err}',
  'arch.reason': 'idle for over 30 days',
  'desk.timeout': 'the Desktop did not answer in time',
  'topic.head': 'In 2 to 5 words, say what work this session is doing right now, in English, lowercase, no punctuation. Go by what was done, not only by the request. Answer with the topic only.',
  'topic.current': 'Current topic: {v}',
  'topic.none': '(none)',
  'topic.asked': 'Last request: {v}',
  'topic.did': 'What the session did and answered: {v}',
  'topic.tail': 'If the work is still the same, or the request is only a continuation (yes, ok, go ahead, liked it, numbers or choices), answer exactly the current topic.',
  'alt.idle': 'Frosted background in the project color',
  'alt.working': 'Frosted background with the project color stronger: working',
  'alt.waiting': 'Frosted background with a warm glow at the top: the session is waiting for you',
  'scene.idle': 'idle',
  'scene.working': 'working',
  'scene.waiting': 'waiting for you',
  'look.unset': 'look not applied yet',
  'look.off': 'look off',
  'look.base': 'base look',
  'look.baseBad': 'base look (the project one does not paint on the Desktop: {why})',
  'look.project': 'project look (hue {hue}{extra})',
  'look.refused': 'look refused by the engine: {err}',
  'look.none': 'none',
  'look.applied': '{kind} applied (surfaces: {surf})',
  'look.notDrawn': '{kind} not drawn{kept}: {reason} (surfaces: {surf})',
  'look.kept': ', kept for when a surface that paints themes connects',
  'cmd.description': 'skim-it: settings, look, typography, density and panel. Alone it opens the settings card; also /skim-it typography on|off · /skim-it density compact|balanced|detailed · /skim-it look on|off · /skim-it panel · /skim-it language auto|pt|en',
  'cmd.tipOn': 'typography on for this session',
  'cmd.tipOff': 'typography off for this session',
  'cmd.dens': 'density {v}',
  'cmd.panel': 'panel toggled',
  'cmd.lookOff': 'look off: the Desktop goes back to its own theme',
  'cmd.fundoOn': 'background follows on: {look}',
  'cmd.fundoOff': 'background follows off: {look}',
  'cmd.lang': 'language: {name}',
  'cmd.langAuto': 'language: automatic ({name})',
  'cmd.noProject': 'Project not identified yet.',
  'cmd.card': 'Settings open: pick on the card.',
  'cmd.demoOn': 'Demo on: the band shows a sample fleet of 7 sessions. /skim-it demo turns it off.',
  'cmd.demoOff': 'Demo off: the band is back to the real sessions.',
  'cmd.importFail': 'import failed: {err}',
  'unk': 'I don\'t know "{word}"{scope}.{near} Opened the settings.',
  'unk.in': ' in {cmd}',
  'unk.near': ' Closest: {near}.',
  'help':
    'skim-it v0.4\n' +
    '/skim-it                      opens the settings (also for any word I do not know)\n' +
    '/skim-it typography on|off    headings one step up and a rule between sections in the answer\n' +
    '/skim-it density compact|balanced|detailed  how much of the turn\'s work shows\n' +
    '/skim-it look on|off          skim-it base look on the Desktop\n' +
    '/skim-it panel                opens or closes the sessions panel in the band\n' +
    '/skim-it background follows on|off  the look follows the project of the session you typed in last (off: fixed base look)\n' +
    '/skim-it import               proposes .claude/skim-it.json from the project files; "import approve" writes it (if it exists, only "import approve!" replaces it)\n' +
    '/skim-it language auto|pt|en  mod language (auto follows the Claude Code language)',
  'help.now': 'now: typography {tip}; {look}; background {scene}; fleet: {fleet}; {desk}',
  'help.on': 'on',
  'help.off': 'off',
  'help.fleet.one': 'session',
  'help.fleet.many': 'sessions',
  'help.deskOk': 'Desktop responding',
  'help.deskDown': 'Desktop not responding (mother, titles and archiving unavailable)',
  'imp.written': 'Proposal written to .claude/skim-it.proposta.json ({n} files read):',
  'imp.evidence': 'Evidence:',
  'imp.noColor': 'No brand color found; without a brand the hue comes from the fallback palette.',
  'imp.exists': '.claude/skim-it.json already exists: /skim-it import approve refuses; only /skim-it import approve! copies the proposal over it.',
  'imp.fresh': '/skim-it import approve copies the proposal to .claude/skim-it.json.',
  'imp.existsStop': '.claude/skim-it.json already exists and nothing was written. To replace it with the proposal, type /skim-it import approve!',
  'imp.noProposal': 'There is no proposal: run /skim-it import first.',
  'imp.invalid': 'The proposal is not valid ({errs}); nothing was written.',
  'imp.saved': '.claude/skim-it.json written from the proposal.',
  'imp.refusal': 'The root ({root}) is inside .git (submodule or bare repository): I neither read nor write here.',
  'cfg.badJson': 'invalid JSON: {msg}',
  'cfg.root': 'the root must be an object',
  'cfg.unknownKey': 'unknown key: {k}',
  'cfg.tipo': 'tipo must be "projeto" or "espaço"',
  'cfg.marcaObj': 'marca must be an object',
  'cfg.marcaKey': 'unknown key in marca: {k}',
  'cfg.marcaHex': 'marca.{k} must be hex #rrggbb',
  'cfg.marcaReq': 'marca.primaria is required',
  'cfg.areasList': 'areas must be a list',
  'cfg.areaObj': 'areas[{i}] must be an object',
  'cfg.areaKey': 'unknown key in areas[{i}]: {k}',
  'cfg.areaPath': 'areas[{i}].caminho must be a non-empty text',
  'cfg.areaInt': 'areas[{i}].intensidade must be "vibrante" or "denso"',
  'cfg.invalid': 'invalid skim-it.json: {err}',
  'd.compacto': 'compact',
  'd.equilibrado': 'balanced',
  'd.detalhado': 'detailed',
  'card.title': 'skim-it settings',
  'card.subtitle': 'Appearance, reading and sessions. Applies to every window.',
  'card.close': 'Close',
  'card.secLook': 'APPEARANCE',
  'card.secRead': 'READING',
  'card.secProject': 'PROJECT',
  'card.secGeneral': 'GENERAL',
  'card.look': 'Look',
  'card.lookHelp': 'The calm skim-it palette and frosted background',
  'card.on': 'On',
  'card.off': 'Off',
  'card.follow': 'Background follows the project',
  'card.followHelp': 'The color comes from the project of the session you last typed in',
  'card.yes': 'Yes',
  'card.no': 'No',
  'card.typo': 'Typography',
  'card.typoHelp': 'Larger headings and a rule between the sections of an answer',
  'card.typoOn': 'On',
  'card.typoOff': 'Off',
  'card.density': 'Work density',
  'card.dens.compacto': 'One line per turn; a click shows what was done',
  'card.dens.equilibrado': 'Dimmed narration and one line per group of tools',
  'card.dens.detalhado': 'Everything, as the app draws it',
  'card.color': 'Project color',
  'card.colorAuto': 'Picked from the folder path; the project has no brand file',
  'card.colorFile': 'From .claude/skim-it.json',
  'card.brand': 'Brand file',
  'card.brandHelp': 'Proposes .claude/skim-it.json from the repository colors',
  'card.propose': 'Propose',
  'card.approve': 'Approve',
  'card.replace': 'Replace',
  'card.sessions': 'Sessions panel',
  'card.sessionsHelp': "This project's sessions by state, above the prompt",
  'card.show': 'Show',
  'card.hide': 'Hide',
  'card.lang': 'Language',
  'card.langHelp': 'Automatic follows Claude Code and the system (now: {name})',
  'card.auto': 'Automatic',
  'card.foot': 'Every setting is also a command:',
  'card.footEx': '/skim-it density balanced',
  'card.footHelp': '/skim-it help lists them all.',
}

export const TABLES: Record<Lang, Record<Key, string>> = { pt: PT, en: EN }

type PluralOf<K> = K extends `${infer B}.one` ? B : never
type PluralBase = PluralOf<Key>

/** Texto da tabela com {var} trocadas. */
export function tr(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  return TABLES[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? ''))
}

/** "3 passos" / "1 step": a contagem e a forma certa da palavra. */
export function cnt(lang: Lang, n: number, base: PluralBase): string {
  return n + ' ' + tr(lang, (base + (n === 1 ? '.one' : '.many')) as Key)
}

// ---- comandos nas duas línguas ----

/** Palavra digitada -> a canônica (a do português). */
const WORDS: Record<string, string> = {
  densidade: 'densidade', density: 'densidade',
  demo: 'demo',
  tipografia: 'tipografia', typography: 'tipografia',
  painel: 'painel', panel: 'painel',
  importar: 'importar', import: 'importar',
  aprovar: 'aprovar', approve: 'aprovar',
  fundo: 'fundo', background: 'fundo',
  segue: 'segue', follows: 'segue',
  idioma: 'idioma', language: 'idioma',
  ajustes: 'ajustes', settings: 'ajustes',
  ajuda: 'ajuda', help: 'ajuda',
  look: 'look',
  compacto: 'compacto', compact: 'compacto',
  equilibrado: 'equilibrado', balanced: 'equilibrado',
  detalhado: 'detalhado', detailed: 'detalhado',
  on: 'on', ligado: 'on', ligada: 'on',
  off: 'off', desligado: 'off', desligada: 'off',
  auto: 'auto', automatico: 'auto', 'automático': 'auto', automatic: 'auto',
  pt: 'pt', 'português': 'pt', portugues: 'pt', portuguese: 'pt',
  en: 'en', english: 'en', 'inglês': 'en', ingles: 'en',
}
const canon = (word: string | undefined): string | undefined => (word === undefined ? undefined : Object.hasOwn(WORDS, word) ? WORDS[word] : undefined)

// Palavras que o usuário pode escrever em cada posição, em cada língua.
const CMD_PT = 'densidade tipografia painel look importar fundo idioma ajustes ajuda demo'.split(' ')
const CMD_EN = 'density typography panel look import background language settings help demo'.split(' ')
const VAL: Record<string, [string[], string[]]> = {
  densidade: [['compacto', 'equilibrado', 'detalhado'], ['compact', 'balanced', 'detailed']],
  onoff: [['on', 'off', 'ligado', 'desligado'], ['on', 'off']],
  fundo: [['segue', 'ligado', 'desligado', 'on', 'off'], ['follows', 'on', 'off']],
  importar: [['aprovar'], ['approve']],
  idioma: [['auto', 'pt', 'en'], ['auto', 'pt', 'en']],
}

export function levenshtein(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min((next[j - 1] as number) + 1, (row[j] as number) + 1, (row[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1))
    row = next
  }
  return row[b.length] as number
}

/** A palavra mais perto de `word` entre as candidatas (a primeira no empate), ou undefined se nenhuma é perto. */
export function nearest(word: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined
  let bestDist = Infinity
  for (const c of candidates) {
    const d = levenshtein(word, c)
    if (d < bestDist) {
      best = c
      bestDist = d
    }
  }
  return best !== undefined && bestDist <= Math.max(2, Math.floor(word.length / 2)) ? best : undefined
}

/** As palavras de comando, as da língua atual primeiro. */
export const commandWords = (lang: Lang): string[] => (lang === 'pt' ? [...CMD_PT, ...CMD_EN] : [...CMD_EN, ...CMD_PT])

export type Cmd =
  | { cmd: 'ajustes' | 'ajuda' | 'painel' | 'demo' }
  | { cmd: 'tipografia' | 'look' | 'fundo'; on: boolean }
  | { cmd: 'densidade'; value: 'compacto' | 'equilibrado' | 'detalhado' }
  | { cmd: 'importar'; mode: 'propor' | 'aprovar' | 'aprovar!' }
  | { cmd: 'idioma'; value: 'auto' | 'pt' | 'en' }
  | { cmd: 'desconhecido'; word: string; scope?: string; near?: string }

const onOff = (v: string | undefined) => (v === 'on' ? true : v === 'off' ? false : undefined)

/** Lê os argumentos de /skim-it nas duas línguas; o que não reconhece vira 'desconhecido' com a palavra mais perto. */
export function parseCommand(args: string, lang: Lang): Cmd {
  const w = args.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const first = w[0]
  if (first === undefined) return { cmd: 'ajustes' }
  const what = canon(first)
  const bad = (word: string, pool: string): Cmd => {
    const [pt, en] = VAL[pool] as [string[], string[]]
    return { cmd: 'desconhecido', word, scope: first, near: nearest(word, lang === 'pt' ? [...pt, ...en] : [...en, ...pt]) }
  }
  const bang = (w[1] ?? '').endsWith('!')
  const value = canon(w[1] === undefined ? undefined : w[1].replace(/!$/, ''))
  switch (what) {
    case 'ajustes':
    case 'ajuda':
    case 'painel':
    case 'demo':
      return { cmd: what }
    case 'tipografia':
    case 'look': {
      if (w[1] === undefined) return { cmd: 'ajustes' }
      const on = onOff(value)
      return on === undefined ? bad(w[1], 'onoff') : { cmd: what, on }
    }
    case 'densidade':
      if (w[1] === undefined) return { cmd: 'ajustes' }
      return value === 'compacto' || value === 'equilibrado' || value === 'detalhado' ? { cmd: 'densidade', value } : bad(w[1], 'densidade')
    case 'fundo': {
      if (w[1] === undefined) return { cmd: 'ajustes' }
      if (value !== 'segue') return bad(w[1], 'fundo')
      if (w[2] === undefined) return { cmd: 'ajustes' }
      const on = onOff(canon(w[2]))
      return on === undefined ? bad(w[2], 'onoff') : { cmd: 'fundo', on }
    }
    case 'importar':
      if (w[1] === undefined) return { cmd: 'importar', mode: 'propor' }
      return value === 'aprovar' ? { cmd: 'importar', mode: bang ? 'aprovar!' : 'aprovar' } : bad(w[1], 'importar')
    case 'idioma':
      if (w[1] === undefined) return { cmd: 'ajustes' }
      return value === 'auto' || value === 'pt' || value === 'en' ? { cmd: 'idioma', value } : bad(w[1], 'idioma')
    default:
      return { cmd: 'desconhecido', word: first, near: nearest(first, commandWords(lang)) }
  }
}

/** A resposta de uma palavra desconhecida: o que foi digitado, a mais perto e o aviso de que os ajustes abriram. */
export function unknownText(lang: Lang, c: Extract<Cmd, { cmd: 'desconhecido' }>): string {
  return tr(lang, 'unk', {
    word: c.word,
    scope: c.scope ? tr(lang, 'unk.in', { cmd: c.scope }) : '',
    near: c.near ? tr(lang, 'unk.near', { near: c.near }) : '',
  })
}
