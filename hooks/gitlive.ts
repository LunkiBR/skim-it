// Git desta sessão (v0.3), parte de execução: branch, alterações, adiantado/atrasado e o PR (gh).
// Portado do loadGit do session-hue; as partes puras estão em gitinfo.ts. Cada comando falha sozinho.
import { atom, read, update } from 'claude-code'

import { ciOf, parseBranches, parsePrs, parseRemote, parseShortstat, parseStatus } from './gitinfo'
import type { GitDetalhe, GitInfo } from './gitinfo'

export const git = atom({ plugin: 'skim-it', key: 'git' } as const, null as GitInfo | null)
const gitDetalhe = atom({ plugin: 'skim-it', key: 'gitDetalhe' } as const, null as GitDetalhe | null)

export const GIT_EVERY_MS = 30_000
const PR_EVERY_MS = 120_000

let busy = false
let lastPrAt = 0
let lastBranch = ''

export async function loadGit($: any) {
  if (busy) return
  busy = true
  try {
    const run = async (argv: string[], timeoutMs = 8000) => {
      try {
        const out = await $.process.run(argv, { timeoutMs })
        return out.exitCode === 0 ? String(out.stdout).trim() : ''
      } catch {
        return ''
      }
    }
    if ((await run(['git', 'rev-parse', '--is-inside-work-tree'])) !== 'true') {
      await update($, git, () => null)
      return
    }
    const before = (await read($, git)) as GitInfo | null
    const branch = (await run(['git', 'branch', '--show-current'])) || 'HEAD@' + (await run(['git', 'rev-parse', '--short', 'HEAD']))
    const remote = parseRemote(await run(['git', 'remote', 'get-url', 'origin']))
    // Alterações contra a branch principal do remoto (ou o upstream, se já estamos nela), mais os arquivos novos.
    const def = await run(['git', 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
    let base = 'HEAD'
    if (def !== '' && branch === def.replace(/^origin\//, '')) base = (await run(['git', 'rev-parse', '--verify', '@{upstream}'])) || 'HEAD'
    else if (def) base = (await run(['git', 'merge-base', 'HEAD', def])) || 'HEAD'
    const stat = parseShortstat(await run(['git', 'diff', '--shortstat', base], 15000))
    const loose = (await run(['git', 'ls-files', '--others', '--exclude-standard'], 10000)).split('\n').filter(Boolean)
    const sync = (await run(['git', 'rev-list', '--left-right', '--count', '@{upstream}...HEAD'])).split(/\s+/)
    const info: GitInfo = {
      repo: remote,
      branch,
      files: stat.files + loose.length,
      add: stat.add,
      del: stat.del,
      behind: Number(sync[0] ?? 0) || 0,
      ahead: Number(sync[1] ?? 0) || 0,
    }
    // O PR muda pouco: no máximo a cada 2 min, ou quando a branch troca.
    const now = Date.now()
    if (before?.pr && before.branch === branch) info.pr = before.pr
    if (remote && (now - lastPrAt >= PR_EVERY_MS || branch !== lastBranch)) {
      lastPrAt = now
      lastBranch = branch
      const raw = await run(['gh', 'pr', 'view', '--json', 'number,state,isDraft,statusCheckRollup'], 20000)
      if (raw) {
        try {
          const pr = JSON.parse(raw)
          info.pr = { num: Number(pr.number), state: String(pr.state ?? ''), draft: pr.isDraft === true, ci: ciOf(pr.statusCheckRollup) }
        } catch {
          info.pr = undefined
        }
      } else info.pr = undefined
    }
    await update($, git, () => info)
    $.ui.invalidate('ui.render')
  } catch {
    // sem git ou sem gh: a linha só some
  } finally {
    busy = false
  }
}

// Detalhe do painel do Git: arquivos alterados, branches recentes e PRs (gh). Só roda quando o painel abre.
let detailBusy = false
export async function loadGitDetail($: any) {
  if (detailBusy) return
  detailBusy = true
  try {
    const run = async (argv: string[], timeoutMs = 10000) => {
      try {
        const out = await $.process.run(argv, { timeoutMs })
        return { ok: out.exitCode === 0, text: out.exitCode === 0 ? String(out.stdout) : '' }
      } catch {
        return { ok: false, text: '' }
      }
    }
    if ((await run(['git', 'rev-parse', '--is-inside-work-tree'])).text.trim() !== 'true') {
      await update($, gitDetalhe, () => ({ files: [], branches: [], prs: [], gh: false }))
      return
    }
    const files = parseStatus((await run(['git', 'status', '--porcelain=v1'])).text)
    const branches = parseBranches((await run(['git', 'for-each-ref', '--sort=-committerdate', '--count=6', '--format=%(refname:short)%09%(committerdate:relative)%09%(HEAD)', 'refs/heads'])).text)
    const fields = 'number,title,state,isDraft,headRefName,url,statusCheckRollup'
    const list = await run(['gh', 'pr', 'list', '--limit', '6', '--json', fields], 20000)
    const mine = await run(['gh', 'pr', 'view', '--json', fields], 20000)
    await update($, gitDetalhe, () => ({ files, branches, prs: parsePrs(list.text), current: parsePrs(mine.text)[0], gh: list.ok }))
  } catch {
    // o painel mostra o que tiver
  } finally {
    detailBusy = false
    $.ui.invalidate('ui.render')
  }
}

