#!/usr/bin/env node
/**
 * Bundles bin/kitflow.js and all its dependencies into a single CommonJS file.
 *
 * The resulting bin/kitflow.bundle.cjs:
 *   - Has no external npm dependencies at runtime
 *   - Is plain CJS — no ASAR, no ESM resolution needed
 *   - Can be run by the Electron binary with ELECTRON_RUN_AS_NODE=1
 *
 * Used by the electron:build script. Output is git-ignored.
 */

import { build } from 'esbuild'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

await build({
  entryPoints: [resolve(root, 'bin/kitflow-bundle-entry.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: resolve(root, 'bin/kitflow.bundle.cjs'),
  // yaml and @kitops/kitops-ts are bundled in; child_process/fs/path stay as
  // Node.js built-ins and are NOT bundled (esbuild skips them automatically).
  //
  // Suppress the import.meta warning: kitflow.js guards import.meta.url with
  // a ternary so the CJS bundle handles it correctly (empty string fallback).
  logOverride: { 'empty-import-meta': 'silent' },
})

console.log('kitflow bundled → bin/kitflow.bundle.cjs')
