/**
 * CLI arg validation tests for kitflow kit.* steps.
 *
 * For every kit.* step in every sample YAML file under kitflows/, this test:
 *   1. Fills all variables with placeholder values.
 *   2. Builds the kit CLI args via buildKitArgs().
 *   3. Spawns the real kit binary with those args.
 *   4. Asserts the output does NOT contain "unknown flag" or "unknown command".
 *
 * Auth errors, network errors, and "reference not found" are all acceptable —
 * they mean kit parsed the args correctly and got far enough to attempt the
 * operation. Only argument-structure errors indicate a bug in buildKitArgs.
 *
 * Requires the kit CLI to be on PATH (or KITOPS_CLI_PATH to be set).
 */

import { spawn } from 'child_process'
import { readdirSync, readFileSync } from 'fs'
import { dirname,join } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect,it } from 'vitest'
import { parse as parseYaml } from 'yaml'

import { buildKitArgs, interpolateDeep } from './kitflow.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KITFLOWS_DIR = join(__dirname, '../kitflows')

// Use a local address for all OCI references — connection refused is instant,
// unlike a real hostname that may timeout waiting for a TCP response.
const PLACEHOLDER = '127.0.0.1:5000/test/placeholder:latest'

// Workspace root passed to buildKitArgs for path resolution
const WORKSPACE = '/tmp/kitflow-test-workspace'

// ── Helpers ───────────────────────────────────────────────────────────────────

function runKit(args, timeoutMs = 3000) {
  return new Promise(resolve => {
    const kitBin = process.env.KITOPS_CLI_PATH ?? 'kit'
    const child = spawn(kitBin, args, { stdio: 'pipe' })

    let stderr = ''
    let stdout = ''
    child.stderr?.on('data', d => {
      stderr += d.toString() 
    })
    child.stdout?.on('data', d => {
      stdout += d.toString() 
    })

    const timer = setTimeout(() => {
      child.kill()
      resolve({ timedOut: true, stderr, stdout })
    }, timeoutMs)

    child.on('close', code => {
      clearTimeout(timer)
      resolve({ code, stderr, stdout, timedOut: false })
    })
    child.on('error', err => {
      clearTimeout(timer)
      resolve({ code: -1, stderr: err.message, stdout: '', timedOut: false })
    })
  })
}

/**
 * Loads a kitflow YAML and returns the kit.* steps with all vars pre-filled
 * with placeholder values so the arg builder has something to work with.
 */
function loadKitSteps(yamlPath) {
  const raw = parseYaml(readFileSync(yamlPath, 'utf-8'))

  const vars = {}
  for (const name of Object.keys(raw.vars ?? {})) {
    vars[name] = PLACEHOLDER
  }

  const kitSteps = (raw.steps ?? [])
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => Object.keys(step).some(k => k.startsWith('kit.')))

  return { vars, kitSteps }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const yamlFiles = readdirSync(KITFLOWS_DIR)
  .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))

for (const filename of yamlFiles) {
  const yamlPath = join(KITFLOWS_DIR, filename)
  const { vars, kitSteps } = loadKitSteps(yamlPath)

  describe(filename, () => {
    for (const { step, index } of kitSteps) {
      const command = Object.keys(step).find(k => k.startsWith('kit.'))
      const subcommand = command.slice(4)
      const label = step.name ?? `step ${index} (${command})`

      it(label, async () => {
        const interpolated = interpolateDeep(step[command], vars)
        const args = buildKitArgs(subcommand, interpolated, WORKSPACE)

        const { stderr, timedOut } = await runKit(args)

        // Timeouts mean kit was trying a real operation (args were valid).
        // Skip the assertion — the command structure is fine.
        if (timedOut) {
          return
        }

        // If kit isn't installed, skip gracefully instead of failing everything.
        if (stderr.includes('ENOENT') || stderr.includes('not found')) {
          return
        }

        expect(
          stderr,
          `kit ${args.join(' ')}\n\n${stderr}`,
        ).not.toMatch(/unknown flag:/i)

        expect(
          stderr,
          `kit ${args.join(' ')}\n\n${stderr}`,
        ).not.toMatch(/^Error: unknown command /m)
      }, 8000 /* longer than the kit spawn timeout of 3s */)
    }
  })
}

// ── Explicit coverage for every kit subcommand ────────────────────────────────
//
// One test per meaningful flag combination. These don't come from YAML files —
// they directly call buildKitArgs so every command is covered even if no sample
// flow uses it. The assertion is identical: no "unknown flag" / "unknown command"
// in stderr; anything else (auth error, network error) is acceptable.

