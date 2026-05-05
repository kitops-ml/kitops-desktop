#!/usr/bin/env node
/**
 * kitflow — CLI runner for KitFlow YAML files.
 *
 * Usage: kitflow <path/to/flow.yaml> [--json] [--<var>=<value> ...]
 *
 * --json            Emit newline-delimited JSON events instead of human-readable
 *                   output. Used by the desktop app's IPC layer.
 * --<var>=<value>   Pre-supply a value for a flow variable by name, e.g.
 *                   --author=me. When all required variables are covered the
 *                   interactive prompt is skipped.
 */

import * as kitops from '@kitops/kitops-ts'
import { spawn } from 'child_process'
import { cp, mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'path'
import { createInterface } from 'readline'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'

// import.meta.url is undefined when kitflow.js is bundled to CJS for the
// standalone binary. In that case the guard below is irrelevant (the bundle
// entry calls main() directly), so an empty string is a safe fallback.
const __filename = import.meta.url ? fileURLToPath(import.meta.url) : ''

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

const isTTY = process.stdout.isTTY
function c(code, text) {
  return isTTY ? `${code}${text}${ansi.reset}` : text
}

// ── Filters & interpolation ───────────────────────────────────────────────────

function applyFilter(value, filterStr) {
  switch (filterStr.trim()) {
    case 'tag': {
      const lastSlash = value.lastIndexOf('/')
      const segment = lastSlash >= 0 ? value.slice(lastSlash) : value
      const colon = segment.indexOf(':')
      return colon >= 0 ? segment.slice(colon + 1) : ''
    }
    case 'strip-tag': {
      const lastSlash = value.lastIndexOf('/')
      if (lastSlash < 0) {
        return value
      }
      const segment = value.slice(lastSlash)
      const colon = segment.indexOf(':')
      return colon >= 0 ? value.slice(0, lastSlash + colon) : value
    }
  }
  const m = filterStr.match(/^(\w+)\s+['"](.+?)['"]$/)
  if (!m) {
    return value
  }
  const [, name, sep] = m
  switch (name) {
    case 'after': { const i = value.lastIndexOf(sep); return i >= 0 ? value.slice(i + sep.length) : value }
    case 'before': { const i = value.indexOf(sep); return i >= 0 ? value.slice(0, i) : value }
    default: return value
  }
}

export function interpolate(value, vars) {
  return value.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    const parts = expr.split('|').map(s => s.trim())
    const name = parts[0]
    const filters = parts.slice(1)
    if (!(name in vars)) {
      return match
    }
    return filters.reduce((v, f) => applyFilter(v, f), vars[name])
  })
}

export function interpolateDeep(obj, vars) {
  if (typeof obj === 'string') {
    return interpolate(obj, vars)
  }
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateDeep(item, vars))
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, interpolateDeep(v, vars)]),
    )
  }
  return obj
}

// ── Path helpers ──────────────────────────────────────────────────────────────

function resolvePath(relativePath, root) {
  if (isAbsolute(relativePath)) {
    throw new Error(`Absolute paths are not allowed: ${relativePath}`)
  }
  const resolved = join(root, relativePath)
  const normalizedRoot = root.endsWith(sep) ? root : root + sep
  if (!resolved.startsWith(normalizedRoot) && resolved !== root) {
    throw new Error(`Path escapes workspace: ${relativePath}`)
  }
  return resolved
}

function tryResolvePath(val, root) {
  try {
    return resolvePath(val, root)
  } catch {
    return val
  }
}

function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((current, key) => {
    if (current !== null && typeof current === 'object') {
      return current[key]
    }
    return undefined
  }, obj)
}

// ── Loop expansion ────────────────────────────────────────────────────────────

/**
 * Flattens `for` loop steps into concrete steps using the resolved vars.
 * Must be called after vars are collected so `count` expressions can be evaluated.
 *
 * Syntax:
 *   - name: Optional group label
 *     for:
 *       var: i          # loop variable name, available as ${i} in nested steps
 *       count: "10"     # iterations (1-based); can reference a var: "${n}"
 *       steps:
 *         - name: Step ${i}
 *           write: ...
 */
