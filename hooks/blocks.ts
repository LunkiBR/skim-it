// Reescreve o markdown de uma resposta para o próprio app desenhar: ## vira # (no Desktop, # é o
// único título nativo maior que o corpo; ## e ### saem do tamanho do corpo) e uma régua --- entra
// antes de cada ## que vem depois de texto. Não toca em nada dentro de cerca de código. Sem título
// # ou ##, devolve null: o app desenha como sempre.

// CommonMark: abertura de crase não leva crase na informação; fecho é só a cerca, do mesmo
// caractere e pelo menos do mesmo tamanho.
const OPEN = /^ {0,3}(?:(`{3,})[^`]*|(~{3,}).*)$/
const CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/
// Título na coluna zero: título recuado costuma estar dentro de lista e fica onde está.
const HEADING = /^(#{1,2})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/
const ANY_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/
const BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/

const isBlank = (line: string | undefined) => line !== undefined && line.trim() === ''

export function sections(text: string): string | null {
  const out: string[] = []
  let fence: string | null = null
  let hasHeading = false

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (fence !== null) {
      const close = line.match(CLOSE)?.[1]
      if (close && close[0] === fence[0] && close.length >= fence.length) fence = null
      out.push(line)
      continue
    }
    const open = line.match(OPEN)
    if (open) {
      fence = open[1] ?? open[2] ?? null
      out.push(line)
      continue
    }
    const heading = line.match(HEADING)
    if (!heading) {
      out.push(line)
      continue
    }
    hasHeading = true
    if (heading[1] === '##') {
      while (isBlank(out[out.length - 1])) out.pop()
      // A régua da seção substitui um --- que o texto já trazia logo antes dela; colado no texto é
      // sublinhado de título setext e fica.
      const isSetext = BREAK.test(out[out.length - 1] ?? '') && out.length > 1 && !isBlank(out[out.length - 2])
      if (BREAK.test(out[out.length - 1] ?? '') && !isSetext) {
        out.pop()
        while (isBlank(out[out.length - 1])) out.pop()
      }
      const previous = out[out.length - 1]
      // Sem régua no topo da resposta nem logo abaixo de outro título.
      if (previous !== undefined && !ANY_HEADING.test(previous) && !isSetext) out.push('', '---')
      if (out.length > 0) out.push('')
    }
    out.push('# ' + heading[2])
  }
  return hasHeading ? out.join('\n') : null
}
