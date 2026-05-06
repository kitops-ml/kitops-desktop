---
title: Examples
description: Real-world KitFlow patterns — annotated complete flows for common modelkit tasks.
outline: deep
---

# Examples

These examples are drawn from the built-in flow templates included with KitOps Desktop. Each example is self-contained and production-ready — use them as starting points for your own flows.

## Pull and Inspect

The simplest useful flow: pull a modelkit and show its metadata.

```yaml
name: pull-and-inspect
description: >
  Pulls a modelkit from a registry and displays its metadata and layer structure.
  Good for quickly auditing what is inside an artifact without unpacking it.

vars:
  model_ref: ""    # e.g. jozu.ml/myorg/my-model:latest

steps:
  - name: Pull modelkit
    kit.pull:
      path: ${model_ref}

  - name: Show info
    kit.info:
      path: ${model_ref}

  - name: Inspect layers
    kit.inspect:
      path: ${model_ref}
```

---

## Pack and Push

Packs a local directory into a modelkit and pushes it to a registry.

```yaml
name: pack-and-push
description: >
  Packs a local directory as a modelkit and pushes it to a registry.
  The directory must contain a valid Kitfile.

vars:
  source_dir: ./workspace   # directory to pack
  repository: ""            # required — e.g. jozu.ml/myorg/my-model
  tag: latest

steps:
  - name: Pack ${repository}:${tag}
    kit.pack:
      directory: ${source_dir}
      tag: ${repository}:${tag}

  - name: Push to registry
    kit.push:
      source: ${repository}:${tag}
```

---

## Compare Two Versions

Pulls two model versions, reads metadata from their Kitfiles, diffs the layer structure, and writes a Markdown comparison report.

```yaml
name: compare-versions
description: >
  Pulls two versions of the same modelkit side by side, reads key metadata
  from each Kitfile, runs a structural diff, and writes a markdown comparison
  report to disk. Useful for release audits and PR reviews.

vars:
  ref_a: ""            # e.g. jozu.ml/myorg/my-model:v1.0
  ref_b: ""            # e.g. jozu.ml/myorg/my-model:v2.0
  output_dir: ./comparison

steps:
  - name: Pull version A
    kit.pull:
      path: ${ref_a}

  - name: Pull version B
    kit.pull:
      path: ${ref_b}

  - name: Unpack Kitfile from A
    kit.unpack:
      path: ${ref_a}
      dir: ./workspace/a

  - name: Unpack Kitfile from B
    kit.unpack:
      path: ${ref_b}
      dir: ./workspace/b

  - name: Read metadata from A
    read:
      format: yaml
      source: ./workspace/a/Kitfile
      into:
        name_a: package.name
        version_a: package.version
        description_a: package.description

  - name: Read metadata from B
    read:
      format: yaml
      source: ./workspace/b/Kitfile
      into:
        name_b: package.name
        version_b: package.version
        description_b: package.description

  - name: Create output directory
    mkdir: ${output_dir}

  - name: Write comparison report
    write:
      path: ${output_dir}/comparison.md
      content: |
        # Modelkit Comparison

        | Field | Version A | Version B |
        |---|---|---|
        | Name | ${name_a} | ${name_b} |
        | Version | ${version_a} | ${version_b} |

        ## Description A
        ${description_a}

        ## Description B
        ${description_b}

  - name: Diff A vs B
    kit.diff:
      reference1: ${ref_a}
      reference2: ${ref_b}
```

---

## Validate and Promote

A CI/CD promotion gate: runs an optional validation script, re-tags the candidate as a stable release, and pushes to the production registry. Demonstrates `when` for optional steps.

```yaml
name: validate-and-promote
description: >
  Runs an optional validation script against a candidate modelkit.
  If validation passes (or is skipped), re-tags as a stable release
  and pushes to the production registry.

vars:
  candidate_ref: ""       # required — modelkit to test
  stable_ref: ""          # required — target stable reference
  validate_script: ""     # optional — path to validation script

steps:
  - name: Pull candidate
    kit.pull:
      path: ${candidate_ref}

  - name: Run validation
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

---

## Stamp Model Card

Unpacks a modelkit, reads metadata from its Kitfile, generates a Markdown model card, and repacks the modelkit with the updated card included.

```yaml
name: stamp-model-card
description: >
  Reads metadata from a modelkit's Kitfile and writes a formatted
  MODEL-CARD.md into the docs layer, then repacks and optionally pushes.

vars:
  source_ref: ""
  push_after: ""   # set to any value to push after repacking
  author: ""

