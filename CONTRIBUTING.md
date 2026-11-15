# Contributing to skim-it

Thanks for wanting to help.
Bug reports with a screenshot, small fixes and new languages are the most welcome contributions.
For a new feature or a visual change, open an issue first so we can agree on it before you build it.

## Setup

You need Claude Code 2.1.325 or newer and Node 23.6 or newer (the checks import TypeScript directly).

```bash
git clone https://github.com/LunkiBR/skim-it
cd skim-it
claude --plugin-dir .
```

`--plugin-dir` loads the mod from your clone for that session and reloads it when you save.
In the Desktop app, name the folder in `CLAUDE_CODE_PLUGIN_DIRS` (in the `env` block of `~/.claude/settings.json`) instead.
After the first load the engine writes the API types to `.claude-plugin/types/`, which `tsconfig.json` extends.

## Checks

Run all four before opening a pull request:

```bash
npm test
claude plugin test .
claude plugin validate .
npm run typecheck
```

- `npm test` runs `scripts/check-*.mjs`: plain Node checks of the pure modules (color engine, states, typography, work line, Git parsing, strings).
- `claude plugin test .` runs `tests/*.test.tsx` against the engine's test kit: a hook mounted on a surface, its tree checked by that surface's rules. The kit does not paint, and it accepts some trees the Desktop draws differently (see [docs/ENGINE-NOTES.md](docs/ENGINE-NOTES.md)).
- `claude plugin validate .` reads the module the way the engine does. It is the only check that catches the rules in [docs/ENGINE-NOTES.md](docs/ENGINE-NOTES.md), and a broken rule means the whole mod does not load.
- `npm run typecheck` needs the types the engine wrote on the first load.

None of these paint the screen.
A change you can see needs a look in the app, in light and dark, and a screenshot in the pull request.
`/skim-it demo` fills the band with a sample fleet of seven sessions, so you can check a layout without opening seven windows.

## Where things go

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) maps the modules.
The short version:

- Logic goes in a pure file (no `$`, no engine import) with a test in the matching `scripts/check-*.mjs`; the runtime file only talks to the engine.
- A new `$.state` value is declared in `types/index.d.ts` under `PluginState`, and its atom is declared in each file that reads it.
- A new event hook goes in `hooks/register.tsx` if the event is not hooked yet; otherwise add a function and call it from the existing hook.
- A new string goes in both tables of `hooks/i18n.ts`; `check-i18n.mjs` fails when a key is missing from one of them.
- Colors come from the tokens in `hooks/v4.ts`. Read [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) before adding one: amber is only for "needs you", and red, green and amber never stand for a project.

## Adding a language

The mod speaks `pt` and `en` today, and a few places name them directly: the `Lang` type and the `idioma` command in `hooks/i18n.ts`, and the language buttons in `hooks/card.tsx`.
Open an issue first.
The change is a new table in `hooks/i18n.ts` with every key, the command words in `WORDS`, and those places.

## Style

- Code comments are in Portuguese, the docs in English; either is fine in a pull request.
- No new dependencies: the mod runs inside the engine with nothing but `$`.
- Keep a drawing hook cheap: it runs on every redraw. Slow work (git, gh, Desktop tools, model calls) runs in the background and redraws with `$.ui.invalidate('ui.render')`.
- One change per pull request, with what it fixes and how you checked it.

## Reporting a bug

Use the bug report form.
Say which surface (Desktop or terminal), your Claude Code and Desktop versions, your system, and attach a screenshot.
If the mod stopped loading, the transcript shows a dim line naming the hook and the reason; paste it.
