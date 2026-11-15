// Roda todas as checagens (scripts/check-*.mjs) com o carregador de .ts e para na primeira que falhar.
// Uso: node scripts/check-all.mjs (ou npm test)
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('.', import.meta.url))
const checks = readdirSync(dir).filter(f => /^check-.+\.mjs$/.test(f) && f !== 'check-all.mjs').sort()
let failed = 0
for (const f of checks) {
  const r = spawnSync(process.execPath, ['--import', './scripts/register.mjs', 'scripts/' + f], { cwd: dir + '..', encoding: 'utf8' })
  const last = (r.stdout.trim().split('\n').pop() ?? '').trim()
  console.log((r.status === 0 ? 'ok   ' : 'FAIL ') + f.padEnd(20) + last)
  if (r.status !== 0) {
    failed++
    process.stdout.write(r.stdout + r.stderr)
  }
}
console.log(failed ? failed + ' of ' + checks.length + ' failed' : checks.length + ' checks passed')
process.exit(failed ? 1 : 0)
