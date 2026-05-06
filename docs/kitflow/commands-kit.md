---
title: Kit Commands
description: Reference for all kit.* commands — pull, push, pack, unpack, tag, diff, remove, init, info, inspect, login, logout.
outline: deep
---

# Kit Commands

`kit.*` commands are executed via [`kitops-ts`](https://kitops.org/docs/kitops-ts/api-reference/). Only subcommands supported by that library are available here.

YAML parameter names match the `kitops-ts` function signatures directly — positional parameter names (e.g. `path`, `directory`, `source`) and flag names (e.g. `tlsVerify`, `ignoreExisting`) are the same as in the TypeScript API. Flag names are automatically converted from camelCase to kebab-case when passed to the `kit` binary (`tlsVerify` → `--tls-verify`).

## `kit.pull`

`pull(path: string, flags?: TLSFlags)`

```yaml
- name: Pull modelkit
  kit.pull:
    path: ${model_ref}
```

| Parameter | Type | Description |
|---|---|---|
| `path` | string | OCI reference to pull, e.g. `jozu.ml/myorg/model:v1.0` |
| `tlsVerify` | boolean | Verify TLS certificates (default true) |
| `tlsCert` | string | Path to a custom TLS certificate |

## `kit.push`

`push(source: string, destination?: string, flags?: TLSFlags)`

```yaml
- name: Push to registry
  kit.push:
    source: ${full_ref}
```

```yaml
- name: Push under a different reference
  kit.push:
    source: ${source_ref}
    destination: ${dest_ref}
```

| Parameter | Type | Description |
|---|---|---|
| `source` | string | OCI reference of the local modelkit to push |
| `destination` | string | Optional target reference if pushing under a different name |
| `tlsVerify` | boolean | Verify TLS certificates (default true) |
| `tlsCert` | string | Path to a custom TLS certificate |

## `kit.pack`

`pack(directory?: string, flags?: PackFlags)`

```yaml
- name: Pack workspace
  kit.pack:
    directory: ./workspace
    tag: ${repository}:${tag}
```

| Parameter | Type | Description |
|---|---|---|
| `directory` | string | Path to the directory to pack (must contain a `Kitfile`). Resolved relative to workspace root. |
| `tag` | string | OCI reference to assign, e.g. `myrepo/model:v1.0` |
| `file` | string | Path to the Kitfile if not at the root of `directory` |
| `compression` | string | Compression algorithm to use |

## `kit.unpack`

`unpack(path: string, flags?: UnpackFlags)`

```yaml
- name: Unpack all layers
  kit.unpack:
    path: ${model_ref}
    dir: ./workspace
```

```yaml
- name: Unpack model and datasets only
  kit.unpack:
    path: ${model_ref}
    dir: ./workspace
    filter:
      - model
      - datasets
```

| Parameter | Type | Description |
|---|---|---|
| `path` | string | OCI reference of the modelkit to unpack |
| `dir` | string | Destination directory (created if it does not exist) |
| `filter` | string or list | Layer types to extract. Omit to extract everything. Valid values: `model`, `datasets`, `code`, `docs`, `prompts` |
| `overwrite` | boolean | Overwrite existing files |
| `ignoreExisting` | boolean | Skip files that already exist |

The Kitfile is always extracted regardless of `filter` — it is part of the image manifest, not a named layer.

## `kit.tag`

`tag(source: string, destination: string)`

```yaml
- name: Tag as stable
  kit.tag:
    source: ${candidate_ref}
    destination: ${stable_ref}
```

| Parameter | Type | Description |
|---|---|---|
| `source` | string | Existing local OCI reference |
| `destination` | string | New OCI reference to create |

## `kit.diff`

`diff(reference1: string, reference2: string)`

Exits non-zero when the artifacts differ, which fails the step and stops the flow.

```yaml
- name: Diff versions
  kit.diff:
    reference1: ${ref_a}
    reference2: ${ref_b}
```

| Parameter | Type | Description |
|---|---|---|
| `reference1` | string | First OCI reference to compare |
| `reference2` | string | Second OCI reference to compare |

## `kit.remove`

`remove(path: string, flags?: RemoveFlags)`

```yaml
- name: Clean up candidate
  kit.remove:
    path: ${candidate_ref}
```

| Parameter | Type | Description |
|---|---|---|
| `path` | string | OCI reference of the local modelkit to remove |
| `force` | boolean | Skip confirmation prompts |
| `all` | boolean | Remove all locally cached modelkits |
| `remote` | boolean | Remove from the remote registry instead of local storage |

## `kit.init`

`init(directory?: string, flags?: InitFlags)`

```yaml
- name: Initialize Kitfile
  kit.init:
    directory: ./workspace
    name: my-model
    desc: "Fine-tuned Llama model for code generation"
    author: "My Team"
```

| Parameter | Type | Description |
|---|---|---|
| `directory` | string | Directory to initialize. Resolved relative to workspace root. |
| `name` | string | Model name written into the generated Kitfile |
| `desc` | string | Description written into the generated Kitfile |
| `author` | string | Author written into the generated Kitfile |
| `force` | boolean | Overwrite an existing Kitfile without prompting |

## `kit.info`

`info(path: string, flags?: InfoFlags)`

```yaml
- name: Show modelkit info
  kit.info:
    path: ${model_ref}
```

| Parameter | Type | Description |
|---|---|---|
| `path` | string | OCI reference of the modelkit |
| `remote` | boolean | Fetch info directly from the registry without pulling first |
| `filter` | string | Limit output to specific layer types |

## `kit.inspect`

`inspect(path: string, flags?: InspectFlags)`

```yaml
- name: Inspect layer sizes
  kit.inspect:
    path: ${model_ref}
```

| Parameter | Type | Description |
|---|---|---|
| `path` | string | OCI reference of the modelkit |
| `remote` | boolean | Inspect directly from the registry without pulling first |

## `kit.login`

`login(registry: string, username: string, password: string, flags?: TLSFlags)`

```yaml
- name: Login to registry
  kit.login:
    registry: ${registry}
    username: ${username}
    password: ${password}
```

| Parameter | Type | Description |
|---|---|---|
| `registry` | string | Registry hostname, e.g. `jozu.ml` |
| `username` | string | Username or access token name |
| `password` | string | Password or access token value |
| `tlsVerify` | boolean | Verify TLS certificates (default true) |
| `tlsCert` | string | Path to a custom TLS certificate |

**Security note:** Avoid hardcoding credentials in the flow file. Declare `username` and `password` as required variables (empty default) so they are supplied at runtime and never committed to disk.

## `kit.logout`

`logout(registry: string)`

```yaml
- name: Logout
  kit.logout:
    registry: ${registry}
```

| Parameter | Type | Description |
|---|---|---|
| `registry` | string | Registry hostname to log out from |
