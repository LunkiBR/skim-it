// O SVG de uma peça (hooks/desenho.ts) como elemento do Desktop, com a descrição completa em `alt`;
// onde não há `Svg` (terminal), o texto da descrição. Usado pela band e pelo cartão de ajustes.
import type { Piece } from './desenho'

export function draw(el: any, p: Piece, alt: string, interactive = false) {
  const { Svg, Text } = el
  if (!Svg) return <Text dimColor>{alt}</Text>
  return <Svg source={p.source} alt={alt} width={p.width} height={p.height} isInteractive={interactive ? true : undefined} />
}