export function expandSteps(steps, vars) {
  const flat = []
  for (const step of steps) {
    const forDef = step.for
    if (forDef !== null && forDef !== undefined && typeof forDef === 'object' && !Array.isArray(forDef)) {
      const count = Math.max(0, parseInt(interpolate(String(forDef.count ?? '0'), vars), 10))
      const varName = String(forDef.var ?? 'i')
      const loopSteps = Array.isArray(forDef.steps) ? forDef.steps : []
      const baseName = step.name ?? 'Loop'
      for (let iter = 1; iter <= count; iter++) {
        const iterVars = { ...vars, [varName]: String(iter) }
        for (const loopStep of loopSteps) {
          const name = loopStep.name
            ? interpolate(String(loopStep.name), iterVars)
            : `${baseName} ${iter}`
          flat.push({ ...loopStep, name, _loopVar: varName, _loopVal: String(iter) })
        }
      }
    } else {
      flat.push(step)
    }
  }
  return flat
}

// ── Flow parsing ──────────────────────────────────────────────────────────────

const KNOWN_FILESYSTEM_COMMANDS = new Set(['mkdir', 'write', 'copy', 'move', 'read', 'echo', 'run'])

function detectCommand(step) {
  for (const key of Object.keys(step)) {
    if (key.startsWith('kit.') || KNOWN_FILESYSTEM_COMMANDS.has(key)) {
      return key
    }
  }
  return null
}

function paramsToFlags(p, exclude) {
  return Object.entries(p)
    .filter(([key]) => !exclude.includes(key))
    .flatMap(([key, val]) => {
      if (val === true || val === 'true') {
        return [`--${key}`]
      }
      if (val === false || val === 'false') {
        return [`--${key}=false`]
      }
      if (val === '' || val === null || val === undefined) {
        return []
      }
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed)) {
            return parsed.map(v => `--${key}=${v}`)
          }
        } catch { /* not JSON */ }
        return [`--${key}=${val}`]
      }
      if (Array.isArray(val)) {
        return val.map(v => `--${key}=${v}`)
      }
      return [`--${key}=${val}`]
    })
}

function parseFlow(content) {
  const raw = parseYaml(content)
  const varDefs = []
  if (raw.vars && typeof raw.vars === 'object') {
    for (const [name, value] of Object.entries(raw.vars)) {
      const defaultVal = value === '' || value === null || value === undefined
        ? undefined
        : String(value)
      varDefs.push({
        name,
        default: defaultVal,
        isDerived: Boolean(defaultVal?.includes('${')),
      })
    }
  }
  return {
    name: raw.name ?? 'Untitled Flow',
    description: raw.description ?? '',
    varDefs,
    steps: raw.steps ?? [],
  }
}

// ── Kit arg builder ───────────────────────────────────────────────────────────

/**
 * Builds the full CLI args array for a kit.* subcommand.
 *
 * Rules:
 *   - 'args'  → positional argument(s); values starting with ./ or ../ are
 *               resolved relative to the workspace root (local paths).
 *   - 'ref'   → positional argument, always passed raw (OCI references).
 *   - all other keys → --key=value flags, passed exactly as written.
 *               Values starting with ./ or ../ are workspace-resolved.
 *
 * @param {string} subcommand - e.g. 'pull', 'pack', 'unpack'
 * @param {Record<string, unknown>} params - Already-interpolated step params
 * @param {string} root - Workspace root for resolving relative paths
 * @returns {string[]} Args starting with the subcommand, e.g. ['pack', './out', '--tag=repo:v1']
 */
export function buildKitArgs(subcommand, params, root) {
  const toArr = v => v === undefined ? [] : Array.isArray(v) ? v : [v]

  // Resolve a value as a workspace-relative path only when it looks like one.
  // OCI references, boolean flags, and plain strings pass through unchanged.
  const maybeResolve = s => (s.startsWith('./') || s.startsWith('../')) ? tryResolvePath(s, root) : s

  const positionals = [
    ...toArr(params.args).map(a => maybeResolve(String(a))), // local paths are resolved
    ...toArr(params.ref).map(a => String(a)),                 // OCI refs — always raw
  ]

  const flags = paramsToFlags(params, ['args', 'ref']).map(flag => {
    const m = flag.match(/^(--[\w-]+=)(.+)$/)
    if (m) {
      return m[1] + maybeResolve(m[2])
    }
    return flag
  })

  return [subcommand, ...positionals, ...flags]
}

// ── Step execution ────────────────────────────────────────────────────────────

