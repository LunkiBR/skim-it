// Caches e conjuntos com teto: sem isso os de módulo crescem a sessão inteira. Puro.

/** Valor guardado em `map` sob `key`; calcula com `make` se faltar e descarta o mais antigo acima de `max`. */
export function memo<K, V>(map: Map<K, V>, key: K, make: () => V, max = 200): V {
  if (map.has(key)) return map.get(key) as V
  const value = make()
  map.set(key, value)
  if (map.size > max) map.delete(map.keys().next().value as K)
  return value
}

/** Põe `value` no conjunto e descarta os mais antigos acima de `max`. */
export function addBounded<T>(set: Set<T>, value: T, max = 200): void {
  set.delete(value)
  set.add(value)
  while (set.size > max) set.delete(set.values().next().value as T)
}
