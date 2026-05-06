---
title: CLI Reference
description: Run KitFlow files from the terminal without the desktop app.
outline: deep
---

# CLI Reference

The `kitflow` CLI runs flow files directly from the terminal. It is useful for CI/CD pipelines, scripting, and testing flows without the desktop UI.

## Usage

```
kitflow <path/to/flow.yaml> [--json] [--<var>=<value> ...]
```

## Arguments

| Argument | Description |
|---|---|
| `<path/to/flow.yaml>` | Path to the KitFlow YAML file to run. Required. |
| `--json` | Emit newline-delimited JSON events instead of human-readable output. Used by the desktop app's IPC layer and suitable for machine consumption. |
| `--<var>=<value>` | Pre-supply a variable value. Repeat for multiple variables. Variable names must match keys declared in `vars`. |

## Interactive mode (default)

Without `--json`, the CLI runs in interactive mode:

1. **Displays** the flow name, description, and workspace directory.
2. **Prompts** for any required variables (empty default) that were not supplied via `--<var>` flags.
3. **Prompts** for optional variables, showing the default in brackets — press Enter to accept.
4. **Runs** steps sequentially, printing each step name with a spinner, then a checkmark or cross when done.
5. **Exits** with code `0` on success, `1` if any step failed.

```
$ kitflow ./compare-versions.yaml

compare-versions
Pulls two versions of the same modelkit side by side...
workspace: /Users/me/flows

Required variables:
  ref_a: jozu.ml/myorg/model:v1.0
  ref_b: jozu.ml/myorg/model:v2.0

Optional variables (Enter to keep default):
  output_dir [./comparison]:

3 steps

  ✓ Pull version A (4.2s)
  ✓ Pull version B (3.8s)
  ✓ Diff A vs B (0.3s)

✓ Flow completed successfully
```

## Pre-supplying variables

Pass `--<var>=<value>` to skip interactive prompts for specific variables:

```sh
kitflow ./compare-versions.yaml \
  --ref_a=jozu.ml/myorg/model:v1.0 \
  --ref_b=jozu.ml/myorg/model:v2.0
```

If all required variables are provided via flags, the interactive prompt is skipped entirely.

```sh
kitflow ./validate-and-promote.yaml \
  --candidate_ref=jozu.ml/myorg/model:rc1 \
  --stable_ref=jozu.ml/myorg/model:stable \
  --validate_script=./scripts/validate.sh
```

## Non-interactive (JSON) mode

Pass `--json` to emit newline-delimited JSON events. This is the protocol used by the desktop app internally, and can be consumed by CI systems or custom tooling.

```sh
kitflow ./my-flow.yaml --json --model_ref=jozu.ml/myorg/model:v1
```

In `--json` mode:

- All required variables must be provided via `--<var>` flags. Missing required variables cause an error event and exit code `1`.
- No interactive prompts are shown.
- One JSON object per line is written to stdout.

### JSON event types

#### `step-start`

Emitted when a step begins executing.

```json
{"type":"step-start","index":0,"name":"Pull modelkit","command":"kit.pull","params":{"path":"jozu.ml/myorg/model:v1"}}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"step-start"` | Event type identifier |
| `index` | number | Zero-based step index |
| `name` | string | Resolved step name (after variable interpolation) |
| `command` | string | Command key, e.g. `kit.pull`, `write`, `for` |
| `params` | object | Interpolated parameters passed to the command |

#### `step-output`

Emitted for each line of output from a running step.

```json
{"type":"step-output","index":0,"line":"Pulling jozu.ml/myorg/model:v1..."}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"step-output"` | Event type identifier |
| `index` | number | Zero-based step index |
| `line` | string | One line of stdout or stderr output |

#### `step-done`

Emitted when a step finishes (success, error, or skipped).

```json
{"type":"step-done","index":0,"status":"success","duration":4218,"output":"Done"}
```

```json
{"type":"step-done","index":1,"status":"error","duration":312,"error":"Process exited with code 1"}
```

```json
{"type":"step-done","index":2,"status":"skipped"}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"step-done"` | Event type identifier |
| `index` | number | Zero-based step index |
| `status` | `"success"` \| `"error"` \| `"skipped"` | Final status of the step |
| `duration` | number | Elapsed milliseconds (omitted for skipped) |
| `output` | string | Final output string (omitted if step emitted `step-output` events) |
| `error` | string | Error message (only present when `status` is `"error"`) |

#### `error`

Emitted for process-level errors — unexpected crashes or missing required variables.

```json
{"type":"error","message":"Required variable not provided: model_ref"}
```

### Consuming JSON output in a shell script

```sh
kitflow ./my-flow.yaml --json --model_ref=jozu.ml/myorg/model:v1 | while IFS= read -r line; do
  type=$(echo "$line" | jq -r '.type')
  if [ "$type" = "step-done" ]; then
    status=$(echo "$line" | jq -r '.status')
    name=$(echo "$line" | jq -r '.name // "unknown"')
    echo "Step finished: $name — $status"
  fi
done
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | All steps completed successfully |
| `1` | One or more steps failed, or a required variable was not provided |

## CI/CD integration

### GitHub Actions

```yaml
- name: Run KitFlow
  run: |
    kitflow ./flows/validate-and-promote.yaml \
      --candidate_ref=${{ env.CANDIDATE_REF }} \
      --stable_ref=${{ env.STABLE_REF }}
```

### Shell script with JSON parsing

```sh
#!/bin/bash
set -euo pipefail

kitflow ./flows/dataset-publish.yaml \
  --json \
  --repository=jozu.ml/myorg/my-dataset \
  --tag=v$(date +%Y%m%d) \
  | jq -c 'select(.type == "step-done" and .status == "error") | .error' \
  | while read -r err; do
      echo "ERROR: $err" >&2
    done
```
