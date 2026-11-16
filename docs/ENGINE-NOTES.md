# Engine notes

What we learned building skim-it on Claude Code 2.1.325 and Claude Desktop, so you don't pay for it twice.
Each item was seen in practice; where a behavior may change with a new build, it says so.

## The engine scans the module before loading it

The engine reads the source before running it and refuses the **whole module** when one rule fails.
`tsc` and the Node checks catch none of these, so `claude plugin validate .` is the real gate: it reports one module error at a time, so run it until it passes.

- Atoms take literal references: `atom({ plugin: 'skim-it', key: 'git' } as const, init)`. A variable for `plugin` or `key` is refused.
- `read` and `update` only on an atom declared in the same file. Importing an atom from another file is refused; a second file that needs the same state declares the same reference with the same initial value.
- One hook without a matcher per event in the whole module (`turn.start`, `tool.call`, `ui.press`...). Other files export plain functions and the owner of the hook calls them. That is why `band.tsx` owns `ui.press` and routes presses by key prefix.
- `$` may be passed only to a `function` declaration (declared in the file or imported from a file that declares it so). `const f = ($) => ...` and a function received as a parameter are refused. That is why `tipografia.tsx` is its own file.
- No local name may be `on` (it shadows the `on` of `register`).
- Calls on `$` are spelled `$.noun.method(...)` at the call site.
- The contract `types/index.d.ts` is self-contained: types only, no `import`, no `export {}`. Hooks import their value types from `'../types'`, and every `$.state` key the module names must be declared there under `PluginState`.

## Drawing

- A `ui.render` hook never returns nothing: return an empty `Box`. With `isExpanded`, pass `next(e)` on.
- Writing `$.state` does not redraw rows that already finished drawing; `$.ui.invalidate('ui.render')` does.
- A button's `onPress` closure does not survive a redraw or a reload. Handle presses in one `ui.press` hook by the button's `key`.
- The Desktop's `Button` draws its `label` only; a plain button looks like text.
- `Box` has no per-side border. A rule is a one-line `Box` with a background, or an `Svg`.
- `borderStyle="round"` uses the Desktop's own radius, close to 8 px.
- `backgroundColor` takes theme keys and raw colors, including translucent `#rrggbbaa`, which works in light and dark without knowing the mode.
- An `Svg` wider than its slot is **scaled down, not cropped**. Use SVG only for pieces whose size you know; let native flex and `Text wrap="truncate"` fill a line.
- The only width the mod gets is `bodyColumns`, in cells. Estimating 7 px per cell underestimates.
- A mod cannot know whether the Desktop is light or dark. SVGs carry both palettes and let `prefers-color-scheme` choose.
- On the Desktop, `Text size="heading"` renders at body size, only heavier; the visible step up is `title`.
- In a reply, `#` is the only native heading above body size (cap height 13 px against 11); `##` and `###` render at body size, bold.
- A mod's `Markdown` is not drawn like a reply: tighter line height (21.5 px against 23), about 5 px left of the reply's text, and `---` draws nothing.
- `next` with rewritten props hands a drawing back to the app. In one tree the app's own drawing of a message shows **once**: a second `next` result in the same tree is dropped on the Desktop, though `claude plugin test` accepts it.
- `Box` `height` takes a number of cells or a percentage; `"1px"` fails the hook.
- `prompt.compose` does not reach a mod where the built-in `cc-plugin-sec-default` is seated: it runs first and sends the event past the person's plugins. A changed compose answer also waits for a new thread. To steer how the model writes, attach `context` at `prompt.submit` (read by the model, never shown).
- `Link` (`href`, `label`) opens a URL; Markdown from a mod makes only `http`, `https` and `file` links clickable.

## Turns and rows

- Rows the Desktop draws (`AssistantMessage`, `ToolGroup`, `ToolUse`) carry no turn id. `e.requestId` is the message id or the `tool_use_id`, so the work line ties rows to turns by message id, never by text.
- Long intermediate narration is drawn as a summary whose text differs from what the model wrote, and on the Desktop that summary row never reaches the `AssistantMessage` hook: a mod can neither hide nor restyle it (traced on 2026-11-15).
- The Desktop draws its own header for a tool group ("Ran 2 commands, read a file ›") whatever the `ToolGroup` hook returns; the hook only decides what the group shows when opened. A rewrite to `isExpanded: true` does not unfold the group into `ToolUse` rows on the Desktop (traced on 2026-11-15).
- Thinking rows are not a render component: no mod reaches them.
- A row a hook answers with an empty `Box` still keeps its vertical gap in the transcript.
- Returning the native rows when the work line opens shows nothing: the Desktop keeps them inside its own collapsed group. The mod draws its own open list.
- `turn.complete` carries the final visible answer, `durationMs` and `turnId`.
- `TurnDuration` and `InfoNotice` exist only in the terminal.
- A background subagent's activity may not arrive through `classic.Stop` on every host; `$.agent.list()` is the reliable source.

## Look and background

- The look sent with `$.theme.set` is **global**: with several session windows open there is one look, not one per session. Per-session identity has to live in what the mod draws.
- The look does not come back by itself on `--resume`, and at `session.start` the Desktop may not be attached yet: send it again on `session.attach` and on each prompt.
- `colors` must come from `makeColors` (`hooks/make-colors.js`, copied unchanged from the plugin kit). A `problems` line starting with "Desktop won't paint" makes the Desktop ignore the whole theme.
- A still background did not paint on Desktop 5.11492.5; a scene (a `Backdrop` hook returning an `Svg`) did. `isDrawn: false` from `$.theme.set` does not decide it.
- In a split view the Desktop asks for no `Backdrop` at all, and only the focused session gets the frosted glass. Busy illustrations fight the text there, so the background is color only.
- Two theme mods on the same project (for example `/custom-theme`) overwrite each other on every message.

## Desktop tools

- There is no API to list other sessions. Shared files plus the Desktop's `ccd_session_mgmt` tools through `$.mcp.call` cover it.
- Never await a Desktop tool inside `session.start`, `command.run` or `ui.press`: fire it with `void` and bound it with a timeout.
- Without the Desktop (terminal, SSH) those calls fail; the mod has to work from its own files alone.
