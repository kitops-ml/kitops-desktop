---
title: Technical Details
description: KitFlow architecture, event protocol, variable resolution phases, and path security model.
outline: deep
---

# Technical Details

This page is for developers extending KitFlow, building integrations, or wanting a deeper understanding of how the system works.

## Architecture overview

KitFlow is split across three layers that communicate via structured JSON events:

```
┌─────────────────────────────────────────────────┐
│  KitOps Desktop (Vue/TypeScript)                │
│  useKitFlow composable — state, UI, library     │
└─────────────────┬───────────────────────────────┘
                  │ Electron IPC (kitflow.run)
┌─────────────────▼───────────────────────────────┐
│  Electron main process                          │
│  electron/ipc/kitflow.js — spawns subprocess   │
└─────────────────┬───────────────────────────────┘
                  │ subprocess stdio (JSON events)
┌─────────────────▼───────────────────────────────┐
│  bin/kitflow.js — Node.js CLI runner            │
│  Parses YAML, resolves vars, executes steps     │
└─────────────────────────────────────────────────┘
```

### Layer responsibilities

**`bin/kitflow.js`** (CLI runner)
- Parses the YAML flow definition
- Collects variables interactively or from CLI flags
- Executes steps sequentially
- Emits JSON events to stdout (`--json` mode) or ANSI-colored text (interactive)
- Calls the `kitops-ts` Node.js API for `kit.*` commands
- Calls Node.js `fs` APIs for filesystem commands
- Uses `child_process.spawn` for `run` commands

**`electron/ipc/kitflow.js`** (IPC bridge)
- Spawns `bin/kitflow.js` as a subprocess with `--json` and pre-supplied variables
- Forwards JSON events from the subprocess's stdout to the renderer via IPC
- Forwards stderr as `error` events
- Exposes `run`, `cancel`, `onEvent`, and `removeEventListener` to the renderer

**`src/composables/useKitFlow.ts`** (Vue composable)
- Holds all reactive state: flow definition, step states, variables, library
- Parses YAML in the renderer for load-time validation and UI preview
- Handles JSON events from the IPC bridge to update step states reactively
- Manages the flow library in `localStorage`

## Variable resolution phases

Variable values go through two resolution passes before steps execute:

### Pass 1 — at load time

Runs when the flow file is read and parsed (before the user has filled in any values).

1. Non-derived variables are initialized to their defaults (or empty string for required).
2. Derived variables are evaluated against the non-derived defaults.

This gives the UI enough information to render the variable panel and show derived variable previews, even before the user types anything.

### Pass 2 — pre-execution

Runs immediately before the flow starts executing.

1. Non-derived variables are read from the user's inputs (or CLI flags in non-interactive mode).
2. Derived variables are re-evaluated with the now-complete non-derived values.
3. The final resolved variable map is passed to the CLI runner.

Only non-derived variables are sent to the subprocess — derived variables are re-evaluated by the CLI runner using the same interpolation logic.

### Live re-derivation (UI only)

In the desktop UI, derived variables are watched reactively. Whenever a non-derived variable changes (the user types in an input field), all non-dirty derived variables are immediately re-evaluated and their displayed values update in real time.

A derived variable is considered "dirty" if the user has manually edited it. Dirty derived variables stop receiving automatic updates until the flow is reset (`reset()` or reload).

## Step execution model

Steps execute sequentially in the CLI runner. For each step:

1. Emit `step-start` event with the resolved step name and command.
2. Evaluate the optional `when` condition; emit `step-done` with `status: "skipped"` if falsy.
3. Interpolate all step parameters against the current variable map.
4. Execute the command handler.
5. Stream output lines as `step-output` events.
6. Emit `step-done` with `status: "success"` and the final output string.
7. On error: emit `step-done` with `status: "error"` and an error message. Emit `step-done` with `status: "skipped"` for all remaining steps. Exit with code `1`.

`for` steps run all their iterations as a single parent step. The parent emits `step-start` once, then `step-output` events for each inner step's output across all iterations, then `step-done` once.

## For loop execution

For loops are **not** expanded into flat steps before execution. The outer step runs as a single unit:

```
for step (index 3)
  iteration 1:
    inner step A → step-output{index:3, line:"..."}
    inner step B → step-output{index:3, line:"..."}
  iteration 2:
    inner step A → step-output{index:3, line:"..."}
    inner step B → step-output{index:3, line:"..."}
step-done{index:3, status:"success"}
```

All output lines from all iterations accumulate under step index 3 in the UI.

