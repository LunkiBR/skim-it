// Faz o Node achar imports sem extensão (./color) como o engine do mod acha: tenta .ts.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context)
    throw error
  }
}
