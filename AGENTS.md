# Project Context

skim-it is a Claude Code mod, Desktop first, with three fronts: a calm look per project, awareness of sessions running in parallel, and scannable turns.
The layout is the same in every project; only the color changes.
Public repository (MIT); README.md is the user-facing description, docs/ the contributor-facing one.

# Repository Layout

`hooks/` is the hooks module (`hooks.json` names `register.tsx`); `types/index.d.ts` is the state contract.
`scripts/check-*.mjs` are the Node checks of the pure modules; `scripts/check-all.mjs` runs them (`npm test`). `tests/*.test.tsx` run hooks in the engine's kit (`claude plugin test .`).
`docs/ARCHITECTURE.md` maps the modules, `docs/DESIGN-SYSTEM.md` holds the tokens, `docs/ENGINE-NOTES.md` what the engine refuses and what the Desktop draws, `docs/research/` the research behind states and color.
`.agents/memory/` is the agent's local memory for this repo.

# Terminology

`Look`: the global Desktop theme sent with `$.theme.set`; one for all windows at once.
`Band`: what the mod draws above the prompt (project, session, state, alert, fleet, Git).
`Frota` (fleet): the project's sessions, shared through `~/.claude/skim-it/fleet/*.json`.
`Projeto` and `espaço`: kinds declared in `.claude/skim-it.json`; a projeto has sessions toward one goal, an espaço has loose sessions.
`Subsessão`: a session started from another to work in parallel; a subagent is not a session.
`Linha de trabalho` (work line): the line a finished turn folds into ("Worked 7m 57s · 54 steps").

# Key Components

`register.tsx` wires events, commands and the look; `band.tsx` is the band, the panels and the only `ui.press` hook; `card.tsx` the settings card.
`work.tsx` and `worklog.ts` are the work line; `tipografia.tsx` and `blocks.ts` the answer typography.
`fleet.ts` and `fleetcore.ts` are the sessions in parallel; `gitlive.ts` and `gitinfo.ts` the Git line; `topic.ts` the subject.
`projeto.ts`, `project.ts`, `lookgen.ts`, `importer.ts` and `importar.ts` are the color per project; `look.ts`, `ambient.ts` and `palette.ts` the base look and background.
`v4.ts` (tokens, icons, SVG), `desenho.ts` (pieces) and `desenhar.tsx` (piece to element) are the drawing.

# Testing Conventions

`npm test`, `claude plugin test .`, `claude plugin validate .` and `npm run typecheck` before calling anything done; validate is the real gate (the engine refuses the whole module on one broken rule, and tsc does not see those rules).
Logic goes in a pure file with a test in the matching `scripts/check-*.mjs`.
The checks do not paint the screen: a visible change ends with a look in the app, light and dark (`/skim-it demo` fills the band).

# Development Rules

Read `docs/ENGINE-NOTES.md` before writing hook code: literal atom references, atoms read only in the file that declares them, one hook per event, `$` passed only to function declarations, self-contained contract.
The look is global: never put session identity in the look; it lives in what the mod draws.
A drawing hook never returns nothing (use an empty `Box`) and passes `next(e)` when `isExpanded`.
A turn's failure never disappears from the work line.
Amber is only for "needs you"; red, green and amber never stand for a project.
Every string goes in both tables of `hooks/i18n.ts`.
`hooks/make-colors.js` and `.d.ts` come from the plugin kit: copy them again when the engine build changes, never edit them.
No agent co-author in commits.

## Memory

- What an agent learns here goes to `.agents/memory/`: `MEMORY.md` is the index, one line per memory; each memory is a file with `type: feedback | project | reference` in its frontmatter.
- Save in the same turn: an owner's correction or approval (`feedback`); an engineering decision with date and why, a trap that cost trial and error, an open item (`project`); a fact outside the code (`reference`). Never a secret. Not what the code, the git log or this file already say.
- The memory is local to each clone and is not part of the public repository.
