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

export interface ValidationError {
  /** 1-based line number in the source YAML. */
  line: number
  message: string
}

function offsetToLine(source: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++
    }
  }
  return line
}

function nodeOffset(node: Node | null | undefined): number {
  if (!node) {
    return 0
  }
  const r = node.range
  return Array.isArray(r) ? (r[0] ?? 0) : 0
}

export function validateKitFlowYaml(source: string): ValidationError[] {
  const errors: ValidationError[] = []

  let doc: Document
  try {
    doc = parseDocument(source, { keepSourceTokens: true })
  } catch {
    return errors
  }

  const root = doc.contents
  if (!root || root.toJSON == null) {
    return errors
  }

  const rootMap = root as YAMLMap
  const stepsNode = rootMap.get('steps', true) as YAMLSeq | null
  if (!stepsNode?.items) {
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

      const commandName = key.slice(4)
      const keyLine = offsetToLine(source, nodeOffset(keyNode))

      const commandSchema = (schema.commands as Record<string, { flags: Record<string, string> }>)[commandName]
      if (!commandSchema) {
        const valid = Object.keys(schema.commands).sort().join(', ')
        errors.push({ line: keyLine, message: `Unknown kit command 'kit.${commandName}'. Valid commands: ${valid}` })
        continue
      }

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

        if (commandSchema.positionals.includes(paramKey)) {
          continue
        }

        // Accept both dash-case and camelCase — kitops-ts normalizes them
        const normalizedKey = toCamelCase(paramKey)
        if (!(normalizedKey in commandSchema.flags)) {
          const validFlags = Object.keys(commandSchema.flags)
          const hint = validFlags.length ? ` Valid flags: ${validFlags.join(', ')}` : ' This command accepts no flags.'
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
