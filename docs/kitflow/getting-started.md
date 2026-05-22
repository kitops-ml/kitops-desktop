---
title: Getting Started
description: Write and run your first KitFlow in under five minutes.
outline: deep
---

# Getting Started

This guide walks you through creating and running a KitFlow file for the first time.

## Prerequisites

- KitOps Desktop installed and open
- A KitOps registry account (or access to a local registry)
- Basic familiarity with YAML

## Step 1 — Write a Flow File

Create a file called `my-first-flow.yaml` anywhere on your machine:

```yaml
name: Pull and Inspect
description: >
  Pulls a modelkit from a registry and shows its metadata.
  Replace model_ref with any modelkit reference you have access to.

vars:
  model_ref: ""   # required — e.g. jozu.ml/myorg/my-model:latest

steps:
  - name: Pull modelkit
    kit.pull:
      path: ${model_ref}

  - name: Show info
    kit.info:
      path: ${model_ref}
```

Save the file. That's all you need.

## Step 2 — Import Into the Library

1. Open KitOps Desktop.
2. Navigate to the **KitFlow** section in the sidebar.
3. Click **Import Flow** and select `my-first-flow.yaml`.

The flow appears in your library with its name and description. KitOps Desktop reads the `name` and `description` fields from the YAML automatically.

## Step 3 — Fill in Variables and Run

1. Click the flow in the library to open it.
2. The **Variables** panel shows a field for `model_ref` — it is marked required because the default is empty.
3. Enter a modelkit reference, e.g. `jozu.ml/myorg/my-model:latest`.
4. Click **Run**.

Each step appears in the step list with a spinner while it runs. When a step completes you see its output inline. If a step fails, subsequent steps are marked skipped and the error is displayed.

## Step 4 — Add More Steps

Extend the flow by adding steps to the `steps` list:

```yaml
steps:
  - name: Pull modelkit
    kit.pull:
      path: ${model_ref}

  - name: Unpack to workspace
    kit.unpack:
      path: ${model_ref}
      dir: ./workspace

  - name: Read model name from Kitfile
    read:
      format: yaml
      source: ./workspace/Kitfile
      into:
        model_name: package.name

  - name: Show model name
    echo: "Model name is: ${model_name}"

  - name: Show full info
    kit.info:
      path: ${model_ref}
```

Click **Reload** in the UI or re-import the file to pick up the changes.

## Running From the Terminal

If you prefer the command line, run any flow file directly without the desktop app:

```sh
kitflow ./my-first-flow.yaml
```

The CLI prompts you for required variables interactively. To skip the prompt, pass values as flags:

```sh
kitflow ./my-first-flow.yaml --model_ref=jozu.ml/myorg/my-model:latest
```

See the [CLI Reference](./cli.md) for all options.

## Next Steps

- Learn the full [Syntax Reference](./syntax.md) to understand every top-level key.
- Explore [Variables](./variables.md) to use derived expressions and string filters.
- Browse [Examples](./examples.md) for complete, annotated real-world flows.
- Check [Pitfalls](./pitfalls.md) before you hit them.
