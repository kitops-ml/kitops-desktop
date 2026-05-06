---
title: Variables
description: Required, optional, and derived variables; interpolation syntax and built-in string filters.
outline: deep
---

# Variables

Variables are the primary way to make a KitFlow file reusable. They are declared under the `vars` key and referenced anywhere in step definitions using `${variable_name}`.

## Declaring Variables

```yaml
vars:
  model_ref: ""              # required
  tag: latest                # optional
  output_dir: ./output       # optional
  full_ref: "${model_ref}:${tag}"  # derived
```

Every key under `vars` becomes a variable. The value is the default.

## Variable Kinds

### Required

A variable is required when its default is an empty string `""` or `null`. The user must supply a value before the flow can run.

```yaml
vars:
  model_ref: ""     # required
  registry: null    # also required
```

In the desktop UI, required variables are shown with an empty text field and the **Run** button is disabled until all required variables have a value.

In the CLI, required variables are prompted interactively. If you pass `--json` without providing all required variables, the runner exits with an error listing every missing variable.

### Optional

A variable is optional when its default is a non-empty string. The flow runs with the default unless the user overrides it.

```yaml
vars:
  tag: latest
  output_dir: ./output
  plain_http: "false"
```

In the desktop UI, optional variables are shown pre-filled with their defaults. The user can edit them before running.

### Derived

A variable is derived when its default value contains `${...}`. Derived variables are recomputed automatically whenever any of their dependencies change.

```yaml
vars:
  repository: ""
  tag: latest
  full_ref: "${repository}:${tag}"    # recomputed whenever repository or tag changes
```

Derived variables are not editable directly in the UI — they update live as their dependencies are modified. If you edit a derived variable manually, it is marked as "dirty" and stops receiving automatic updates until the flow is reset.

**Derivation order:** Non-derived variables are initialized first. Derived variables are then evaluated in declaration order, so a derived variable can reference another derived variable declared above it.

## Interpolation Syntax

Use `${variable_name}` anywhere in a string value — step names, command arguments, file paths, file content, shell commands, echo messages, etc.

```yaml
steps:
  - name: Pack ${repository}:${tag}
    kit.pack:
      directory: ./workspace
      tag: ${repository}:${tag}

  - name: Write metadata
    write:
      path: ${output_dir}/info.txt
      content: |
        Model: ${repository}
        Tag: ${tag}
        Ref: ${full_ref}
```

If a variable name in `${...}` does not exist in `vars`, the placeholder is left unchanged in the output. This is intentional — it makes missing variables visible rather than silently discarding them.

## String Filters

Filters transform a variable's value at interpolation time. They are applied inline with a pipe `|` inside the `${}` expression. Multiple filters can be chained.

```
${variable_name | filter}
${variable_name | filter1 | filter2}
```

### `tag`

Extracts the tag portion from an OCI image reference.

```
${ref | tag}
```

| Input | Output |
|---|---|
| `jozu.ml/myorg/my-model:v1.0` | `v1.0` |
| `registry.example.com/team/project:latest` | `latest` |
| `myrepo/model` (no tag) | `` (empty string) |

### `strip-tag`

Removes the tag from an OCI image reference, leaving the repository path.

```
${ref | strip-tag}
```

| Input | Output |
|---|---|
| `jozu.ml/myorg/my-model:v1.0` | `jozu.ml/myorg/my-model` |
| `registry.example.com/team/project:latest` | `registry.example.com/team/project` |
| `myrepo/model` (no tag) | `myrepo/model` |

### `after "separator"`

Returns the substring after the **last** occurrence of the separator.

```
${path | after "/"}
```

| Input | Separator | Output |
|---|---|---|
| `workspace/data/file.json` | `/` | `file.json` |
| `myorg/mymodel` | `/` | `mymodel` |
| `host:port` | `:` | `port` |

### `before "separator"`

Returns the substring before the **first** occurrence of the separator.

```
${ref | before ":"}
```

| Input | Separator | Output |
|---|---|---|
| `jozu.ml/myorg/model:v1.0` | `:` | `jozu.ml/myorg/model` |
| `host:8080` | `:` | `host` |

### Chaining filters

Filters can be chained left to right:

```yaml
vars:
  full_ref: "jozu.ml/myorg/my-model:v2.0"
  repo_only: "${full_ref | strip-tag}"          # jozu.ml/myorg/my-model
  model_name: "${full_ref | strip-tag | after '/'}"  # my-model
  tag_only: "${full_ref | tag}"                  # v2.0
```

## Runtime Variable Updates

Variables set by `read` steps are available to all subsequent steps in the flow. They are written directly into the live variable map at execution time.

```yaml
steps:
  - name: Unpack Kitfile
    kit.unpack:
      path: ${model_ref}
      dir: ./workspace

  - name: Read package name
    read:
      format: yaml
      source: ./workspace/Kitfile
      into:
        pkg_name: package.name     # sets ${pkg_name} for all steps below

  - name: Print name
    echo: "Package: ${pkg_name}"   # uses the value read above
```

## Examples

### Derived reference from parts

```yaml
vars:
  registry: jozu.ml
  org: myorg
  model: my-model
  tag: latest
  full_ref: "${registry}/${org}/${model}:${tag}"

steps:
  - name: Pull ${full_ref}
    kit.pull:
      path: ${full_ref}
```

### Extracting the tag to use in a filename

```yaml
vars:
  model_ref: ""
  tag: "${model_ref | tag}"

steps:
  - name: Write tag file
    write:
      path: ./output/tag.txt
      content: "${tag}"
```

### Registry sync with stripped references

```yaml
vars:
  source_ref: ""
  dest_registry: registry.example.com
  dest_ref: "${dest_registry}/${source_ref | strip-tag | after '/'}"
```
