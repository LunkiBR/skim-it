// Propõe `.claude/skim-it.json` a partir de arquivos que o chamador leu: procura a cor da marca em
// Tailwind, variáveis CSS, tokens JSON, SKILL.md/README e package.json. Puro: não lê disco.
import { tr } from './i18n'
import type { Lang } from './i18n'
import { hexToOklch, type ProjectConfig } from './project'

type Cand = { hex: string; score: number; role: 'primaria' | 'secundaria'; ev: string }

const HEXRE = '#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b'
const isHex = (v: unknown): v is string => typeof v === 'string' && new RegExp('^' + HEXRE + '$').test(v)
const norm = (h: string) => {
  h = h.toLowerCase()
  return h.length === 4 ? '#' + [1, 2, 3].map(i => (h[i] as string).repeat(2)).join('') : h
}
const roleOf = (name: string): 'primaria' | 'secundaria' | null =>
  /primary|primar|brand|marca/i.test(name) ? 'primaria' : /secondary|secund|accent|destaque/i.test(name) ? 'secundaria' : null

function walk(node: unknown, path: string[], out: { path: string; hex: string }[]) {
  if (typeof node !== 'object' || node === null) return
  for (const [k, v] of Object.entries(node)) {
    if ((k === '$value' || k === 'value') && isHex(v)) out.push({ path: path.join('.'), hex: v })
    else walk(v, [...path, k], out)
  }
}

export function proposeConfig(files: { path: string; text: string }[]): { config: ProjectConfig; evidence: string[] } {
  const cands: Cand[] = []
  const add = (f: string, hex: string, name: string, w: number, role: 'primaria' | 'secundaria') =>
    cands.push({ hex: norm(hex), score: w, role, ev: `${f}: ${name} ${norm(hex)}` })

  for (const { path, text } of files) {
    const lower = (path.replace(/\\/g, '/').split('/').pop() ?? path).toLowerCase()
    if (/^tailwind\.config\./.test(lower)) {
      // chave: '#hex' ou chave: { DEFAULT|500: '#hex' }
      const re = new RegExp(`['"]?([\\w-]*(?:primary|brand|secondary|accent)[\\w-]*)['"]?\\s*:\\s*(?:\\{[^}]*?(?:DEFAULT|500)['"]?\\s*:\\s*)?['"](${HEXRE})['"]`, 'gi')
      for (const m of text.matchAll(re)) add(path, m[2] as string, m[1] as string, 8 + +/^primary$/i.test(m[1] as string), roleOf(m[1] as string) ?? 'secundaria')
    } else if (/\.(css|scss|less|pcss)$/.test(lower)) {
      const re = new RegExp(`--([\\w-]*(?:primary|brand|accent|secondary)[\\w-]*)\\s*:\\s*(${HEXRE})`, 'gi')
      for (const m of text.matchAll(re)) add(path, m[2] as string, '--' + m[1], 7 + +/^primary$/i.test(m[1] as string), roleOf(m[1] as string) ?? 'secundaria')
    } else if (lower === 'package.json') {
      try {
        const b = (JSON.parse(text) as Record<string, unknown>).brand
        const found: { path: string; hex: string }[] = []
        if (isHex(b)) found.push({ path: 'brand', hex: b })
        else if (b && typeof b === 'object') for (const [k, v] of Object.entries(b)) if (isHex(v)) found.push({ path: 'brand.' + k, hex: v })
        for (const f of found) add(path, f.hex, f.path, 9, /secund|accent/i.test(f.path) ? 'secundaria' : 'primaria')
      } catch { /* JSON ruim: sem evidência */ }
    } else if (lower.endsWith('.json')) {
      try {
        const found: { path: string; hex: string }[] = []
        walk(JSON.parse(text), [], found)
        for (const f of found) {
          const r = roleOf(f.path)
          if (r) add(path, f.hex, f.path, 8, r)
        }
      } catch { /* não é token */ }
    } else if (/\.mdx?$/.test(lower)) {
      for (const line of text.split('\n')) {
        const hex = line.match(new RegExp(HEXRE))?.[0]
        if (!hex || !/\b(cor|cores|prim[aá]ria|brand|marca|primary|accent|destaque)\b/i.test(line)) continue
        const second = /secund|secondary|accent|destaque/i.test(line) && !/prim[aá]ria|primary|brand|marca/i.test(line)
        add(path, hex, line.replace(new RegExp(HEXRE, 'g'), '').trim().slice(0, 30) || 'cor', lower === 'skill.md' ? 5 : 4, second ? 'secundaria' : 'primaria')
      }
    }
  }
  // Cinza não é cor de marca.
  const colorful = cands.filter(c => hexToOklch(c.hex).C >= 0.04)
  const best = (role: Cand['role'], skip?: string) => {
    const by = new Map<string, number>()
    for (const c of colorful) if (c.role === role && c.hex !== skip) by.set(c.hex, (by.get(c.hex) ?? 0) + c.score)
    return [...by].sort((a, b) => b[1] - a[1])[0]?.[0]
  }
  const primaria = best('primaria') ?? best('secundaria')
  const secundaria = primaria ? best('secundaria', primaria) : undefined
  const config: ProjectConfig = { tipo: 'projeto' }
  if (primaria) config.marca = secundaria ? { primaria, secundaria } : { primaria }
  const used = new Set([primaria, secundaria])
  const evidence = colorful.filter(c => used.has(c.hex)).sort((a, b) => b.score - a.score).map(c => c.ev)
  return { config, evidence }
}

/** Raiz onde o importar não grava: dentro de .git (submódulo, repositório bare). Devolve o motivo, ou undefined. */
export function rootRefusal(root: string, lang: Lang = 'pt'): string | undefined {
  return (root.split(String.fromCharCode(92)).join('/') + '/').includes('/.git/') ? tr(lang, 'imp.refusal', { root }) : undefined
}