The loop variable is mutated directly in the shared variable map for each iteration. After the loop, the variable retains the value from the last iteration.

## JSON event protocol

Full schema for all events emitted by the CLI in `--json` mode:

```typescript
type StepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

interface StepStartEvent {
  type: 'step-start'
  index: number        // zero-based step index
  name: string         // resolved step name
  command: string      // e.g. 'kit.pull', 'write', 'for', 'run'
  params?: unknown     // interpolated parameters
}

interface StepOutputEvent {
  type: 'step-output'
  index: number
  line: string         // one line of stdout/stderr
}

interface StepDoneEvent {
  type: 'step-done'
  index: number
  status: 'success' | 'error' | 'skipped'
  duration?: number    // elapsed milliseconds; omitted for skipped
  output?: string      // final output; omitted if step-output events were emitted
  error?: string       // error message; only present when status is 'error'
}

interface FlowErrorEvent {
  type: 'error'
  message: string      // unexpected crash or missing required variable
}

type KitflowEvent = StepStartEvent | StepOutputEvent | StepDoneEvent | FlowErrorEvent
```

Events are written one per line to stdout as compact JSON. The consumer must buffer lines and parse each as a separate JSON object. Events are never split across lines.

## Path security model

All filesystem paths in KitFlow are sandbox-restricted to the workspace root:

1. **Absolute paths are rejected** — any path starting with `/` (Unix) or a drive letter (Windows) throws an error immediately.
2. **Traversal attacks are rejected** — paths are resolved with `path.join(root, relativePath)` and then checked to ensure the result starts with the workspace root. If it does not (because of `../` components that escape the root), an error is thrown.
3. **Named parameters are conditionally resolved** — only values starting with `./` or `../` in `kit.*` step parameters (e.g., `path`, `dir`, `source`) are treated as filesystem paths and resolved against the workspace root. Other values pass through unchanged, so OCI references like `jozu.ml/org/model:latest` work correctly.

The workspace root is always `dirname(path.resolve(flowFilePath))` — the directory containing the flow YAML file.

## Kit command execution

`kit.*` commands are executed via the `kitops-ts` Node.js package (`@kitops/kitops-ts`), not by spawning a `kit` subprocess. This means:

- No dependency on `kit` being in the system PATH.
- Output from kit operations comes from the library's return values (stdout and stderr fields), not from a subprocess stream.
- Kit command output is emitted as a single `step-output` event after the operation completes, not streamed progressively.

This is different from `run` commands, which spawn a subprocess and stream output line by line.

## `run` command execution

`run` commands use `child_process.spawn` with `shell: true`. This means:

- The full shell is available: pipes, redirects, glob patterns, variable expansion.
- The command runs in the subprocess's own environment — `PATH` and other env vars come from the shell's initialization, not from KitFlow's variable map.
- stdout and stderr are both captured and forwarded as `step-output` events in real time.
- Non-zero exit codes are treated as step failure.

## Validation

When a flow file is loaded in the desktop UI, the raw YAML is validated against the `kitops-ts` schema by `src/lib/kitflow-validator.ts`. Validation checks:

- All `kit.*` command names are recognized subcommands.
- All flag names for each subcommand are valid (both dash-case and camelCase accepted).

Validation errors include a 1-based line number and a message describing the issue. When errors are found, the UI switches to the raw YAML view and highlights the affected lines.

Validation runs in the renderer (Vue) process, not in the CLI runner. The CLI runner does not validate command schemas — it relies on `kitops-ts` to reject invalid arguments at runtime.

## Library storage

The KitFlow library is persisted in the browser's `localStorage` under the key `kitflows-library` as a JSON array of `ImportedFlow` objects:

```typescript
interface ImportedFlow {
  path: string               // absolute filesystem path to the .yaml file
  name: string               // display name (from YAML or filename)
  description: string        // short description (from YAML)
  importedAt: string         // ISO 8601 timestamp
  lastRunAt: string | null   // ISO 8601 timestamp of most recent run
  lastRunResult: 'success' | 'failed' | null
}
```

The library stores **references** to flow files (absolute paths), not copies of their content. If a flow file is moved or deleted, the library entry becomes stale and loading will fail. There is no background sync — the library is refreshed on demand.

## Session snapshot

The `useKitFlow` composable supports snapshotting and restoring the full session state. This is used when navigating away from the runner and back, preserving step output, variable values, and step expand/collapse state:

```typescript
interface FlowSession {
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
```

`snapshotSession()` captures the current state and `restoreFromSnapshot(session)` restores it. `clearSession()` resets all state.
