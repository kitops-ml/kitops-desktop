---
title: Control Flow
description: Conditional step execution with when, and looping with for.
outline: deep
---

# Control Flow

KitFlow supports two control-flow mechanisms: `when` for conditional step execution, and `for` for repeating a group of steps.

## `when` — Conditional steps

Add a `when` key to any step to make it conditional. The step is executed normally if the condition is truthy, and **skipped** if it is falsy. Skipped steps appear in the UI with a `—` indicator and do not count as failures.

```yaml
- name: Run optional validation
  when: ${validate_script}
  run: ${validate_script} ${model_ref}
```

```yaml
- name: Remove candidate after promotion
  when: ${cleanup}
  kit.remove:
    path: ${candidate_ref}
```

### Condition evaluation

The `when` value is a string that undergoes variable interpolation. After interpolation, the result is evaluated:

| Interpolated value | Result |
|---|---|
| Empty string `""` | **Skipped** |
| `"false"` | **Skipped** |
| `"0"` | **Skipped** |
| Any other value | **Executed** |

This means a `when` condition based on a variable is falsy when the variable is empty (required variable left blank or optional variable with empty default), and truthy when the variable contains any meaningful value.

### Common patterns

**Optional feature flag:**

```yaml
vars:
  enable_metrics: ""     # empty → skip; any value → run

steps:
  - name: Export metrics
    when: ${enable_metrics}
    run: ./export-metrics.sh ${output_dir}
```

**Toggle with a path:**

```yaml
vars:
  post_process_script: ""  # provide a path to activate

steps:
  - name: Post-process
    when: ${post_process_script}
    run:
      command: ${post_process_script}
      dir: ${output_dir}
```

**Skip cleanup in debug mode:**

```yaml
vars:
  skip_cleanup: ""   # set to any value to skip cleanup

steps:
  - name: Remove staging directory
    when: ""          # always hardcoded false — permanently disabled
    run: rm -rf ./staging
```

Setting `when: ""` hardcodes a step to always be skipped — useful for temporarily disabling a step without deleting it.

---

## `for` — Loops

The `for` key turns a step into a loop. It executes a group of nested steps once per iteration, incrementing a named loop variable from 1 to `count` (inclusive).

```yaml
- name: Generate ${num_shards} shards
  for:
    var: i
    count: "${num_shards}"
    steps:
      - name: Write shard ${i}
        write:
          path: ${output_dir}/shard-${i}.jsonl
          content: |
            {"shard": ${i}, "total": ${num_shards}}
```

### `for` parameters

| Parameter | Type | Description |
|---|---|---|
| `var` | string | Name of the loop variable (e.g. `i`, `idx`, `n`). Available as `${var}` inside nested steps. |
| `count` | string or number | Number of iterations. Supports variable interpolation, e.g. `"${num_items}"`. |
| `steps` | list | Steps to execute each iteration. Same syntax as top-level steps. |

### Loop variable values

The loop variable is a string (not a number). Its value starts at `"1"` for the first iteration and increments by 1:

| Iteration | `${i}` value |
|---|---|
| First | `"1"` |
| Second | `"2"` |
| Last | `"<count>"` |

Loops are 1-based. If `count` evaluates to `0` or a negative number, the loop body is not executed.

### Step naming inside loops

Step names inside `for` can use the loop variable. Names are resolved per-iteration:

```yaml
- name: Process ${num_datasets} datasets
  for:
    var: idx
    count: "${num_datasets}"
    steps:
      - name: Pack dataset ${idx}     # becomes "Pack dataset 1", "Pack dataset 2", ...
        kit.pack:
          directory: ./data/dataset-${idx}
          tag: ${registry}/datasets:v${idx}

      - name: Push dataset ${idx}
        kit.push:
          source: ${registry}/datasets:v${idx}
```

### Failure behavior

If any nested step fails during a loop iteration, the loop stops immediately and all remaining iterations and subsequent top-level steps are marked **skipped**. There is no per-iteration retry.

### UI representation

The `for` step appears as a single entry in the step list. Its name is the top-level step name (with the loop count shown when the `count` variable is resolved). Output from all iterations is accumulated under the single step.

### Variable scope

The loop variable (`var`) is set in the shared variable map for the duration of each iteration. It is available to all nested steps within the loop. After the loop finishes, the loop variable retains the value from the last iteration and is available to subsequent top-level steps.

Any variables set by `read` steps inside the loop are also available to subsequent steps — both within the same iteration and to later iterations and top-level steps.

### `for` and `when` together

You can add `when` to a `for` step to skip the entire loop conditionally:

```yaml
- name: Run batch processing
  when: ${enable_batch}
  for:
    var: i
    count: "${batch_count}"
    steps:
      - name: Process item ${i}
        run: ./process.sh ${i}
```

`when` cannot be added to nested steps inside `for` in the current version.

### Nested loops

Loops cannot be nested. A `for` step's `steps` list must contain only flat command steps, not another `for` step.

## Full example with both `when` and `for`

```yaml
name: Batch Dataset Publisher
description: Packs and pushes a configurable number of dataset shards, with optional validation.

vars:
  num_shards: "5"
  registry: ""           # required
  validate: ""           # set to any value to enable validation

steps:
  - name: Create output directory
    mkdir: ./output/shards

  - name: Generate ${num_shards} shards
    for:
      var: i
      count: "${num_shards}"
      steps:
        - name: Write shard ${i}
          write:
            path: ./output/shards/shard-${i}.jsonl
            content: |
              {"shard": ${i}}

        - name: Pack shard ${i}
          kit.pack:
            directory: ./output/shards/shard-${i}.jsonl
            tag: ${registry}/shards:v${i}

  - name: Validate all shards (optional)
    when: ${validate}
    run: ./validate-shards.sh ./output/shards

  - name: Push shards to registry
    for:
      var: i
      count: "${num_shards}"
      steps:
        - name: Push shard ${i}
          kit.push:
            source: ${registry}/shards:v${i}
```