steps:
  - name: Pull modelkit
    kit.pull:
      path: ${source_ref}

  - name: Unpack to workspace
    kit.unpack:
      path: ${source_ref}
      dir: ./workspace

  - name: Read Kitfile metadata
    read:
      format: yaml
      source: ./workspace/Kitfile
      into:
        pkg_name: package.name
        pkg_version: package.version
        pkg_description: package.description

  - name: Create docs directory
    mkdir: ./workspace/docs

  - name: Write model card
    write:
      path: ./workspace/docs/MODEL-CARD.md
      content: |
        # ${pkg_name}

        **Version:** ${pkg_version}
        **Author:** ${author}

        ## Description

        ${pkg_description}

  - name: Repack with model card
    kit.pack:
      directory: ./workspace
      tag: ${source_ref}

  - name: Push updated modelkit
    when: ${push_after}
    kit.push:
      source: ${source_ref}
```

---

## Registry Sync

Mirrors a modelkit from one registry to another — useful for promoting from dev to production or for cross-region replication.

```yaml
name: registry-sync
description: >
  Pulls a modelkit from a source registry, re-tags it for the destination,
  and pushes it. Works across registries including between public and private
  instances.

vars:
  source_ref: ""            # required — full reference including registry
  dest_registry: ""         # required — destination registry host
  dest_repo: ""             # required — destination repository path
  tag: "${source_ref | tag}"  # derived from source ref's tag

steps:
  - name: Pull from source
    kit.pull:
      path: ${source_ref}

  - name: Tag for destination
    kit.tag:
      source: ${source_ref}
      destination: ${dest_registry}/${dest_repo}:${tag}

  - name: Push to destination
    kit.push:
      source: ${dest_registry}/${dest_repo}:${tag}
```

---

## Dataset Publish

Initializes a Kitfile for a local dataset directory, packs it, optionally runs a validation script, and pushes to the registry.

```yaml
name: dataset-publish
description: >
  Initializes a Kitfile for a local dataset directory (if one does not
  already exist), packs it as a modelkit, optionally runs validation,
  and publishes to the registry.

vars:
  dataset_dir: ./dataset
  repository: ""              # required
  tag: latest
  description: ""             # description for the generated Kitfile
  validate_script: ""         # optional path to a validation script

steps:
  - name: Initialize Kitfile
    kit.init:
      directory: ${dataset_dir}
      desc: ${description}

  - name: Validate dataset
    when: ${validate_script}
    run:
      command: ${validate_script}
      dir: ${dataset_dir}

  - name: Pack dataset
    kit.pack:
      directory: ${dataset_dir}
      tag: ${repository}:${tag}

  - name: Push to registry
    kit.push:
      source: ${repository}:${tag}
```

---

## Pull for Fine-Tuning

Pulls a base model and one or more datasets, unpacks them into a structured workspace ready for a fine-tuning job.

```yaml
name: pull-for-fine-tuning
description: >
  Pulls a base model modelkit and a dataset modelkit, unpacks the model
  weights and dataset into a structured workspace, and writes a job
  configuration file for a fine-tuning script.

vars:
  model_ref: ""       # required — base model
  dataset_ref: ""     # required — training dataset
  output_dir: ./workspace/fine-tune
  job_config: ./workspace/fine-tune/job.yaml

steps:
  - name: Create workspace
    mkdir: ${output_dir}

  - name: Pull base model
    kit.pull:
      path: ${model_ref}

  - name: Pull dataset
    kit.pull:
      path: ${dataset_ref}

  - name: Unpack model weights
    kit.unpack:
      path: ${model_ref}
      dir: ${output_dir}/model
      filter: model

  - name: Unpack dataset
    kit.unpack:
      path: ${dataset_ref}
      dir: ${output_dir}/dataset
      filter: datasets

  - name: Write job configuration
    write:
      path: ${job_config}
      content: |
        model_path: ${output_dir}/model
        dataset_path: ${output_dir}/dataset
        output_path: ${output_dir}/checkpoints
```

---

## Experiment Snapshot

Records the state of a training run — config, metrics, model weights — as a versioned modelkit. Useful for reproducibility and audit trails.

```yaml
name: experiment-snapshot
description: >
  Captures the current state of a training experiment as a modelkit snapshot.
  Reads metrics from a JSON results file, writes a summary, packs everything,
  and pushes to the experiment registry.

vars:
  experiment_dir: ./experiments/current
  registry: ""              # required
  experiment_name: ""       # required — becomes the repository name
  run_id: ""               # required — becomes the tag

steps:
  - name: Read experiment results
    read:
      format: json
      source: ${experiment_dir}/results.json
      into:
        accuracy: metrics.accuracy
        loss: metrics.loss

  - name: Write experiment summary
    write:
      path: ${experiment_dir}/SUMMARY.md
      content: |
        # Experiment: ${experiment_name}

        **Run ID:** ${run_id}
        **Accuracy:** ${accuracy}
        **Loss:** ${loss}

  - name: Pack experiment snapshot
    kit.pack:
      directory: ${experiment_dir}
      tag: ${registry}/${experiment_name}:${run_id}

  - name: Push snapshot
    kit.push:
      source: ${registry}/${experiment_name}:${run_id}
```
