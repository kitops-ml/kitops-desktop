---
title: KitFlow
description: YAML-driven workflow automation for KitOps Desktop
outline: deep
---

# KitFlow

KitFlow is a YAML-based workflow engine built into KitOps Desktop. It lets you define repeatable, multi-step automation pipelines that combine kit CLI operations, filesystem tasks, shell commands, and control flow — all in a single readable file.

Think of a KitFlow file like a Makefile or a GitHub Actions workflow, but purpose-built for the KitOps modelkit lifecycle: pulling, packing, pushing, inspecting, comparing, and transforming modelkits.

## Why KitFlow

Common modelkit workflows — publishing a dataset, comparing two model versions, migrating between registries — involve several steps that must run in a specific order. Without automation you run each command manually, which is error-prone and hard to reproduce.

KitFlow solves this by letting you encode the entire workflow once and run it with a single click in the desktop UI or a single command in the terminal. Variables make flows reusable: the same file can target different registries, model references, or directories just by filling in different values.

## Key Features

| Feature | Description |
|---|---|
| **Kit CLI integration** | Run any `kit` subcommand (`pull`, `push`, `pack`, `unpack`, `tag`, `diff`, `info`, `inspect`, `login`, `logout`, `remove`, `init`) |
| **Filesystem operations** | Create directories, write files, copy, move, and read structured data from YAML/JSON |
| **Shell execution** | Run arbitrary shell commands with full pipe and redirect support |
| **Variable system** | Required, optional, and derived variables with live interpolation |
| **String filters** | Extract tags, strip tags, and split strings inline with `|` pipe filters |
| **Conditional steps** | Skip steps at runtime based on variable values using `when` |
| **Loops** | Repeat groups of steps a configurable number of times using `for` |
| **Real-time output** | Each step streams output live in the desktop UI as it runs |
| **Library** | Save and manage flows in a personal library inside the app |

## File Format

KitFlow files are standard YAML with a `.yaml` or `.yml` extension. There is no special toolchain — any text editor works.

```yaml
name: My First Flow
description: A simple example that pulls and inspects a modelkit.

vars:
  model_ref: ""   # required — user must supply before running

steps:
  - name: Pull modelkit
    kit.pull:
      path: ${model_ref}

  - name: Show info
    kit.info:
      path: ${model_ref}
```

## Documentation Map

| Page | What it covers |
|---|---|
| [Getting Started](./getting-started.md) | Install, write, and run your first flow |
| [Syntax Reference](./syntax.md) | Complete YAML schema — all top-level keys and their types |
| [Variables](./variables.md) | Required, optional, and derived variables; filters and interpolation |
| [Kit Commands](./commands-kit.md) | All `kit.*` subcommands and their arguments |
| [Filesystem Commands](./commands-filesystem.md) | `mkdir`, `write`, `copy`, `move`, `read`, `echo` |
| [Shell Command](./commands-shell.md) | `run` — execute shell commands with progress streaming |
| [Control Flow](./commands-control-flow.md) | `when` conditions and `for` loops |
| [Examples](./examples.md) | Real-world patterns and annotated full flows |
| [Pitfalls](./pitfalls.md) | Common mistakes and how to avoid them |
| [CLI Reference](./cli.md) | Run flows from the terminal without the desktop app |
| [Technical Details](./technical.md) | Architecture, event protocol, variable resolution phases |
