// Quebra o markdown de uma resposta em títulos (# e ##), réguas antes de cada ## e o resto.
// Não toca em nada dentro de cerca de código. Sem título, ou com markdown que quebrar em blocos
// estragaria (HTML, definição de link, nota de rodapé), devolve null: o app desenha como sempre.
export type Block = { kind: 'heading'; text: string } | { kind: 'markdown'; text: string } | { kind: 'rule' }

// CommonMark: abertura de crase não leva crase na informação; fecho é só a cerca, do mesmo
// caractere e pelo menos do mesmo tamanho.
const OPEN = /^ {0,3}(?:(`{3,})[^`]*|(~{3,}).*)$/
const CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/
// Título na coluna zero: título recuado costuma estar dentro de lista e fica onde está.
const HEADING = /^(#{1,2})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/
const BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
// Fora de código: bloco HTML, definição de link ou nota de rodapé atravessariam os blocos.
const UNSAFE = /^ {0,3}(?:<\/?[a-z][\w-]*[\s/>]|\[[^\]]+\]:)/i

// Título desenhado como texto puro: protege crase primeiro, depois tira ênfase e link.
export function plain(text: string): string {
  const spans: string[] = []
  const held = text.replace(/`([^`]+)`/g, (_, code: string) => '\u0000' + (spans.push(code) - 1) + '\u0000')
  const bare = held
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/(^|[^*\w])\*(\S(?:.*?\S)?)\*(?=[^*\w]|$)/g, '$1$2')
  return bare.replace(/\u0000(\d+)\u0000/g, (_, i: string) => spans[Number(i)] ?? '')
}

// Link relativo vira file:/// a partir da pasta da sessão: o Markdown de um mod só torna
// clicável http, https e file. Cerca e crase ficam intactas.
export function absolutize(markdown: string, base: string): string {
  const root = 'file:///' + base.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '') + '/'
  const fix = (segment: string) =>
    segment.replace(/\]\(([^)\s]+)\)/g, (whole, target: string) =>
      /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') ? whole : '](' + root + target.replace(/^\.\//, '') + ')',
    )
  let fence: string | null = null
  return markdown
    .split('\n')
    .map(line => {
      if (fence !== null) {
        const close = line.match(CLOSE)?.[1]
        if (close && close[0] === fence[0] && close.length >= fence.length) fence = null
        return line
      }
      const open = line.match(OPEN)
      if (open) {
        fence = open[1] ?? open[2] ?? null
        return line
      }
      return line
        .split(/(`[^`]*`)/)
        .map(part => (part.startsWith('`') ? part : fix(part)))
        .join('')
    })
    .join('\n')
}

export function splitBlocks(text: string): Block[] | null {
  const blocks: Block[] = []
  let buffer: string[] = []
  let fence: string | null = null
  let hasHeading = false

  const flush = () => {
    const md = buffer.join('\n').trim()
    if (md) blocks.push({ kind: 'markdown', text: md })
    buffer = []
  }

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (fence !== null) {
      const close = line.match(CLOSE)?.[1]
      if (close && close[0] === fence[0] && close.length >= fence.length) fence = null
      buffer.push(line)
      continue
    }
    const open = line.match(OPEN)
    if (open) {
      fence = open[1] ?? open[2] ?? null
      buffer.push(line)
      continue
    }
    if (UNSAFE.test(line)) return null
    const heading = line.match(HEADING)
    if (!heading) {
      buffer.push(line)
      continue
    }
    const isSection = heading[1] === '##'
    if (isSection) {
      // A régua do mod substitui um --- que o texto já trazia logo antes da seção.
      while (buffer.length > 0 && buffer[buffer.length - 1]!.trim() === '') buffer.pop()
      const last = buffer[buffer.length - 1]
      const before = buffer[buffer.length - 2]
      if (last !== undefined && BREAK.test(last) && (before === undefined || before.trim() === '')) buffer.pop()
    }
    flush()
    const previous = blocks[blocks.length - 1]
    if (isSection && previous !== undefined && previous.kind !== 'heading') blocks.push({ kind: 'rule' })
    blocks.push({ kind: 'heading', text: plain(heading[2]!) })
    hasHeading = true
  }
  flush()
  return hasHeading ? blocks : null
}
