---
title: Syntax Reference
description: Complete YAML schema for KitFlow files — every top-level key and its allowed values.
outline: deep
---

# Syntax Reference

A KitFlow file is a single YAML document. It has four top-level keys: `name`, `description`, `vars`, and `steps`.

```yaml
name: <string>
description: <string>

vars:
  <var_name>: <default_value | "">

steps:
  - <step>
  - <step>
  ...
```

## `name`

**Type:** string  
**Required:** no (defaults to `"Untitled Flow"`)

The display name shown in the KitFlow library and at the top of the runner.

```yaml
name: Publish Dataset to Production
```

Keep names short and descriptive. They appear in the library list alongside the description.

## `description`

**Type:** string (supports YAML block scalars)  
**Required:** no

A human-readable explanation of what the flow does. Shown in the library and at the top of the runner. Multi-line descriptions are encouraged for complex flows.

```yaml
description: >
  Pulls the candidate modelkit, runs validation, re-tags it as a stable
  release, and pushes to the production registry. Requires push access.
```

The `>` YAML folded scalar collapses newlines into spaces. Use `|` for literal newlines.

## `vars`

**Type:** mapping of variable name → default value  
**Required:** no

Declares the variables available throughout the flow. Each entry is a key/value pair:

```yaml
vars:
  model_ref: ""             # required — empty string means no default
  tag: latest               # optional — has a non-empty default
  full_ref: "${model_ref}:${tag}"  # derived — computed from other vars
  output_dir: ./output      # optional with a path default
```

### Variable kinds

| Kind | How to declare | Behavior |
|---|---|---|
| **Required** | Empty string default (`""`) or `null` | User must supply a value before run |
| **Optional** | Non-empty default value | Uses default if user does not override |
| **Derived** | Default contains `${...}` | Re-computed whenever its dependencies change |

See [Variables](./variables.md) for the full interpolation and filter reference.

## `steps`

**Type:** list of step objects  
**Required:** yes (can be an empty list)

An ordered list of steps executed sequentially, top to bottom. Each step is a YAML object with optional `name`, optional `when`, and exactly one command key.

### Step structure

```yaml
steps:
  - name: <string>        # optional display name; supports ${var} interpolation
    when: <expression>    # optional; step is skipped if value is falsy
    <command>: <params>   # exactly one command key per step
```

### Available commands

| Command | Category | Description |
|---|---|---|
| `kit.pull` | Kit CLI | Download a modelkit from a registry |
| `kit.push` | Kit CLI | Upload a modelkit to a registry |
| `kit.pack` | Kit CLI | Create a modelkit from a local directory |
| `kit.unpack` | Kit CLI | Extract modelkit contents to disk |
| `kit.tag` | Kit CLI | Create a new reference pointing to an existing modelkit |
| `kit.diff` | Kit CLI | Compare two modelkits layer by layer |
| `kit.remove` | Kit CLI | Remove a modelkit from local storage |
| `kit.init` | Kit CLI | Initialize a Kitfile from a directory |
| `kit.info` | Kit CLI | Display modelkit metadata |
| `kit.inspect` | Kit CLI | List modelkit layers and sizes |
| `kit.login` | Kit CLI | Authenticate to a registry |
| `kit.logout` | Kit CLI | Remove stored registry credentials |
| `mkdir` | Filesystem | Create a directory (and parents) |
| `write` | Filesystem | Write text content to a file |
| `copy` | Filesystem | Copy files or directories |
| `move` | Filesystem | Move or rename files or directories |
| `read` | Filesystem | Read values from YAML/JSON files into variables |
| `echo` | Filesystem | Output a message |
| `run` | Shell | Execute a shell command |
| `for` | Control flow | Loop over a set of steps N times |

Each command is documented in detail in its own page. Steps also support `when` for conditional execution and `for` for looping — see [Control Flow](./commands-control-flow.md).

> **Note on `kit.*` commands:** These are executed via the `kitops-ts` Node.js library, not by calling a `kit` binary. Only subcommands implemented in `kitops-ts` are available as `kit.*` steps. If a subcommand you need is missing, use a `run` step to call the `kit` binary directly. See [Kit Commands](./commands-kit.md) for details.

### Step name interpolation

Step names can reference variables with `${...}`. The name is resolved once at load time (for display) and again at runtime with the final variable values:

```yaml
steps:
  - name: Pack ${repository}:${tag}
    kit.pack:
      directory: ./workspace
      tag: ${repository}:${tag}
```

### Execution order and failure

Steps run sequentially. If any step exits with an error, all remaining steps are marked **skipped** and the flow stops. There is no retry logic and no parallel execution.

## Full annotated example

```yaml
name: Validate and Promote
description: >
  Runs an optional validation script, then re-tags the candidate modelkit
  as a stable release and pushes to the production registry.

vars:
  candidate_ref: ""             # required — modelkit to promote
  stable_ref: ""                # required — target reference in prod
  validate_script: ""           # optional — path to validation script
  registry: jozu.ml             # optional — target registry host

steps:
  - name: Pull candidate
    kit.pull:
      path: ${candidate_ref}

  - name: Validate (optional)
    when: ${validate_script}
    run:
      command: ${validate_script} ${candidate_ref}

  - name: Tag as stable
    kit.tag:
      source: ${candidate_ref}
      destination: ${stable_ref}

  - name: Push stable release
    kit.push:
      source: ${stable_ref}
```
