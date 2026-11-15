// `/skim-it importar` (v0.4): lê um conjunto limitado de arquivos da raiz, propõe `.claude/skim-it.json`
// em `.claude/skim-it.proposta.json` e, com `aprovar`, promove a proposta. Já existindo `.claude/skim-it.json`,
// só `aprovar!` o troca.
import { getLang, tr } from './i18n'
import { proposeConfig, rootRefusal } from './importer'
import { parseConfig } from './project'

const MAX_BYTES = 200 * 1024
const MAX_FILES = 30 // css e tokens
const MAX_DIRS = 400
const SKIP = new Set(['node_modules', 'dist', 'build'])
const ROOT_FILES = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs', 'package.json', 'SKILL.md', 'README.md']
const isStyle = (name: string) => (/\.css$/i.test(name) && !/\.min\.css$/i.test(name)) || /(^|\.)tokens\.json$/i.test(name)

async function collect($: any, root: string) {
  const files: { path: string; text: string }[] = []
  const ls = async (rel: string): Promise<any[]> => {
    try {
      return await $.fs.list(rel ? root + '/' + rel : root)
    } catch {
      return []
    }
  }
  const take = async (rel: string, size: number) => {
    if (size > MAX_BYTES) return
    try {
      files.push({ path: rel, text: String(await $.fs.read(root + '/' + rel)) })
    } catch {
      // ilegível: sem evidência
    }
  }
  for (const e of await ls('')) if (e.kind === 'file' && ROOT_FILES.includes(e.name)) await take(e.name, e.size)
  for (const d of await ls('.claude/skills')) {
    if (d.kind !== 'dir') continue
    for (const f of await ls('.claude/skills/' + d.name)) if (f.kind === 'file' && (f.name === 'SKILL.md' || f.name === 'README.md')) await take('.claude/skills/' + d.name + '/' + f.name, f.size)
  }
  // Largura primeiro, até 3 níveis; pastas com ponto (.git, .next) e as de saída ficam de fora.
  const queue: [string, number][] = [['', 0]]
  let styles = 0
  for (let seen = 0; queue.length > 0 && styles < MAX_FILES && seen < MAX_DIRS; seen++) {
    const [dir, depth] = queue.shift() as [string, number]
    for (const e of await ls(dir)) {
      const rel = dir ? dir + '/' + e.name : e.name
      if (e.kind === 'dir') {
        if (depth < 3 && !e.name.startsWith('.') && !SKIP.has(e.name)) queue.push([rel, depth + 1])
      } else if (e.kind === 'file' && isStyle(e.name) && styles < MAX_FILES) {
        styles++
        await take(rel, e.size)
      }
    }
  }
  return files
}

export async function importar($: any, root: string): Promise<string> {
  const lang = getLang()
  const refused = rootRefusal(root, lang)
  if (refused) return refused
  const files = await collect($, root)
  const { config, evidence } = proposeConfig(files)
  await $.fs.write(root + '/.claude/skim-it.proposta.json', JSON.stringify(config, null, 2) + '\n')
  const has = await $.fs.exists(root + '/.claude/skim-it.json').catch(() => false)
  return [
    tr(lang, 'imp.written', { n: files.length }),
    JSON.stringify(config, null, 2),
    evidence.length ? tr(lang, 'imp.evidence') + '\n' + evidence.map(l => '- ' + l).join('\n') : tr(lang, 'imp.noColor'),
    has ? tr(lang, 'imp.exists') : tr(lang, 'imp.fresh'),
  ].join('\n')
}

export async function aprovar($: any, root: string, force = false): Promise<{ ok: boolean; text: string }> {
  const lang = getLang()
  const refused = rootRefusal(root, lang)
  if (refused) return { ok: false, text: refused }
  if (!force && (await $.fs.exists(root + '/.claude/skim-it.json').catch(() => false))) {
    return { ok: false, text: tr(lang, 'imp.existsStop') }
  }
  let raw: string
  try {
    raw = String(await $.fs.read(root + '/.claude/skim-it.proposta.json'))
  } catch {
    return { ok: false, text: tr(lang, 'imp.noProposal') }
  }
  const { config, errors } = parseConfig(raw, lang)
  if (!config) return { ok: false, text: tr(lang, 'imp.invalid', { errs: errors.join('; ') }) }
  await $.fs.write(root + '/.claude/skim-it.json', JSON.stringify(config, null, 2) + '\n')
  return { ok: true, text: tr(lang, 'imp.saved') }
}
