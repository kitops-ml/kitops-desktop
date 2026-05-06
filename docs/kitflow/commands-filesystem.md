---
title: Filesystem Commands
description: mkdir, write, copy, move, read, and echo — built-in filesystem operations for KitFlow steps.
outline: deep
---

# Filesystem Commands

KitFlow includes built-in filesystem operations so flows can create directories, generate files, read structured data, and copy or move artifacts without invoking external shell commands.

All path arguments accept variable interpolation. Relative paths are resolved from the **workspace root** — the directory that contains the flow YAML file. Absolute paths are rejected. Paths that would escape the workspace via `../` traversal are also rejected.

## `mkdir`

Create a directory. Parent directories are created automatically (equivalent to `mkdir -p`).

**Shorthand form** (string value):

```yaml
- name: Create output directory
  mkdir: ${output_dir}
```

```yaml
- name: Create nested structure
  mkdir: ${output_dir}/data/raw
```

The value must be a relative path from the workspace root.

## `write`

Write text content to a file. The file is created if it does not exist. Parent directories are created automatically. If the file already exists, it is overwritten.

```yaml
- name: Write configuration
  write:
    path: ${output_dir}/config.yaml
    content: |
      version: "1.0"
      model: ${model_name}
      author: ${author}
```

```yaml
- name: Generate README
  write:
    path: ./workspace/README.md
    content: |
      # ${pkg_name}

      Version: ${pkg_version}

      ${pkg_description}
```

| Parameter | Type | Description |
|---|---|---|
| `path` | string | Relative path to write to, resolved from workspace root |
| `content` | string | Text to write; supports `${var}` interpolation |

The `content` value is fully interpolated before writing. Use YAML block scalars (`|` for literal, `>` for folded) to write multi-line content cleanly.

## `copy`

Copy a file or directory recursively. The destination parent is created automatically.

```yaml
- name: Copy model weights
  copy:
    from: ./staging/model
    to: ${output_dir}/model
```

| Parameter | Type | Description |
|---|---|---|
| `from` | string | Source path (relative to workspace root) |
| `to` | string | Destination path (relative to workspace root) |

If `from` is a directory, the entire directory tree is copied. Existing files at the destination are overwritten.

## `move`

Move or rename a file or directory. The destination parent is created automatically. Uses an atomic rename when the source and destination are on the same filesystem; falls back to copy-then-delete across filesystems.

```yaml
- name: Move to final location
  move:
    from: ./staging/output
    to: ${output_dir}/release
```

| Parameter | Type | Description |
|---|---|---|
| `from` | string | Source path (relative to workspace root) |
| `to` | string | Destination path (relative to workspace root) |

## `read`

Read values from a YAML or JSON file and store them in variables. Variables set by `read` are immediately available to all subsequent steps.

### Read into variables (`into`)

Maps variable names to field paths using dot notation.

```yaml
- name: Read Kitfile metadata
  read:
    format: yaml
    source: ./workspace/Kitfile
    into:
      pkg_name: package.name
      pkg_version: package.version
      pkg_description: package.description
```

```yaml
- name: Read JSON config
  read:
    format: json
    source: ./config.json
    into:
      endpoint: settings.api.url
      timeout: settings.api.timeout
```

| Parameter | Type | Description |
|---|---|---|
| `format` | `yaml` \| `json` \| `text` | File format to parse |
| `source` | string | Path to the file to read |
| `into` | mapping | `variable_name: dot.path.to.field` |

Field paths use dots to traverse nested structures: `package.name` reads `obj.package.name`. If the path does not resolve to a value, the variable is set to an empty string.

### Read entire file as text (`format: text`)

When `format` is `text`, the entire file contents are stored as a string, regardless of the field path specified in `into`.

```yaml
- name: Read README
  read:
    format: text
    source: ./workspace/README.md
    into:
      readme_text: .
```

The key in `into` (`.` in this example) is ignored for text format — any key works. The full file content is stored in the variable.

### Merge from multiple sources (`merge`)

`merge` collects values from multiple source files into a single JSON array stored in one variable. Duplicate values are removed.

```yaml
- name: Collect all dataset names
  read:
    format: yaml
    source:
      - ./workspace/dataset_a/Kitfile
      - ./workspace/dataset_b/Kitfile
      - ./workspace/dataset_c/Kitfile
    merge:
      all_dataset_names: datasets
```

| Parameter | Type | Description |
|---|---|---|
| `format` | `yaml` \| `json` | File format |
| `source` | list of strings | Paths to read from |
| `merge` | mapping | `variable_name: field.path` — the field is read from each source and merged |

If the field at the given path is already an array in a source file, all its elements are included. If the field is a scalar, that single value is included. The result is stored as a JSON-encoded array string: `["a","b","c"]`.

`merge` and `into` are mutually exclusive within a single `read` step. Use two separate `read` steps if you need both.

## `echo`

Output a message. Useful for logging variable values or progress markers.

```yaml
- name: Log model reference
  echo: "Processing modelkit: ${model_ref}"
```

```yaml
- name: Confirm completion
  echo: "Done. Output written to ${output_dir}"
```

The value is a plain string (with variable interpolation). The output appears in the step's output panel in the UI and in the terminal when running via the CLI.
