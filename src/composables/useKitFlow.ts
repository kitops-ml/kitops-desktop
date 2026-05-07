import { readonly, ref, watch } from 'vue'
import { parse as parseYaml } from 'yaml'

import type { ValidationError } from '@/lib/kitflow-validator'
import { validateKitFlowYaml } from '@/lib/kitflow-validator'

export interface ImportedFlow {
  path: string
  name: string
  description: string
  importedAt: string
  lastRunAt: string | null
  lastRunResult: 'success' | 'failed' | null
}

export interface KitFlowVarDef {
  name: string
  default: string | undefined
  isDerived: boolean
}

export type StepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

export interface StepState {
  index: number
  name: string
  command: string
  status: StepStatus
  output: string
  error: string | null
  duration: number | null
}

export interface KitFlow {
  name: string
  description: string
  varDefs: KitFlowVarDef[]
  steps: RawStep[]
}

interface RawStep {
  name?: string
  [key: string]: unknown
}

export interface FlowSession {
  flow: KitFlow
  rawContent: string
  stepStates: StepState[]
  userVars: Record<string, string>
  dirtyVars: Set<string>
  lastDerived: Record<string, string>
  expandedSteps: Set<number>
  activePane: 'flow' | 'raw'
  parseError: string | null
  validationErrors: ValidationError[]
}

// JSON events emitted by the kitflow binary in --json mode
interface StepStartEvent  { type: 'step-start';  index: number; name: string; command: string; params?: unknown }
interface StepOutputEvent { type: 'step-output'; index: number; line: string }
interface StepDoneEvent   { type: 'step-done';   index: number; status: StepStatus; duration?: number; output?: string; error?: string }
// Forwarded from the process's stderr — unexpected runtime errors (e.g. Node.js crashes)
interface FlowErrorEvent  { type: 'error'; message: string }
type KitflowEvent = StepStartEvent | StepOutputEvent | StepDoneEvent | FlowErrorEvent

const STORAGE_KEY = 'kitflows-library'

function readLibrary(): ImportedFlow[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeLibrary(flows: ImportedFlow[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flows))
}

function buildInitialOutput(command: string, params?: unknown): string {
  if (!command.startsWith('kit.')) {
    return ''
  }
  const sub = command.slice(4)
  let ref = ''
  const flags: string[] = []
  if (typeof params === 'string') {
    ref = params
  } else if (params && typeof params === 'object') {
    const p = params as Record<string, unknown>
    // Positional parameter names match the kitops-ts function signatures
    ref = String(p.path ?? p.source ?? p.directory ?? p.registry ?? p.reference1 ?? '')
  }

  const labels: Record<string, string> = {
    pull: 'Pulling', push: 'Pushing', pack: 'Packing', unpack: 'Unpacking',
    tag: 'Tagging', list: 'Listing', inspect: 'Inspecting',
  }
  const label = labels[sub] ?? `Running kit ${sub}`
  const parts = [ref, ...flags].filter(Boolean).join(' ')
  return parts ? `${label} ${parts}` : `${label}...`
}

function applyFilter(value: string, filterStr: string): string {
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
  if (name === 'after') {
    const idx = value.lastIndexOf(sep)
    return idx >= 0 ? value.slice(idx + sep.length) : value
  }
  if (name === 'before') {
    const idx = value.indexOf(sep)
    return idx >= 0 ? value.slice(0, idx) : value
  }
  return value
}

export function interpolate(value: string, vars: Record<string, string>): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    const [name, ...filterParts] = expr.split('|').map((s: string) => s.trim())
    if (!(name in vars)) {
      return match
    }
    return filterParts.reduce((v: string, f: string) => applyFilter(v, f), vars[name])
  })
}

const KNOWN_FILESYSTEM_COMMANDS = new Set(['mkdir', 'write', 'copy', 'move', 'read', 'echo', 'run'])

function detectCommand(step: RawStep): string | null {
  for (const key of Object.keys(step)) {
    if (key.startsWith('kit.') || KNOWN_FILESYSTEM_COMMANDS.has(key)) {
      return key
    }
  }
  return null
}

function buildStepStates(steps: RawStep[], vars: Record<string, string> = {}): StepState[] {
  return steps.map((step, index) => {
    const rawName = step.name ? String(step.name) : `Step ${index + 1}`
    const name = interpolate(rawName, vars)
    const forDef = step.for
    const isForStep = forDef !== null && forDef !== undefined && typeof forDef === 'object' && !Array.isArray(forDef)
    const command = isForStep ? 'for' : (detectCommand(step) ?? 'unknown')
    return {
      index,
      name,
      command,
      status: 'pending' as StepStatus,
      output: '',
      error: null,
      duration: null,
    }
  })
}

const importedFlows = ref<ImportedFlow[]>(readLibrary())
const running = ref(false)

