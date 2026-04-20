# kitflow

A CLI runner for KitFlow files — YAML automation scripts for the [KitOps](https://kitops.org) ecosystem.

KitFlow lets you describe a sequence of `kit` commands and filesystem operations in a single YAML file, then run the whole thing with one command. Think of it as a lightweight pipeline for common ModelKit workflows: mirroring, assembling composites, extracting layers, scaffolding new modelkits, etc.

## Installation

`kitflow` is distributed alongside KitOps Desktop. Once installed, add the app's `Resources/bin` directory to your `PATH`, then run:

```sh
kitflow <path/to/flow.yaml>
```

To use it directly from this repo during development:

```sh
pnpm link --global        # exposes `kitflow` globally from this checkout
kitflow my-flow.yaml
```

Or without linking:

```sh
node bin/kitflow.js my-flow.yaml
```

### Requirements

- Node.js 23+
- The `kit` CLI on your `PATH` (or set `KITOPS_CLI_PATH` to the full binary path)

## Usage

```
kitflow <path/to/flow.yaml>
```

kitflow will:

1. Parse the flow file and print the name, description, and step count
2. Prompt for any **required** variables (those with no default)
3. Prompt for **optional** variables with their defaults pre-filled (press Enter to accept)
4. Execute each step in order, printing status as it goes
5. Exit `0` on success, `1` if any step fails

If a step fails, all remaining steps are marked as skipped and the run stops.

## Flow file format

A flow file is a YAML document with three top-level keys:

```yaml
name: my-flow           # displayed in the header
description: >          # optional; shown below the name
  What this flow does.

vars:                   # variable definitions (see Variables)
  my_var: ""
  another_var: default-value

steps:                  # ordered list of steps (see Steps)
  - name: My first step
    kit.pull:
      args: ${my_var}
```

### Variables

Variables are defined under the `vars` key as a flat map of name → default value.

| Default value | Behaviour |
|---|---|
| `""`, `null`, or omitted | **Required** — kitflow will prompt before running |
| Any other string | Optional — used as-is unless overridden at the prompt |
| A string containing `${…}` | **Derived** — computed from other variables; never prompted |

```yaml
vars:
  source_ref: ""                          # required — user must fill in
  target_ref: ""                          # required
  output_tag: latest                      # optional, default "latest"
  source_tag: ${source_ref | tag}         # derived — auto-populated from source_ref
```

#### Variable behaviour at runtime

When you run `kitflow my-flow.yaml`, variables are resolved in this order:

**1. Required variables** — prompted first, in declaration order. kitflow will keep asking until you provide a non-empty value.

```
Required variables:
  source_ref: jozu.ml/myorg/my-model:v1.0
  target_ref: registry.internal/myorg/my-model:v1.0
```

**2. Optional variables** — prompted next, with the default shown in brackets. Press Enter to accept the default.

```
Optional variables (Enter to keep default):
  output_tag [latest]:           ← press Enter → keeps "latest"
  plain_http [false]: true       ← type a value → overrides the default
```

**3. Derived variables** — never prompted. They are computed automatically from whichever variables were collected above, using the same `${…}` interpolation as steps. In the example below, `source_tag` is never shown at the prompt; it is silently resolved to `v1.0` once `source_ref` is known.

```yaml
vars:
  source_ref: ""                     # prompted: "jozu.ml/myorg/my-model:v1.0"
  source_tag: ${source_ref | tag}    # resolved to "v1.0" — no prompt
```

**If a flow has no variables**, the prompting step is skipped entirely and execution begins immediately.

#### Non-interactive use

Pass variable values by name using `--<var>=<value>` flags:

```sh
kitflow mirror.yaml --source_ref=jozu.ml/myorg/my-model:v1.0 --target_ref=registry.internal/myorg/my-model:v1.0
```

When all required variables are covered, the interactive prompt is skipped entirely.

You can also pipe answers via `stdin` for scripting or CI:

```sh
printf 'jozu.ml/myorg/my-model:v1.0\nregistry.internal/myorg/my-model:v1.0\n' \
  | kitflow mirror.yaml
```

Piped answers are matched to variables in prompt order: required variables first (in declaration order), then optional ones. Derived variables consume no lines.

#### Variable interpolation

Variables are expanded anywhere a string value appears in a step using `${name}` syntax.
You can chain filters with `|`:

```yaml
args: ${source_ref | tag}          # extract the :tag portion of an OCI reference
args: ${source_ref | strip-tag}    # remove the :tag portion
args: ${source_ref | after '/'}    # text after the last '/'
args: ${source_ref | before ':'}   # text before the first ':'
```

**Built-in filters**

| Filter | Description |
|---|---|
| `tag` | Extracts the tag from an OCI reference (`registry/repo:tag` → `tag`) |
| `strip-tag` | Removes the tag from an OCI reference (`registry/repo:tag` → `registry/repo`) |
| `after 'sep'` | Returns everything after the **last** occurrence of `sep` |
| `before 'sep'` | Returns everything before the **first** occurrence of `sep` |

### Steps

Each step is a YAML object with an optional `name` and exactly one command key.

```yaml
steps:
  - name: Descriptive name   # optional; defaults to "Step N"
    <command>: <params>
    when: ${some_var}        # optional condition (see Conditionals)
```

#### Conditionals

Any step can be skipped by adding a `when` key. The step runs if the interpolated value is anything other than `false`, `0`, or an empty string.

```yaml
- name: Clean up source
  when: ${remove_source}
  kit.remove:
    args: ${source_ref}
```

---

## Commands

### `kit.*` — kit CLI commands

Any `kit` subcommand can be called by prefixing it with `kit.`. Flags map directly to CLI flags using the same names.

```yaml
- name: Pull modelkit
  kit.pull:
    args: jozu.ml/myorg/my-model:v1.0    # positional argument(s)
    plain-http: false                     # --plain-http=false
    tls-verify: true                      # --tls-verify

- name: Unpack model and code layers only
  kit.unpack:
    args: jozu.ml/myorg/my-model:v1.0
    directory: ./workspace
    layers:
      - model
      - code

- name: Pack the result
  kit.pack:
    directory: ./output
    tag: jozu.ml/myorg/result:v2.0
```

**Flag conversion rules**

| YAML value | CLI flag |
|---|---|
| `true` | `--flag` |
| `false` | `--flag=false` |
| `""` / `null` | omitted |
| `"some-value"` | `--flag=some-value` |
| `[a, b, c]` | `--flag=a --flag=b --flag=c` |

Any flag or positional value starting with `./` or `../` is automatically resolved relative to the workspace root. All other values pass through as-is.

**Supported subcommands**: `pull`, `push`, `pack`, `unpack`, `info`, `inspect`, `tag`, `remove`, `init`, `login`, `logout`, `diff`, and any others the `kit` CLI supports.

---

### `mkdir` — create a directory

```yaml
- name: Create output directory
  mkdir: ./output/model
```

Creates the directory and all missing parents. The path must be relative and must not escape the workspace root.

---

### `write` — write a file

```yaml
- name: Write Kitfile
  write:
    path: ./output/Kitfile
    content: |
      manifestVersion: 1.0.0
      package:
        name: my-model
```

Creates the file and any missing parent directories. `path` must be relative to the workspace root.

---

### `copy` — copy a file or directory

```yaml
- name: Stage model weights
  copy:
    from: ./workspace/base-model/model/
    to: ./output/model/
```

Both paths are resolved relative to the workspace root. Directories are copied recursively.

---

### `move` — move a file or directory

```yaml
- name: Move prompts into output
  move:
    from: ./workspace/prompts/
    to: ./output/prompts/
```

Attempts an atomic rename first; falls back to copy + delete when moving across filesystems.

---

### `read` — read values from a file into variables

The `read` step parses a file (YAML, JSON, or plain text) and stores values into flow variables, making them available to later steps.

#### `into` — read a single value

```yaml
- name: Read model version
  read:
    format: yaml                   # yaml (default) | json | text
    source: ./output/Kitfile
    into:
      model_version: package.version   # varName: dot.path
```

`dot.path` is a dot-separated key path into the parsed document. With `format: text`, the entire file content is stored.

#### `merge` — merge an array field across multiple sources

```yaml
- name: Collect all authors
  read:
    format: yaml
    source:
      - ./workspace/base-model/Kitfile
      - ./workspace/prompts/Kitfile
      - ./workspace/dataset/Kitfile
    merge:
      all_authors: package.authors    # varName: dot.path (must be an array)
```

The values from each source are merged into a single deduplicated array and stored as a JSON string. Downstream steps that accept repeated flags will receive one `--flag=value` per element.

---

## Environment variables

| Variable | Description |
|---|---|
| `KITOPS_CLI_PATH` | Full path to the `kit` binary. Defaults to `kit` (must be on `PATH`). |

---

## Examples

### Mirror a modelkit between registries

```yaml
# mirror.yaml
name: Mirror to private registry
vars:
  source_ref: ""     # e.g. jozu.ml/myorg/my-model:v1.0
  target_ref: ""     # e.g. registry.internal/myorg/my-model:v1.0

steps:
  - name: Pull from source
    kit.pull:
      args: ${source_ref}

  - name: Tag for target
    kit.tag:
      args:
        - ${source_ref}
        - ${target_ref}

  - name: Push to target
    kit.push:
      args: ${target_ref}

  - name: Remove local copy of source
    kit.remove:
      args: ${source_ref}
```

```sh
kitflow mirror.yaml
```

---

### Assemble a composite modelkit from multiple sources

```sh
kitflow kitflows/assemble-composite.yaml
```

Pulls three separate modelkits (base model, prompts collection, evaluation dataset), unpacks only the relevant layer from each, merges author credits, stages everything into a single output directory, and packs + pushes the result.

---

### Extract prompt layers from a model family

```sh
kitflow kitflows/extract-prompts.yaml
```

Pulls three modelkits, unpacks only their `prompts` layer, and copies each into a namespaced local directory for auditing or reuse.

---

### Scaffold a new modelkit with all layer types

```sh
kitflow kitflows/full-kitfile.yaml
```

Writes a complete directory structure (model weights placeholder, datasets, inference/training code, docs, prompts, and a fully-populated Kitfile), then packs and inspects the result.

---

## Writing your own flow

1. Create a `.yaml` file alongside the files it will operate on — its directory becomes the **workspace root**. All relative paths in steps are resolved from there, and paths cannot escape it.
2. Declare variables in `vars`. Leave the default empty (`""`) to make a variable required.
3. Write steps in order. Each step has one command key; everything else is a parameter for that command.
4. Run it:
   ```sh
   kitflow my-flow.yaml
   ```
