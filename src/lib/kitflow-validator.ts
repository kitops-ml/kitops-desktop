/**
 * Validates a KitFlow YAML document against the @kitops/kitops-ts API surface.
 *
 * The schema (src/generated/kitops-schema.json) is generated at install time by
 * scripts/generate-kitops-schema.mjs — it is always in sync with the installed
 * version of kitops-ts, so no whitelist is needed here.
 */

import type { Document, Node, Pair, YAMLMap, YAMLSeq } from 'yaml'
import { parseDocument } from 'yaml'

import schema from '../generated/kitops-schema.json'
import { toCamelCase } from '../utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ValidationError {
  /** 1-based line number in the source YAML (points to the offending key). */
  line: number
  message: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Keys inside a kit.* step value that are always valid regardless of the
 * command's declared flags — they map to positional CLI arguments, not flags.
 */
const POSITIONAL_KEYS = new Set(['ref', 'args'])

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Convert a character offset to a 1-based line number. */
function offsetToLine(source: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++
    }
  }
  return line
}

/** Return the range start of a YAML AST node, or 0 if unavailable. */
function nodeOffset(node: Node | null | undefined): number {
  if (!node) {
    return 0
  }
  const r = node.range
  return Array.isArray(r) ? (r[0] ?? 0) : 0
}

// ── Validator ──────────────────────────────────────────────────────────────────

/**
 * Validate a KitFlow YAML string.
 *
 * Returns an array of errors (empty = valid). Each error carries the 1-based
 * line number of the offending key so the UI can highlight it.
 */
export function validateKitFlowYaml(source: string): ValidationError[] {
  const errors: ValidationError[] = []

  let doc: Document
  try {
    doc = parseDocument(source, { keepSourceTokens: true })
  } catch {
    // YAML parse errors are reported separately as parseError; skip here.
    return errors
  }

  const root = doc.contents
  if (!root || root.toJSON == null) {
    return errors
  }

  const rootMap = root as YAMLMap
  const stepsNode = rootMap.get('steps', true) as YAMLSeq | null
  if (!stepsNode || !stepsNode.items) {
    return errors
  }

  for (const stepNode of stepsNode.items) {
    if (!stepNode || typeof stepNode !== 'object') {
      continue
    }

    const stepMap = stepNode as YAMLMap
    const stepItems = stepMap.items as Pair[]

    for (const pair of stepItems) {
      const keyNode = pair.key as Node
      const key = String(keyNode?.toJSON?.() ?? keyNode)

      if (!key.startsWith('kit.')) {
        continue
      }

      const commandName = key.slice(4) // 'kit.pull' → 'pull'
      const keyLine = offsetToLine(source, nodeOffset(keyNode))

      // 1. Validate the command name exists in kitops-ts
      const commandSchema = (schema.commands as Record<string, { flags: Record<string, string> }>)[commandName]
      if (!commandSchema) {
        const valid = Object.keys(schema.commands).sort().join(', ')
        errors.push({
          line: keyLine,
          message: `Unknown kit command 'kit.${commandName}'. Valid commands: ${valid}`,
        })
        continue
      }

      // 2. Validate the flags (non-positional keys) on the step params
      const paramsNode = pair.value
      if (!paramsNode || typeof paramsNode !== 'object') {
        continue
      }

      const paramsMap = paramsNode as YAMLMap
      if (!paramsMap.items) {
        continue
      }

      for (const paramPair of paramsMap.items as Pair[]) {
        const paramKeyNode = paramPair.key as Node
        const paramKey = String(paramKeyNode?.toJSON?.() ?? paramKeyNode)

        // 'ref' and 'args' are always valid — they map to positional CLI args.
        // Named positionals from the function signature (e.g. 'registry', 'username') are also valid.
        if (POSITIONAL_KEYS.has(paramKey) || commandSchema.positionals.includes(paramKey)) {
          continue
        }

        // Accept both dash-case and camelCase — kitops-ts normalizes them
        const normalizedKey = toCamelCase(paramKey)
        if (!(normalizedKey in commandSchema.flags)) {
          const validFlags = Object.keys(commandSchema.flags)
          const hint = validFlags.length
            ? ` Valid flags: ${validFlags.join(', ')}`
            : ' This command accepts no flags.'
          errors.push({
            line: offsetToLine(source, nodeOffset(paramKeyNode)),
            message: `Unknown flag '${paramKey}' for kit.${commandName}.${hint}`,
          })
        }
      }
    }
  }

  return errors
}
