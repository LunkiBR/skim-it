# Design system

The band, the panels and the settings card share one system, kept in `hooks/v4.ts` and tested by `scripts/check-v4.mjs`.
All colors are written in OKLCH (lightness, chroma, hue), so equal lightness looks equally light across hues.
The design file it came from has the same tokens as variables with light and dark modes.

## Principles

1. **The layout is the same in every project; only the color changes.**
2. **Color only where it means something.** Neutrals carry the interface; the project color marks identity; amber marks attention. Nothing else is colored.
3. **Shape before color.** Every state has its own icon and a word, so the band reads in grayscale and for color-blind users.
4. **Do not compete for attention you have not earned.** A session that needs you gets an amber line; a running session gets a quiet ring.
5. **Contrast is a test, not a taste.** Primary text is at least 7:1 on every surface, muted text 4.5:1, interface marks 3:1.

## Neutrals

Warm grays at hue 75, so the app never looks blue-cold or yellowed.

| Token | Dark (L) | Light (L) | Use |
|---|---|---|---|
| `app` | .195 | .965 | App background |
| `s2` | .225 | .985 | Raised surface (card, panel) |
| `s3` | .25 | .945 | Pill, hover |
| `s4` | .28 | .92 | Pressed, selected |
| `s5` | .305 | .895 | Strong fill |
| `b6` | .35 | .86 | Border |
| `text-muted` | .64 | .52 | Secondary text |
| `text` | .81 | .40 | Body text |
| `text-strong` | .955 | .22 | Titles, numerals in the band |

## Project steps

One hue per project, in fixed lightness and chroma steps, so changing the project changes every color and none of the drawing.

| Step | Dark (L, C) | Light (L, C) | Use |
|---|---|---|---|
| 3 | .255, .028 | .955, .02 | Tinted area |
| 4 | .28, .035 | .93, .03 | Tinted hover |
| 6 | .40, .06 | .84, .06 | Tinted border |
| 9 | .70, .11 | .55, .11 | Project block fill |
| 10 | .74, .11 | .50, .11 | Block hover |
| 11 | .82, .08 | .44, .09 | Project text |
| 12 | .94, .025 | .27, .05 | Text on tint |

The project hue never lands on red, green or amber: those mean error, success and attention.
Without a brand file the hue comes from a stable hash of the repository into a palette spaced for color-blind users.

## Attention

Amber is the only attention color, used for the icon, the border and the text of what needs you, never as a large fill (a dark amber fill reads as brown).

| Step | Dark (L, C, H) | Light (L, C, H) |
|---|---|---|
| 6 (border) | .56, .11, 80 | .64, .14, 60 |
| 9 (icon) | .84, .16, 82 | .64, .155, 58 |
| 11 (text) | .87, .13, 86 | .50, .13, 60 |

The alert's title stays in strong text; amber is for the mark, not the words.
The alert's button is a neutral secondary button, never the project color.

## Session numerals

Sessions are told apart by their number, bold at 12 px, colored and without a square behind it.
All nine colors share one lightness and chroma (dark L .85 C .10; light L .46 C .12), at hues 185, 275, 125, 335, 215, 305, 155, 245 and 5, away from amber.
The tenth is neutral.
In the band's own block the number is in strong text, so it never fights the project color next to it.

## State icons

14 px, 1.5 px stroke, always next to a word.

| State | Icon | Color |
|---|---|---|
| Running | Progress ring | Neutral |
| Needs you, approve | Exclamation mark | Amber |
| Needs you, answer | Question mark | Amber |
| In the background | Clock | Neutral |
| Ready to review | Check | Project color |
| No signal | Crossed-out signal | Neutral |
| Idle | Moon | Neutral |

## Background

The background is color and light only, so it never competes with text when several sessions sit side by side.
Each state has a signal you can read from the edges around the frosted glass:

| State | Ground | Light |
|---|---|---|
| Idle | Almost gray (30% of the project chroma) | No glow |
| Working | Project color | Strong project glow in two corners, breathing slowly |
| Waiting for you | Almost gray again | Amber light along the window edges, strongest at the top, pulsing; the band's amber in dark mode, a lighter gold in light mode |

Amber stays in narrow, bright rims: a wide, faint amber over a dark ground reads as brown.

## Layout

- Spacing on a 4 px grid; radius from the Desktop's own `borderStyle="round"`, which matches the design's 8 px.
- Buttons are neutral; the primary one is inverted (strong text as fill). Selected segments are primary, the others plain.
- The band fits four widths: wide, medium, narrow and minimal (one line). The fleet row shows the waiting session and one more by title, then compact numbers, then "+N".

## Where it is tested

`scripts/check-v4.mjs` checks the contrast targets in both modes (numerals at 4.5:1 on every surface for all ten sessions and every project hue, text on neutrals and on the project, 7:1 for primary text on the theme anchors), the SVG output, and the fleet row's plan at each width.
`scripts/check-look.mjs` checks the global look: surfaces tinted within 0.005 to 0.03 chroma, text at 7:1 and 4.5:1.
The research behind these choices (Linear, Devin, Cursor, Conductor, Carbon, Primer, Atlassian and ergonomics sources) is in [research/estados-e-cor.md](research/estados-e-cor.md), in Portuguese.
