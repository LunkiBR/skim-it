# Estados, atenção e identidade: pesquisa para a band v2

Pesquisa de 2026-11-15, feita depois que as cores e os ícones da band v2 foram recusados na revisão ("está faltando uma camada de pesquisa").
Dois pesquisadores (Sonnet) em paralelo: um sobre plataformas de agentes e sessões, outro sobre ergonomia; uma terceira leitura (Haiku) conferiu os padrões de aviso do Carbon, do Primer e do Atlassian.
O que não foi lido na fonte está marcado como não verificado.

## O problema

- O fundo âmbar escuro do aviso parece marrom.
- O botão "Abrir sessão 2" na cor do projeto (ciano) dentro do aviso âmbar não conversa com nada.
- Selos cinza são calmos mas não dizem qual sessão é qual; várias cores escaneiam mas parecem caóticas.
- Além de visto, alerta e rodando, os ícones de estado pedem imaginação.

## O que as plataformas fazem

**Linear.**
O redesenho trocou HSL por LCH para que cores de mesma luminosidade pareçam igualmente claras, e reduziu o tema a três entradas: base, acento e contraste ([how we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)).
A atualização seguinte apagou a barra lateral, encolheu ícones e tirou os fundos coloridos dos ícones de time, com a regra "não dispute atenção que você não conquistou" ([behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh)).
A caixa de entrada separa o que pede atenção numa aba de prioridade, com contagem ([Inbox](https://linear.app/docs/inbox)).
Os ícones de status (tracejado para backlog, círculo vazio, círculo meio cheio, visto, X) vêm do uso do app e de descrições de terceiros; não há página oficial descrevendo formas ou cores (não verificado).

**Devin.**
A API usa estados como queued, blocked ("o agente precisa de algo do usuário") e um estado terminal; as mensagens dizem "Waiting for your response" e o campo de ação diz o que fazer, como "Answer 2 decisions" ([StatusEvent](https://docs.devin.ai/sdk/reference/interfaces/StatusEvent.md)).
Ícones e cores da interface: não verificado.

**Cursor (janela de agentes).**
Agrupa por estado: Draft, Running, Needs attention, Done; "Needs attention" junta aprovações, perguntas, planos e trabalho terminado ainda não visto, com contagem no ícone ([fórum](https://forum.cursor.com/t/color-the-agent-chat-background-by-status-running-needs-input-done/168083), fonte da comunidade).
Usuários reclamam que o sinal não se lê de relance.

**GitHub Copilot.**
Vocabulário: queued, working, waiting for review, completed nas issues ([changelog](https://github.blog/changelog/2026-03-26-agent-activity-in-github-issues-and-projects/)); in progress, waiting for user input, idle, finished na CLI ([changelog](https://github.blog/changelog/2026-07-08-github-mobile-live-notifications-for-copilot-cli-sessions)).

**Conductor (agentes Claude Code em paralelo).**
Ícones distintos para "aprovar plano" e "responder", contagem por grupo de estado, e a barra lateral mostra quando um agente precisa de permissão ([changelog](https://www.conductor.build/changelog/page/7)).
A forma diz que tipo de atenção, não só que há atenção.

**Chrome (grupos de abas).**
Paleta fixa de nove cores com nome, sempre junto de um rótulo de texto ([tab_group_color.cc](https://chromium.googlesource.com/chromium/src/+/922bc5198873d97f3849de80c0fc5cc1cabf9321/components/tab_groups/tab_group_color.cc)).

**Padrão comum.**
Só o que precisa de você ganha cor ou contagem; o resto da lista fica quieto.
"Precisa de você" tem duas camadas: lugar próprio (grupo, linha, banner) e contagem.
Terminado ganha tratamento calmo.
Rodando ganha movimento, não matiz.

## O que a ergonomia diz

- **Tela cinza.** Interfaces de alto desempenho (ISA-101) deixam o normal em cinza e guardam a cor para o anormal, para o desvio saltar à vista; alarmes (ISA-18.2, EEMUA 191) usam poucos níveis, cada cor com um só sentido ([ISA-101](https://www.isa.org/standards-and-publications/isa-standards/isa-101-standards); resumo de conhecimento, sem leitura do texto da norma).
- **Nunca só cor.** WCAG 1.4.1 pede outro meio além da cor ([Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)); 1.4.11 pede 3:1 para ícones e bordas que carregam sentido ([Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- **Por que as cores aleatórias parecem caos.** Um item saturado entre neutros salta à vista; quando todos têm cor, os distratores ficam heterogêneos e nada salta (atributos pré-atentivos, Healey e Ware). Pessoas reconhecem de memória só uns 6 a 8 matizes (não verificado).
- **Paleta que não parece aleatória.** Luminosidade e croma fixos num espaço perceptivo (OKLCH), variando só o matiz, em ordem fixa com vizinhos distantes ([OKLab](https://bottosson.github.io/posts/oklab/)); é o que o Linear fez com LCH.
- **Por que o âmbar escuro vira marrom.** Amarelo só existe com luminosidade alta; escurecido, mantém o matiz e cai para oliva ou marrom. A saída é tirar o matiz quente do fundo e deixá-lo no ícone, numa barra e no texto, ou puxar para laranja.
- **Botão dentro do aviso.** No Carbon, notificações com ação usam botão ghost, e a variante discreta é a recomendada ("When in doubt, use low-contrast notifications") ([Carbon](https://carbondesignsystem.com/components/notification/usage/)). Primer e Atlassian não documentam o tipo do botão no aviso de alerta.
- **Ícone sem legenda.** Só alguns se entendem sem palavra: visto, exclamação, X, progresso, pausa, relógio, lua, sinal cortado; a recomendação é sempre parear ícone e texto ([NN/g, icon usability](https://www.nngroup.com/articles/icon-usability/)).

## Decisões para a band (sistema v3)

1. **Cor só para o que pede uma pessoa.** "Precisa de você" usa a cor de atenção; "pronta para revisar" usa o acento do projeto, calmo. Rodando, segundo plano, sem sinal e parada ficam neutros e se distinguem pela forma.
2. **Uma cor de atenção: argila** (matiz por volta de 40 em OKLCH, a família do destaque do Claude), nunca como fundo tingido escuro: só no ícone, numa barra de 3 px à esquerda do aviso, na borda e no texto.
3. **Botões neutros.** O botão dentro do aviso é neutro (secundário), como o ghost do Carbon. O botão primário do mod é neutro invertido, como o padrão do shadcn. A cor do projeto não pinta botão.
4. **Cor do projeto é identidade:** o bloco com o nome, a faixa, e o visto de "pronta".
5. **Identidade da sessão:** selo cinza com o número colorido. Nove matizes com a mesma luminosidade e o mesmo croma, fora da faixa da atenção (10 a 75 graus); a décima sessão em branco; ordem fixa, vizinhos distantes. A cor é discreta e o número continua decidindo.
6. **Ícones de 14 px, sempre com a palavra quando couber:** rodando = anel de progresso; precisa aprovar = círculo cheio com "!"; precisa responder = círculo cheio com "?"; segundo plano = relógio; pronta = círculo cheio com visto; sem sinal = sinal cortado; parada = lua.
7. **Movimento** só para "precisa de você", um pulso que para, se o Desktop voltar a animar; respeitar o movimento reduzido.
8. **Teste:** escala de cinza e simulação de deuteranopia; 3:1 para ícones e bordas, 4,5:1 para texto, nos dois temas.

## Não verificado

Formas e cores oficiais dos status do Linear, ícones e cores do Devin e do Copilot, a contagem exata de matizes que se reconhecem de memória, os percentuais de prioridade de alarme da ISA-18.2, o estilo de fundo do aviso de alerta no Primer e no Atlassian.
