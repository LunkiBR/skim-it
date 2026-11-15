<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo-dark.png">
    <img alt="skim-it" src="docs/images/logo-light.png" width="320">
  </picture>
</p>

<p align="center">
  A calmer, more scannable Claude Code Desktop.
  <br>
  One band for every session you run in parallel, one line for every turn of work, and answers you can skim.
</p>

<p align="center">
  <a href="https://github.com/LunkiBR/skim-it/actions/workflows/checks.yml"><img alt="Checks" src="https://github.com/LunkiBR/skim-it/actions/workflows/checks.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-2f8adc"></a>
  <a href="README.pt-BR.md"><img alt="Leia em português" src="https://img.shields.io/badge/leia%20em-portugu%C3%AAs-555"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="docs/images/band-light.png">
    <img alt="The skim-it band above the prompt: project, session 3 of 10, its subject and state, an alert for the session that needs you, the other sessions by number and state, and the Git line" src="docs/images/band-dark.png" width="820">
  </picture>
</p>

## Why

Running five or ten Claude Code sessions at once is normal now.
The Desktop shows each one in isolation: to know which session is waiting for you, you open them one by one.
Long turns bury the answer under tool calls and narration.
skim-it is a mod that fixes both without changing how the model writes.

## What it does

### A band above the prompt

- **Who am I.** The project in its own color, the session number ("3 of 10") and an automatic subject written by Haiku.
- **What I am doing.** One icon and one word: running, needs you, in the background, ready to review, no signal, idle.
- **Who needs you.** When another session of the project is waiting for an approval or an answer, an amber line says which one and what it needs, with a button that opens it.
- **The rest of the fleet.** Every other session of the project by number and state, the waiting ones first.
- **Git.** Branch, changes and PR with its CI. A click opens a panel with your open PRs, changed files and recent branches.
- **Sessions panel.** All sessions of the project grouped by state, with parent and child sessions, and a safe bulk archive for the ones idle for over 30 days.

<p align="center">
  <img alt="The sessions panel grouped by state: needs you, running, in the background, ready to review, no signal, idle" src="docs/images/sessions-panel.png" width="720">
</p>

The band fits four widths, from a wide window down to a single line in a split view.

<p align="center">
  <img alt="The band at a medium width" src="docs/images/band-medium.png" width="420">
  <img alt="The band in a narrow window" src="docs/images/band-narrow.png" width="300">
</p>

### One line per turn

When a turn ends, all its work (commands, file reads, narration, failures) folds into one line: `Worked 7m 57s · 54 steps · 3 files · 1 failure ›`.
The final answer stays in view.
A click opens the list.
A failure never disappears from the line.
Three densities: compact (one line per turn, the default), balanced (one line per kind of work) and detailed (as the app draws it).

### Answers you can skim

Headings one step larger and a rule between sections, with tables, code and lists left as the app draws them.
Relative links in the answer become clickable.

### A look per project

A calm, high-contrast look: tinted grays, primary text at 7:1 on every surface, color only where it means something.
Amber is reserved for "needs you"; red, green and amber never stand for a project.
Each project gets its own color, from your brand file or from a stable hash of the repository, and the look follows the session you typed in last.

<p align="center">
  <img alt="The states and their icons, plus the ten session numerals" src="docs/images/states.png" width="300">
  &nbsp;
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="docs/images/settings-light.png">
    <img alt="The skim-it settings card" src="docs/images/settings-dark.png" width="420">
  </picture>
</p>

> The images are renders of the design file.
> In the app the mod draws the same layout with the Desktop's own components, so radius and type follow your Desktop.

## Install

At the prompt of a Claude Code session:

```
/plugin install skim-it --marketplace LunkiBR/skim-it
```

Answer `y` to add the marketplace, then pick a scope.
From a shell:

```bash
claude plugin install skim-it --marketplace LunkiBR/skim-it
```

Open a new session and type `/skim-it` to see the settings.

### Requirements