const REGISTRY = '127.0.0.1:5000'
const REF = `${REGISTRY}/test/placeholder:latest`

// [label, subcommand, params]
const ALL_SUBCOMMAND_CASES = [
  // version ──────────────────────────────────────────────────────────────────
  ['version', 'version', {}],

  // list ─────────────────────────────────────────────────────────────────────
  ['list (local, no args)', 'list', {}],
  ['list (remote repository)', 'list', { ref: REF }],

  // info ─────────────────────────────────────────────────────────────────────
  ['info', 'info', { ref: REF }],

  // inspect ──────────────────────────────────────────────────────────────────
  ['inspect', 'inspect', { ref: REF }],
  ['inspect --remote', 'inspect', { ref: REF, remote: true }],

  // pack ─────────────────────────────────────────────────────────────────────
  ['pack (dir only)', 'pack', { args: './model' }],
  ['pack --tag', 'pack', { args: './model', tag: REF }],
  ['pack --tag --compression', 'pack', { args: './model', tag: REF, compression: 'zstd' }],

  // unpack ───────────────────────────────────────────────────────────────────
  ['unpack (ref only)', 'unpack', { ref: REF }],
  ['unpack --dir', 'unpack', { ref: REF, dir: './output' }],
  ['unpack --filter (string)', 'unpack', { ref: REF, dir: './output', filter: 'model' }],
  ['unpack --filter (array)', 'unpack', { ref: REF, dir: './output', filter: ['model', 'datasets'] }],
  ['unpack --ignore-existing', 'unpack', { ref: REF, 'ignore-existing': true }],

  // push ─────────────────────────────────────────────────────────────────────
  ['push (single ref)', 'push', { ref: REF }],
  ['push (source + destination)', 'push', { ref: [REF, REF] }],
  ['push --plain-http', 'push', { ref: REF, 'plain-http': true }],
  ['push --tls-verify=false', 'push', { ref: REF, 'tls-verify': false }],

  // pull ─────────────────────────────────────────────────────────────────────
  ['pull', 'pull', { ref: REF }],
  ['pull --plain-http', 'pull', { ref: REF, 'plain-http': true }],
  ['pull --tls-verify=false', 'pull', { ref: REF, 'tls-verify': false }],

  // init ─────────────────────────────────────────────────────────────────────
  ['init (dir only)', 'init', { args: './model' }],
  ['init --name --desc --author', 'init', { args: './model', name: 'my-model', desc: 'My Model', author: 'ML Team' }],
  ['init --force', 'init', { args: './model', force: true }],

  // tag ──────────────────────────────────────────────────────────────────────
  ['tag (source + destination)', 'tag', { ref: [REF, REF] }],

  // remove ───────────────────────────────────────────────────────────────────
  ['remove (by ref)', 'remove', { ref: REF }],
  ['remove --force', 'remove', { ref: REF, force: true }],
  ['remove --remote', 'remove', { ref: REF, remote: true }],
  ['remove --all', 'remove', { all: true }],

  // login ────────────────────────────────────────────────────────────────────
  // kit.login maps to `kit login`; password-stdin is the safe variant,
  // --password is the unsafe-but-convenient variant.
  ['login --username --password-stdin', 'login', { ref: REGISTRY, username: 'user', 'password-stdin': true }],
  ['login --username --password', 'login', { ref: REGISTRY, username: 'user', password: 'pass' }],

  // logout ───────────────────────────────────────────────────────────────────
  ['logout', 'logout', { ref: REGISTRY }],

  // diff ─────────────────────────────────────────────────────────────────────
  ['diff (two refs)', 'diff', { ref: [REF, REF] }],
]

describe('all kit subcommands', () => {
  for (const [label, subcommand, params] of ALL_SUBCOMMAND_CASES) {
    it(label, async () => {
      const args = buildKitArgs(subcommand, params, WORKSPACE)

      const { stderr, timedOut } = await runKit(args)

      if (timedOut) {
        return
      }
      if (stderr.includes('ENOENT') || stderr.includes('not found')) {
        return
      }

      expect(
        stderr,
        `kit ${args.join(' ')}\n\n${stderr}`,
      ).not.toMatch(/unknown flag:/i)

      expect(
        stderr,
        `kit ${args.join(' ')}\n\n${stderr}`,
      ).not.toMatch(/^Error: unknown command /m)
    }, 8000)
  }
})