async function executeStep(command, params, vars, root, onProgress) {
  const p = interpolateDeep(params, vars)

  async function runKit(args) {
    const [subcommand, ...rest] = args
    const result = await kitops.kit(subcommand, rest)
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    if (output) {
      onProgress?.(output)
    }
    return output || 'Done'
  }

  switch (command) {
    case 'mkdir': {
      const dirPath = resolvePath(p, root)
      await mkdir(dirPath, { recursive: true })
      return `Created: ${dirPath}`
    }

    case 'write': {
      const dest = resolvePath(p.path, root)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, p.content, 'utf-8')
      return `Wrote: ${dest}`
    }

    case 'copy': {
      const from = resolvePath(p.from, root)
      const to = resolvePath(p.to, root)
      await mkdir(dirname(to), { recursive: true })
      await cp(from, to, { recursive: true, force: true })
      return `Copied: ${from} → ${to}`
    }

    case 'move': {
      const from = resolvePath(p.from, root)
      const to = resolvePath(p.to, root)
      await mkdir(dirname(to), { recursive: true })
      try {
        await rename(from, to)
      } catch {
        await cp(from, to, { recursive: true, force: true })
        await rm(from, { recursive: true, force: true })
      }
      return `Moved: ${from} → ${to}`
    }

    case 'read': {
      const format = p.format ?? 'yaml'
      const sources = Array.isArray(p.source) ? p.source : [p.source]

      if (p.merge && typeof p.merge === 'object') {
        for (const [varName, fieldPath] of Object.entries(p.merge)) {
          const merged = []
          for (const src of sources) {
            const absPath = resolvePath(src, root)
            let content
            try {
              content = await readFile(absPath, 'utf-8')
            } catch {
              continue
            }
            const parsed = format === 'json' ? JSON.parse(content) : parseYaml(content)
            const value = getNestedValue(parsed, fieldPath)
            if (Array.isArray(value)) {
              merged.push(...value.map(String))
            } else if (value != null) {
              merged.push(String(value))
            }
          }
          vars[varName] = JSON.stringify([...new Set(merged)])
        }
        return `Merged ${sources.length} source(s)`
      }

      if (p.into && typeof p.into === 'object') {
        const absPath = resolvePath(sources[0], root)
        const content = await readFile(absPath, 'utf-8')
        for (const [varName, fieldPath] of Object.entries(p.into)) {
          if (format === 'text') {
            vars[varName] = content
          } else {
            const parsed = format === 'json' ? JSON.parse(content) : parseYaml(content)
            const value = getNestedValue(parsed, fieldPath)
            vars[varName] = value != null ? String(value) : ''
          }
        }
        return `Read: ${sources[0]}`
      }

      throw new Error('read step requires either `into` or `merge`')
    }

    case 'echo': {
      return p
    }

    case 'run': {
      // Params can be a plain string (shorthand) or an object { command, dir }.
      const cmd = typeof p === 'string' ? p : p.command
      if (!cmd || typeof cmd !== 'string' || !cmd.trim()) {
        throw new Error('run: command must be a non-empty string')
      }
      // Resolve dir to prevent path traversal — defaults to the workspace root.
      const cwd = p.dir ? resolvePath(p.dir, root) : root
      return new Promise((resolve, reject) => {
        // shell: true is intentional — `run` is a developer-authored command,
        // equivalent to writing a shell step in a Makefile. The command string
        // comes from a YAML file the developer controls, not from untrusted input.
        const child = spawn(cmd, { cwd, shell: true, stdio: 'pipe' })
        let out = ''
        child.stdout.on('data', chunk => {
          const line = chunk.toString().trimEnd()
          if (line) {
            out += line + '\n'; onProgress?.(line) 
          }
        })
        child.stderr.on('data', chunk => {
          const line = chunk.toString().trimEnd()
          if (line) {
            out += line + '\n'; onProgress?.(line) 
          }
        })
        child.on('error', err => reject(new Error(`Failed to start process: ${err.message}`)))
        child.on('close', code => {
          if (code === 0) {
            resolve(out.trim() || 'Done')
          } else {
            reject(new Error(`Process exited with code ${code}`))
          }
        })
      })
    }

    default: {
      if (!command.startsWith('kit.')) {
        throw new Error(`Unknown command: ${command}`)
      }
      return runKit(buildKitArgs(command.slice(4), p, root))
    }
  }
}

// ── Variable collection ───────────────────────────────────────────────────────