- Claude Code 2.1.325 or newer, in the Code tab of Claude Desktop.
- `git` on the PATH for the Git line, and the [GitHub CLI](https://cli.github.com) signed in for PRs and CI (optional).
- Built and used daily on Windows; macOS and Linux should work but have not been tested yet.

If another theme mod (such as `/custom-theme`) is on for the same project, the two will trade the look on every message.
Turn the other one off for that project.

## Commands

Every setting is in the card that `/skim-it` opens, and each one is also a command.
Commands take English or Portuguese words (`density` or `densidade`).

| Command | What it does |
|---|---|
| `/skim-it` | Opens the settings card |
| `/skim-it typography on\|off` | Larger headings and a rule between sections |
| `/skim-it density compact\|balanced\|detailed` | How much of a turn's work stays visible |
| `/skim-it look on\|off` | The skim-it look on the Desktop |
| `/skim-it background follows on\|off` | The look follows the project of the session you typed in last |
| `/skim-it panel` | Opens or closes the sessions panel |
| `/skim-it import` | Proposes a brand file from the project's colors; `import approve` writes it |
| `/skim-it language auto\|pt\|en` | The mod's language; `auto` follows Claude Code |
| `/skim-it demo` | Shows a sample fleet of seven sessions, for screenshots and recordings |

## Brand file

Put `.claude/skim-it.json` at the root of a repository to give it a color:

```json
{
  "tipo": "projeto",
  "marca": { "primaria": "#4b63ce", "secundaria": "#7db2ff" },
  "areas": [{ "caminho": "web/", "intensidade": "vibrante" }]
}
```

| Key | Meaning |
|---|---|
| `tipo` | `projeto` (sessions toward one goal: band, panel, parent and child) or `espaço` (loose sessions that only share a folder: color and subject only) |
| `marca.primaria` | The project color; it becomes the accent and the hue of the look |
| `marca.secundaria`, `marca.neutra` | Optional extra brand colors |
| `areas` | Paths that change intensity (`vibrante` or `denso`), never the hue |

The keys are in Portuguese because the mod was born in Portuguese.
`/skim-it import` reads Tailwind config, CSS variables, `tokens.json`, `package.json`, `SKILL.md` and `README.md`, proposes the file with the evidence it found, and writes nothing until you approve.

## Privacy and what it runs

- **Session files.** Each session writes a small JSON file to `~/.claude/skim-it/fleet/` (project root, subject, state, timestamps) so the other sessions can see it. Nothing leaves your machine.
- **Subject.** The automatic subject is one short Haiku call per turn through Claude Code's own model access, with the start of your request and of the answer.
- **Desktop tools.** Session titles, parent sessions and the archive go through the Desktop's own session tools. In a terminal or over SSH those calls fail quietly and the band uses the session files alone.
- **Processes.** `git` (status, branch, diff stats, recent branches) and `gh` (PR list and checks), only in the session's folder. Opening another session hands a `claude://` or `https://` link to the system.
- **No network** of its own, no telemetry.

## How it works

skim-it is a Claude Code mod: a TypeScript hooks module the engine loads, with no DOM and no Node.
It draws through `ui.render` hooks, sets the look through `$.theme.set`, and keeps the turn's work from `turn.*` and `tool.call` events.
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) maps the modules, [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) holds the tokens and the rules behind the colors and icons, and [docs/ENGINE-NOTES.md](docs/ENGINE-NOTES.md) lists what the engine refuses and what the Desktop actually draws.

## Development

```bash
git clone https://github.com/LunkiBR/skim-it
cd skim-it
claude --plugin-dir .
```

The checks are plain Node scripts for the pure logic (color engine, states, typography, Git parsing):

```bash
npm test
```

Before a pull request, also run `claude plugin validate .` and, with the types the engine writes to `.claude-plugin/types/` after the first load, `npx -p typescript tsc -p .`.
[CONTRIBUTING.md](CONTRIBUTING.md) has the details.

## License

[MIT](LICENSE), except `hooks/make-colors.js` and `hooks/make-colors.d.ts`, which come from the Claude Code plugin authoring kit.

skim-it is an independent project and is not affiliated with or endorsed by Anthropic.