const flow = ref<KitFlow | null>(null)
const rawContent = ref<string | null>(null)
const stepStates = ref<StepState[]>([])
const userVars = ref<Record<string, string>>({})
const dirtyVars = ref(new Set<string>())
const lastDerived = ref<Record<string, string>>({})
const expandedSteps = ref(new Set<number>())
const activePane = ref<'flow' | 'raw'>('flow')
const parseError = ref<string | null>(null)
const validationErrors = ref<ValidationError[]>([])

// Re-derive expression-based vars on change, skipping ones the user has manually edited
watch(userVars, () => {
  if (!flow.value) {
    return
  }
  for (const def of flow.value.varDefs) {
    if (!def.isDerived || !def.default || dirtyVars.value.has(def.name)) {
      continue
    }
    const derived = interpolate(def.default, userVars.value)
    if (userVars.value[def.name] !== derived) {
      lastDerived.value[def.name] = derived
      userVars.value[def.name] = derived
    }
  }
}, { deep: true })

export function snapshotSession(): FlowSession | null {
  if (!flow.value) {
    return null
  }
  return {
    flow: flow.value,
    rawContent: rawContent.value ?? '',
    stepStates: stepStates.value.map(s => ({ ...s })),
    userVars: { ...userVars.value },
    dirtyVars: new Set(dirtyVars.value),
    lastDerived: { ...lastDerived.value },
    expandedSteps: new Set(expandedSteps.value),
    activePane: activePane.value,
    parseError: parseError.value,
    validationErrors: [...validationErrors.value],
  }
}

export function restoreFromSnapshot(session: FlowSession): void {
  flow.value = session.flow
  rawContent.value = session.rawContent
  stepStates.value = session.stepStates.map(s => ({ ...s }))
  userVars.value = { ...session.userVars }
  dirtyVars.value = new Set(session.dirtyVars)
  lastDerived.value = { ...session.lastDerived }
  expandedSteps.value = new Set(session.expandedSteps)
  activePane.value = session.activePane
  parseError.value = session.parseError
  validationErrors.value = [...(session.validationErrors ?? [])]
}

export function clearSession(): void {
  flow.value = null
  rawContent.value = null
  stepStates.value = []
  userVars.value = {}
  dirtyVars.value = new Set()
  lastDerived.value = {}
  expandedSteps.value = new Set()
  activePane.value = 'flow'
  parseError.value = null
  validationErrors.value = []
}

export function initUserVars(): void {
  if (!flow.value) {
    return
  }
  userVars.value = {}
  dirtyVars.value = new Set()
  lastDerived.value = {}
  // Two passes: non-derived first so derived expressions can reference them
  for (const v of flow.value.varDefs) {
    if (!v.isDerived) {
      userVars.value[v.name] = v.default ?? ''
    }
  }
  for (const v of flow.value.varDefs) {
    if (v.isDerived && v.default) {
      const derived = interpolate(v.default, userVars.value)
      userVars.value[v.name] = derived
      lastDerived.value[v.name] = derived
    }
  }
  // Rebuild step states now that vars are resolved (interpolates step names with final values)
  stepStates.value = buildStepStates(flow.value.steps, userVars.value)
}

export async function loadFlow(flowPath: string): Promise<boolean> {
  parseError.value = null
  validationErrors.value = []
  flow.value = null
  rawContent.value = null
  stepStates.value = []

  const fileResult = await window.kitops.fs.readFile(flowPath)
  if (!fileResult.success) {
    parseError.value = fileResult.error ?? 'Could not read file'
    return false
  }
  rawContent.value = fileResult.content

  let raw: Record<string, unknown>
  try {
    raw = parseYaml(fileResult.content)
  } catch (e) {
    parseError.value = (e as Error).message
    return false
  }

  const varDefs: KitFlowVarDef[] = []
  if (raw.vars && typeof raw.vars === 'object') {
    for (const [name, value] of Object.entries(raw.vars as Record<string, unknown>)) {
      const defaultVal = value === '' || value === null || value === undefined ? undefined : String(value)
      varDefs.push({
        name,
        default: defaultVal,
        isDerived: Boolean(defaultVal?.includes('${')),
      })
    }
  }

  flow.value = {
    name: (raw.name as string) ?? 'Untitled Flow',
    description: (raw.description as string) ?? '',
    varDefs,
    steps: (raw.steps as RawStep[]) ?? [],
  }

  // Resolve defaults so for-loop counts can be evaluated at load time
  const initialVars: Record<string, string> = {}
  for (const def of varDefs) {
    if (!def.isDerived && def.default !== undefined) {
      initialVars[def.name] = def.default
    }
  }
  for (const def of varDefs) {
    if (def.isDerived && def.default) {
      initialVars[def.name] = interpolate(def.default, initialVars)
    }
  }
  stepStates.value = buildStepStates(flow.value.steps, initialVars)

  validationErrors.value = validateKitFlowYaml(fileResult.content)
  // Switch to raw view so the user sees the highlighted errors immediately
  if (validationErrors.value.length > 0) {
    activePane.value = 'raw'
  }

  return true
}

