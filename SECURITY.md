# Security

skim-it runs inside Claude Code with the engine's permissions: it reads and writes small files under `~/.claude/skim-it/`, runs `git` and `gh` in the session folder, calls the Desktop's session tools and makes one short Haiku call per turn.
[README.md](README.md#privacy-and-what-it-runs) lists everything it touches.

If you find a way to make the mod run a command it should not, read or write outside those places, or leak data from one session into another, please report it privately through [GitHub's private vulnerability reporting](https://github.com/LunkiBR/skim-it/security/advisories/new) instead of opening a public issue.
Expect a first answer within a week.
