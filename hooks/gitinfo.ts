// Partes puras do Git (portadas do session-hue): leitura de remote, shortstat, CI e a linha de texto da band.

import type { CiState, GitArquivo, GitBranch, GitInfo, GitPr } from '../types'
import { cnt, tr } from './i18n'
import type { Lang } from './i18n'
export type { CiState, GitArquivo, GitBranch, GitDetalhe, GitInfo, GitPr } from '../types'

// "git@github.com:dono/nome.git" ou "https://github.com/dono/nome" -> "dono/nome"
export function parseRemote(url: string): string {
  const match = url.trim().match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?\/?$/)
  return match?.[1] ?? ''
}

// "3 files changed, 10 insertions(+), 2 deletions(-)"
export function parseShortstat(text: string): { files: number; add: number; del: number } {
  return {
    files: Number(text.match(/(\d+) files? changed/)?.[1] ?? 0),
    add: Number(text.match(/(\d+) insertion/)?.[1] ?? 0),
    del: Number(text.match(/(\d+) deletion/)?.[1] ?? 0),
  }
}

const FAILED = ['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'STARTUP_FAILURE', 'ACTION_REQUIRED']

// Resultado dos checks de um PR (statusCheckRollup do gh): falhou, ainda roda, ou passou.
export function ciOf(rollup: unknown): CiState {
  if (!Array.isArray(rollup) || rollup.length === 0) return ''
  let pending = false
  for (const item of rollup) {
    const verdict = String(item?.conclusion || item?.state || '').toUpperCase()
    const status = String(item?.status || '').toUpperCase()
    if (FAILED.includes(verdict)) return 'fail'
    if (verdict === '' || ['PENDING', 'EXPECTED'].includes(verdict) || ['IN_PROGRESS', 'QUEUED', 'PENDING', 'WAITING'].includes(status)) pending = true
  }
  return pending ? 'pending' : 'pass'
}

// "PR #12 rascunho ✓": a pílula do PR (número, estado e resultado dos checks).
export function prText(info: GitInfo, lang: Lang = 'pt'): string {
  if (!info.pr) return ''
  const mark = info.pr.ci === 'pass' ? ' ✓' : info.pr.ci === 'fail' ? ' ✗' : info.pr.ci === 'pending' ? ' ◌' : ''
  const state = info.pr.draft ? ' ' + tr(lang, 'git.draft') : info.pr.state === 'MERGED' ? ' ' + tr(lang, 'git.merged') : info.pr.state === 'CLOSED' ? ' ' + tr(lang, 'git.closed') : ''
  return 'PR #' + info.pr.num + state + mark
}

// "· 3 alterações · ↑2 ↓1" (vazio sem nada a dizer): o texto secundário da linha Git da band.
export function changesText(info: GitInfo, lang: Lang = 'pt'): string {
  const parts: string[] = []
  if (info.files > 0) parts.push(cnt(lang, info.files, 'change'))
  if (info.ahead || info.behind) parts.push('↑' + info.ahead + ' ↓' + info.behind)
  return parts.length ? '· ' + parts.join(' · ') : ''
}

// "branch · PR #12 ✓ · ↑2 ↓1 · 3 arquivos"; partes vazias somem.
export function gitLine(info: GitInfo | null | undefined, lang: Lang = 'pt'): string {
  if (!info) return ''
  const parts: string[] = []
  if (info.branch) parts.push(info.branch)
  if (info.pr) parts.push(prText(info, lang))
  if (info.ahead || info.behind) parts.push('↑' + info.ahead + ' ↓' + info.behind)
  if (info.files > 0) parts.push(cnt(lang, info.files, 'file'))
  return parts.join(' · ')
}

// ---- detalhe do painel do Git (puro, testado em scripts/check-git.mjs) ----

/** `git status --porcelain=v1`: "XY caminho" por linha; renomeado mostra o destino. */
export function parseStatus(text: string): GitArquivo[] {
  return text.split('\n').filter(l => l.length > 3).map(l => {
    const raw = l.slice(3)
    const arrow = raw.indexOf(' -> ')
    return { status: l.slice(0, 2).trim() || '?', path: arrow >= 0 ? raw.slice(arrow + 4) : raw }
  })
}

/** `git for-each-ref --format=%(refname:short)%09%(committerdate:relative)%09%(HEAD)`. */
export function parseBranches(text: string): GitBranch[] {
  return text.split('\n').filter(Boolean).map(l => {
    const [name = '', when = '', head = ''] = l.split('\t')
    return { name, when, current: head.trim() === '*' }
  }).filter(b => b.name)
}

function prOf(o: any): GitPr | undefined {
  if (!o || typeof o.number !== 'number') return undefined
  return {
    num: o.number,
    title: String(o.title ?? ''),
    state: String(o.state ?? ''),
    draft: o.isDraft === true,
    ci: ciOf(o.statusCheckRollup),
    branch: String(o.headRefName ?? ''),
    url: /^https:\/\//.test(String(o.url ?? '')) ? String(o.url) : '',
  }
}

/** `gh pr list --json ...` (lista) ou `gh pr view --json ...` (um): o que não for JSON vira vazio. */
export function parsePrs(json: string): GitPr[] {
  try {
    const v = JSON.parse(json)
    return (Array.isArray(v) ? v : [v]).map(prOf).filter((p): p is GitPr => !!p)
  } catch {
    return []
  }
}

/** Marca de CI para texto: ✓ passou, ✗ falhou, ◌ rodando, nada sem checks. */
export const ciMark = (ci: CiState): string => (ci === 'pass' ? '✓' : ci === 'fail' ? '✗' : ci === 'pending' ? '◌' : '')

