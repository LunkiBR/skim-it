// Uso: node --import ./scripts/register.mjs <script>
import { register } from 'node:module'
register('./ts-resolve.mjs', import.meta.url)
