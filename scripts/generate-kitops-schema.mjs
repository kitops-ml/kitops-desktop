/**
 * Generates src/generated/kitops-schema.json by parsing the @kitops/kitops-ts
 * .d.ts files. Run automatically via the "postinstall" npm script so the schema
 * always reflects the installed version of kitops-ts without any manual upkeep.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const kitopsDistRoot = resolve(root, 'node_modules/@kitops/kitops-ts/dist')

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Split a comma-separated parameter list, respecting angle-bracket nesting. */
function splitParams(paramsStr) {
  const parts = []
  let depth = 0
  let current = ''
  for (const char of paramsStr) {
    if (char === '<') depth++
    else if (char === '>') depth--
    else if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/** Parse a single parameter string into { name, optional, type }. */
function parseParam(raw) {
  // Matches: name?: Type  or  name: Type
  const m = /^(\w+)(\?)?\s*:\s*(.+)$/.exec(raw.trim())
  if (!m) return null
  return { name: m[1], optional: Boolean(m[2]), type: m[3].trim() }
}

/** Collapse a TypeScript type to a simple JSON-friendly primitive. */
function collapseType(t) {
  if (t === 'boolean') return 'boolean'
  if (t === 'number') return 'number'
  // String literal unions like 'table' | 'json' → 'string'
  return 'string'
}

// ── Step 1: Parse all *Flags types from types/commands.d.ts ───────────────────

const commandsTypesContent = readFileSync(
  resolve(kitopsDistRoot, 'types/commands.d.ts'),
  'utf8',
)

/** Map of flags type name → { propName: 'boolean' | 'string' | 'number' } */
const flagsTypes = {}

const flagsTypeRegex = /export type (\w+Flags)\s*=\s*\{([^}]+)\}/g
let m

while ((m = flagsTypeRegex.exec(commandsTypesContent)) !== null) {
  const typeName = m[1]
  const body = m[2]
  const props = {}

  const propRegex = /\s+(\w+)\s*\??\s*:\s*([^;]+);/g
  let pm
  while ((pm = propRegex.exec(body)) !== null) {
    props[pm[1]] = collapseType(pm[2].trim())
  }

  flagsTypes[typeName] = props
}

// ── Step 2: Parse the valid KitCommand union from types/kitops.d.ts ───────────

const kitopsTypesContent = readFileSync(
  resolve(kitopsDistRoot, 'types/kitops.d.ts'),
  'utf8',
)

const kitCommandMatch = /export type KitCommand\s*=\s*([^;]+);/.exec(kitopsTypesContent)
const validCommands = new Set(
  kitCommandMatch
    ? kitCommandMatch[1].match(/'(\w+)'/g)?.map(s => s.slice(1, -1)) ?? []
    : [],
)

// ── Step 3: Parse each commands/*.d.ts for exported function signatures ───────

const commandsDtsDir = resolve(kitopsDistRoot, 'commands')
const dtsFiles = readdirSync(commandsDtsDir)
  .filter(f => f.endsWith('.d.ts') && f !== 'index.d.ts' && f !== 'kit.d.ts')

/** Final schema: { [commandName]: { positionals: string[], flags: Record<string, string> } } */
const commands = {}

for (const file of dtsFiles) {
  const content = readFileSync(resolve(commandsDtsDir, file), 'utf8')

  const funcRegex = /export declare function (\w+)\(([^)]*)\)/g
  let funcMatch

  while ((funcMatch = funcRegex.exec(content)) !== null) {
    const funcName = funcMatch[1]

    // Only include commands that appear in the KitCommand union (the public CLI surface).
    // loginUnsafe, removeAll, etc. are excluded this way.
    if (!validCommands.has(funcName)) continue

    const params = splitParams(funcMatch[2]).map(parseParam).filter(Boolean)

    // The flags parameter is the last optional parameter whose type ends with
    // "Flags" or is an Omit<...Flags...> expression.
    const flagsParam = params.findLast(
      p => p.optional && (p.type.endsWith('Flags') || p.type.startsWith('Omit<')),
    )
    const positionals = params
      .filter(p => p !== flagsParam)
      .map(p => p.name)

    let flags = {}
    if (flagsParam) {
      if (flagsParam.type.startsWith('Omit<')) {
        // e.g. Omit<RemoveFlags, 'all'> → RemoveFlags minus 'all'
        const omitMatch = /Omit<(\w+Flags),([^>]+)>/.exec(flagsParam.type)
        if (omitMatch) {
          const baseFlags = flagsTypes[omitMatch[1]] ?? {}
          const excluded = new Set(omitMatch[2].match(/'(\w+)'/g)?.map(s => s.slice(1, -1)) ?? [])
          flags = Object.fromEntries(
            Object.entries(baseFlags).filter(([k]) => !excluded.has(k)),
          )
        }
      } else {
        flags = flagsTypes[flagsParam.type] ?? {}
      }
    }

    commands[funcName] = { positionals, flags }
  }
}

// ── Step 4: Write output ───────────────────────────────────────────────────────

const outDir = resolve(root, 'src/generated')
mkdirSync(outDir, { recursive: true })
writeFileSync(
  resolve(outDir, 'kitops-schema.json'),
  JSON.stringify({ commands }, null, 2) + '\n',
)

const names = Object.keys(commands).sort()
console.log(`kitops-schema: ${names.length} commands extracted from @kitops/kitops-ts`)
console.log(names.map(n => `  kit.${n}  [${Object.keys(commands[n].flags).join(', ') || 'no flags'}]`).join('\n'))