async function collectVars(varDefs, cliVars, jsonMode) {
  // Build initial vars from non-derived defaults
  const vars = {}
  for (const def of varDefs) {
    if (!def.isDerived) {
      vars[def.name] = def.default ?? ''
    }
  }
  // First pass: resolve derived defaults against the base vars
  for (const def of varDefs) {
    if (def.isDerived && def.default) {
      vars[def.name] = interpolate(def.default, vars)
    }
  }

  // Apply any vars supplied via --<name>=<value> flags
  Object.assign(vars, cliVars)

  if (!jsonMode) {
    // Interactive prompts for still-missing vars
    const required = varDefs.filter(v => v.default === undefined && !vars[v.name]?.trim())
    const optional = varDefs.filter(v => v.default !== undefined && !v.isDerived && !(v.name in cliVars))

    if (required.length > 0 || optional.length > 0) {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const ask = q => new Promise(r => rl.question(q, r))

      if (required.length > 0) {
        console.log(c(ansi.cyan, '\nRequired variables:'))
        for (const def of required) {
          let val = ''
          while (!val.trim()) {
            val = await ask(`  ${c(ansi.bold, def.name)}: `)
          }
          vars[def.name] = val.trim()
        }
      }

      if (optional.length > 0) {
        console.log(c(ansi.cyan, '\nOptional variables (Enter to keep default):'))
        for (const def of optional) {
          const val = await ask(`  ${c(ansi.bold, def.name)} [${def.default}]: `)
          if (val.trim()) {
            vars[def.name] = val.trim()
          }
        }
      }

      rl.close()
    }
  } else {
    // Non-interactive: all required vars must be present
    const missing = varDefs.filter(v => v.default === undefined && !vars[v.name]?.trim())
    if (missing.length > 0) {
      for (const def of missing) {
        process.stdout.write(JSON.stringify({ type: 'error', message: `Required variable not provided: ${def.name}` }) + '\n')
      }
      process.exit(1)
    }
  }

  // Second pass: re-resolve derived vars now that all inputs are known
  for (const def of varDefs) {
    if (def.isDerived && def.default) {
      vars[def.name] = interpolate(def.default, vars)
    }
  }

  return vars
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Writes an error message and exits with code 1. Never returns. */
function fatal(msg, jsonMode) {
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ type: 'error', message: msg }) + '\n')
  } else {
    console.error(`Error: ${msg}`)
  }
  process.exit(1)
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function main() {
  // parse arguments
  let filePath = null
  let jsonMode = false
  const cliVars = {}

  for (const arg of process.argv.slice(2)) {
    if (arg === '--json') {
      jsonMode = true
    } else if (arg.startsWith('--') && arg.includes('=')) {
      const rest = arg.slice(2)
      const eqIdx = rest.indexOf('=')
      cliVars[rest.slice(0, eqIdx)] = rest.slice(eqIdx + 1)
    } else if (!arg.startsWith('--')) {
      filePath = arg
    }
  }

  if (!filePath) {
    const msg = 'Usage: kitflow <path/to/flow.yaml> [--json] [--var=key=value ...]'
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ type: 'error', message: msg }) + '\n')
    } else {
      console.error(msg)
    }
    process.exit(1)
  }

  // load and parse
  let content
  try {
    content = await readFile(filePath, 'utf-8')
  } catch (e) {
    fatal(`Cannot read "${filePath}": ${e.message}`, jsonMode)
  }

  let flow
  try {
    flow = parseFlow(content)
  } catch (e) {
    fatal(`Failed to parse flow: ${e.message}`, jsonMode)
  }

  const workspaceRoot = dirname(resolve(filePath))

  if (!jsonMode) {
    console.log(c(ansi.bold, `\n${flow.name}`))
    if (flow.description) {
      console.log(c(ansi.gray, flow.description.trim()))
    }
    console.log(c(ansi.gray, `workspace: ${workspaceRoot}`))
  }

  // collect variables
  const vars = await collectVars(flow.varDefs, cliVars, jsonMode)
  const flatSteps = expandSteps(flow.steps, vars)

  if (!jsonMode) {
    console.log(c(ansi.gray, `${flatSteps.length} step${flatSteps.length !== 1 ? 's' : ''}`))
    console.log()
  }

  // run steps
  let exitCode = 0

  for (let i = 0; i < flatSteps.length; i++) {
    const step = flatSteps[i]
    const name = step.name ?? `Step ${i + 1}`

    if (step._loopVar) {
      vars[step._loopVar] = step._loopVal
    }

    const command = detectCommand(step)

    if (!command) {
      if (jsonMode) {
        process.stdout.write(JSON.stringify({ type: 'step-done', index: i, status: 'error', error: 'No recognized command found in step' }) + '\n')
      } else {
        console.log(`  ${c(ansi.red, '✗')} ${name}`)
        console.error('     No recognized command found in step')
      }
      exitCode = 1
      for (let j = i + 1; j < flatSteps.length; j++) {
        const skipName = flatSteps[j].name ?? `Step ${j + 1}`
        if (jsonMode) {
          process.stdout.write(JSON.stringify({ type: 'step-done', index: j, status: 'skipped' }) + '\n')
        } else {
          console.log(`  ${c(ansi.gray, '—')} ${c(ansi.dim, skipName)} ${c(ansi.gray, '(skipped)')}`)
        }
      }
      break
    }

    // Evaluate optional `when` condition
    if (step.when !== undefined) {
      const condition = interpolate(String(step.when), vars).trim()
      if (condition === 'false' || condition === '0' || condition === '') {
        if (jsonMode) {
          process.stdout.write(JSON.stringify({ type: 'step-done', index: i, status: 'skipped' }) + '\n')
        } else {
          console.log(`  ${c(ansi.gray, '—')} ${c(ansi.dim, name)} ${c(ansi.gray, '(skipped)')}`)
        }
        continue
      }
    }

    if (jsonMode) {
      process.stdout.write(JSON.stringify({ type: 'step-start', index: i, name, command, params: interpolateDeep(step[command] ?? {}, vars) }) + '\n')
    } else if (isTTY) {
      process.stdout.write(`  ${c(ansi.yellow, '●')} ${name}…`)
    }

    const start = Date.now()

    try {
      const output = await executeStep(
        command,
        step[command],
        vars,
        workspaceRoot,
        (line) => {
          if (jsonMode) {
            process.stdout.write(JSON.stringify({ type: 'step-output', index: i, line }) + '\n')
          } else if (isTTY) {
            process.stdout.write(`\r  ${c(ansi.yellow, '●')} ${name}… ${c(ansi.gray, line.split('\n').at(-1) ?? '')}          `)
          }
        },
      )

      const duration = Date.now() - start

      if (jsonMode) {
        process.stdout.write(JSON.stringify({ type: 'step-done', index: i, status: 'success', duration, output }) + '\n')
      } else {
        if (isTTY) {
          process.stdout.write('\r')
        }
        console.log(`  ${c(ansi.green, '✓')} ${name} ${c(ansi.gray, `(${(duration / 1000).toFixed(1)}s)`)}`)
        if (output && output !== 'Done') {
          for (const line of output.trim().split('\n')) {
            console.log(`     ${c(ansi.gray, line)}`)
          }
        }
      }
    } catch (e) {
      const duration = Date.now() - start

      if (jsonMode) {
        const error = e instanceof Error ? e.message : String(e)
        process.stdout.write(JSON.stringify({ type: 'step-done', index: i, status: 'error', duration, error }) + '\n')
      } else {
        const errorMsg = e instanceof Error ? e.message : String(e)
        if (isTTY) {
          process.stdout.write('\r')
        }
        console.log(`  ${c(ansi.red, '✗')} ${name} ${c(ansi.gray, `(${(duration / 1000).toFixed(1)}s)`)}`)
        console.error(`     ${c(ansi.red, errorMsg)}`)
      }

      for (let j = i + 1; j < flatSteps.length; j++) {
        const skipName = flatSteps[j].name ?? `Step ${j + 1}`
        if (jsonMode) {
          process.stdout.write(JSON.stringify({ type: 'step-done', index: j, status: 'skipped' }) + '\n')
        } else {
          console.log(`  ${c(ansi.gray, '—')} ${c(ansi.dim, skipName)} ${c(ansi.gray, '(skipped)')}`)
        }
      }

      exitCode = 1
      break
    }
  }

  if (!jsonMode) {
    console.log()
    if (exitCode === 0) {
      console.log(c(ansi.green, '✓ Flow completed successfully'))
    } else {
      console.log(c(ansi.red, '✗ Flow failed'))
    }
  }

  process.exit(exitCode)
}

// Only execute when run directly (not when imported as a module in tests)
if (resolve(process.argv[1] ?? '') === __filename) {
  main().catch(e => {
    console.error('Fatal:', e.message)
    process.exit(1)
  })
}