async function importFlow(): Promise<string | null> {
  const result = await window.kitops.dialog.selectFile({
    title: 'Import KitFlow',
    buttonLabel: 'Import',
    filters: [{ name: 'KitFlow YAML', extensions: ['yaml', 'yml'] }],
  })
  if (!result.success || !result.path) {
    return null
  }
  await addToLibrary(result.path)
  return result.path
}

async function addToLibrary(flowPath: string, name?: string, description?: string): Promise<void> {
  if (importedFlows.value.some(f => f.path === flowPath)) {
    return
  }

  let resolvedName = name ?? flowPath.split(/[/\\]/).pop()?.replace(/\.ya?ml$/, '') ?? 'Untitled'
  let resolvedDesc = description ?? ''

  if (name === undefined) {
    const fileResult = await window.kitops.fs.readFile(flowPath)
    if (fileResult.success) {
      try {
        const raw = parseYaml(fileResult.content) as Record<string, unknown>
        if (raw.name) {
          resolvedName = String(raw.name)
        }
        if (raw.description) {
          resolvedDesc = String(raw.description).replace(/\s+/g, ' ').trim()
        }
      } catch {
        // ignore parse errors here since we'll catch them when loading the flow in the UI
      }
    }
  }

  importedFlows.value.unshift({
    path: flowPath,
    name: resolvedName,
    description: resolvedDesc,
    importedAt: new Date().toISOString(),
    lastRunAt: null,
    lastRunResult: null,
  })
  writeLibrary(importedFlows.value)
}

function removeFromLibrary(flowPath: string): void {
  importedFlows.value = importedFlows.value.filter(f => f.path !== flowPath)
  writeLibrary(importedFlows.value)
}

function markDirty(name: string): void {
  if (userVars.value[name] !== lastDerived.value[name]) {
    dirtyVars.value.add(name)
  }
}

async function run(flowPath: string): Promise<void> {
  if (!flow.value || !flowPath || running.value) {
    return
  }

  running.value = true

  const vars: Record<string, string> = {}
  for (const def of flow.value.varDefs) {
    if (!def.isDerived) {
      vars[def.name] = userVars.value[def.name] ?? def.default ?? ''
    }
  }

  window.kitops.kitflow.onEvent((event: KitflowEvent) => {
    switch (event.type) {
      case 'step-start': {
        const state = stepStates.value[event.index]
        if (state) {
          state.status = 'running'
          const initial = buildInitialOutput(event.command, event.params)
          if (initial) {
            state.output = initial
          }
        }
        break
      }
      case 'step-output': {
        const state = stepStates.value[event.index]
        if (state) {
          state.output = state.output ? `${state.output}\n${event.line}` : event.line
        }
        break
      }
      case 'step-done': {
        const state = stepStates.value[event.index]
        if (state) {
          state.status = event.status
          if (event.duration != null) {
            state.duration = event.duration
          }
          if (event.output != null) {
            state.output = event.output
          }
          if (event.error != null) {
            state.error = event.error
          }
        }
        break
      }
      case 'error': {
        const active = stepStates.value.find(s => s.status === 'running')
        if (active) {
          active.status = 'error'
          active.error = event.message
        }
        break
      }
    }
  })

  try {
    await window.kitops.kitflow.run(flowPath, vars)
  } catch {
    // step-done events handle step-level failures; this catches process-level crashes
  } finally {
    for (const state of stepStates.value) {
      if (state.status === 'running' || state.status === 'pending') {
        state.status = 'skipped'
      }
    }
    window.kitops.kitflow.removeEventListener()

    const hasError = stepStates.value.some(s => s.status === 'error')
    const runResult: 'success' | 'failed' = hasError ? 'failed' : 'success'

    const entry = importedFlows.value.find(f => f.path === flowPath)
    if (entry) {
      entry.lastRunAt = new Date().toISOString()
      entry.lastRunResult = runResult
      writeLibrary(importedFlows.value)
    }

    running.value = false
  }
}

function stop(): void {
  window.kitops.kitflow.cancel()
}

function reset(): void {
  if (!flow.value) {
    return
  }
  stepStates.value = buildStepStates(flow.value.steps, userVars.value)
  expandedSteps.value = new Set()
}

export function useKitFlow() {
  return {
    importedFlows: readonly(importedFlows),
    importFlow,
    addToLibrary,
    removeFromLibrary,
    flow: readonly(flow),
    rawContent: readonly(rawContent),
    stepStates,
    userVars,
    dirtyVars,
    lastDerived,
    expandedSteps,
    activePane,
    parseError: readonly(parseError),
    validationErrors: readonly(validationErrors),
    running: readonly(running),
    loadFlow,
    clearSession,
    snapshotSession,
    restoreFromSnapshot,
    initUserVars,
    markDirty,
    run,
    stop,
    reset,
  }
}
