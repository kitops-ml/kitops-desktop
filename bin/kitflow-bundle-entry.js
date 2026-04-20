// Bundle entry point for the standalone kitflow binary.
// This file is used by scripts/bundle-kitflow.mjs — do not run directly.
import { main } from './kitflow.js'
main().catch(e => {
  process.stderr.write('Fatal: ' + (e?.message || String(e)) + '\n'); process.exit(1) 
})
