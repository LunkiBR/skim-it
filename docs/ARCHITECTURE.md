# Architecture

skim-it is one hooks module for the Claude Code mod engine.
The engine loads `hooks/register.tsx` (named in `hooks/hooks.json`), runs `register(on)`, and from then on calls the hooks it registered.
There is no DOM and no Node: everything outside the module goes through `$` (state, clock, files, processes, model calls, MCP tools, theme, UI).
JSX compiles against the engine's global `h`, and the elements (`Box`, `Text`, `Button`, `Svg`, `Link`) come from `$.ui.resolve(e)`, so the same tree draws on the Desktop and, more plainly, in a terminal.

Code comments are in Portuguese; the public docs are in English.

## The rule that shapes the files

Most modules come in pairs: a **pure** file (no `$`, no engine import, tested by `scripts/check-*.mjs` in plain Node) and a **runtime** file that talks to the engine.
New logic goes into the pure side whenever it can, because the checks cannot paint the screen and the engine cannot be imported in Node.

| Area | Runtime | Pure | Check |
|---|---|---|---|
| Sessions in parallel | `fleet.ts` | `fleetcore.ts` | `check-fleet.mjs` |
| Git line and panel | `gitlive.ts` | `gitinfo.ts` | `check-git.mjs` |
| Project color | `projeto.ts`, `importar.ts` | `project.ts`, `lookgen.ts`, `importer.ts` | `check-project.mjs`, `check-look.mjs` |
| Work line | `work.tsx` | `worklog.ts` | `check-worklog.mjs` |
| Answer typography | `tipografia.tsx` | `blocks.ts` | `check-blocks.mjs` |
| Return card | `volta.ts` | `retorno.ts` | in `check-fleet.mjs` |
| Drawing | `desenhar.tsx` | `v4.ts`, `desenho.ts`, `measure.ts` | `check-v4.mjs`, `check-measure.mjs` |
| Strings | | `i18n.ts` | `check-i18n.mjs` |

## Modules

**Wiring.**
`register.tsx` registers every event the mod uses, once each: `session.start` and `session.attach` (look, command, fleet heartbeat), `prompt.submit` (look follows the project, subject draft), `turn.start`, `turn.step`, `turn.complete` and `tool.call` (work line, states), `tool.check` (a pending permission becomes "needs you"), `classic.Stop` (background work, where the host delivers it; background subagents also come from `$.agent.list()`), `command.run` (`/skim-it`) and the `ui.render` hooks.
`ajustes.ts` holds what each setting does, so the command and the settings card call the same functions.

**Band.**
`band.tsx` draws the band above the prompt (`ui.render` on `AbovePrompt`): the project block, session number, subject and state; the amber alert for a session that needs you; the fleet row; the Git line and its panel; and the sessions panel.
It also owns the only `ui.press` hook in the module and hands presses to `work.tsx` and `card.tsx` by key prefix (`skim-b-`, `skim-c-`, `skim-turno-`).
`card.tsx` is the settings card that `/skim-it` opens, placed in the transcript with `$.ui.place`.

**Sessions in parallel.**
There is no API that lists other sessions, so each session writes `~/.claude/skim-it/fleet/<id>.json` and reads the others' (`fleet.ts`).
`fleetcore.ts` turns those files into states (running, needs you, in the background, ready to review, no signal, idle), groups them by project (the git common directory, so worktrees join their project), finds parent and child sessions, and picks what may be archived.
Titles, parent sessions and archiving come from the Desktop's own session tools through `$.mcp.call`; without them (terminal, SSH) the band uses the files alone.
`topic.ts` builds the short Haiku prompt for the session subject.
`tom.ts` gives this session its tone among the live sessions of the project.

**Work line.**
`work.tsx` follows the turn (`turn.start`, `turn.step`, `tool.call`, `turn.complete`), hides the rows the Desktop draws for a finished turn, and draws one line in their place that opens on a click.
`worklog.ts` keeps the turn record, the summary text and the density rules.
A running subagent's row stays visible, read from `$.agent.list()`.

**Typography.**
`tipografia.tsx` draws the final answer: `#` and `##` one step up, the app's own rule before each `##`.
`blocks.ts` splits the Markdown into blocks and makes relative links absolute; an answer with raw HTML, link definitions or footnotes is left as the app draws it.

**Look and color.**
`look.ts` builds the base look and sends it with `$.theme.set` on `session.start`, `session.attach` and each prompt.
`lookgen.ts` derives a project look from one hue with `makeColors` (`make-colors.js`, from the plugin kit).
`ambient.ts` draws the frosted background scene for the `Backdrop` hook; `palette.ts` holds its named color steps.
`projeto.ts` finds the project root and reads `.claude/skim-it.json`; `project.ts` validates it and picks the hue (brand file, else a stable hash of the root into a palette away from red, green and amber).
`importer.ts` finds candidate brand colors in Tailwind, CSS, tokens and `SKILL.md`; `importar.ts` reads the files and writes the proposal.
`color.ts` converts OKLCH to sRGB.

**Drawing.**
`v4.ts` holds the design tokens (see [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)), the state icons and `svg()`, which writes both palettes into one SVG and lets `prefers-color-scheme` pick, since a mod cannot know whether the Desktop is light or dark.
`desenho.ts` builds the fixed-size SVG pieces (project block, numerals, pills, group headers, icons); `desenhar.tsx` turns a piece into an element with a full `alt`, and into text where there is no `Svg`.
`measure.ts` estimates text width for the pieces, because the only width the mod gets is `bodyColumns`.

**State.**
Values a drawing reads are atoms declared in `types/index.d.ts` under `PluginState`; the engine holds every `$.state` key to that contract.
`cache.ts` keeps module-level maps bounded.

## Data that leaves the module

- `~/.claude/skim-it/fleet/*.json`: one small file per live session.
- `.claude/skim-it.proposta.json` and `.claude/skim-it.json`: only on `/skim-it import` and `import approve`.
- `$.model.complete` with Haiku: the subject, once per answered turn.
- `$.process.run`: `git` and `gh` in the session folder; a system opener for `claude://` and `https://` links.
- `$.mcp.call`: the Desktop's `ccd_session_mgmt` tools (get and list sessions, archive).
