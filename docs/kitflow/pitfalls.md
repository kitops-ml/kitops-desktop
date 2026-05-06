---
title: Pitfalls
description: Common mistakes when writing KitFlow files and how to avoid them.
outline: deep
---

# Pitfalls

## Using absolute paths

**Problem:** KitFlow rejects absolute paths in all filesystem commands and the `run` command's `dir` parameter.

```yaml
# Wrong — absolute path
- name: Create directory
  mkdir: /home/user/output

# Wrong — absolute path in write
- name: Write file
  write:
    path: /tmp/result.txt
    content: done
```

**Fix:** Use paths relative to the workspace root (the directory containing the flow YAML file):

```yaml
# Correct
- name: Create directory
  mkdir: ./output

- name: Write file
  write:
    path: ./output/result.txt
    content: done
```

---

## Path traversal with `../`

**Problem:** KitFlow prevents paths from escaping the workspace. Any path that resolves to outside the workspace directory tree is rejected, even if it uses `../` to navigate up.

```yaml
# Wrong — tries to escape the workspace
- name: Copy to parent
  copy:
    from: ./output/model
    to: ../../shared/model
```

**Fix:** Keep all file operations within the workspace. If you need to reference files outside the workspace, use the `run` command with full shell access, and be explicit about what you're doing.

---

## Empty `when` condition always skips

**Problem:** Setting `when: ""` or `when: false` permanently disables the step.

```yaml
# This step will never run
- name: Push to registry
  when: ""
  kit.push:
    source: ${full_ref}
```

This is sometimes intentional (temporarily disabling a step), but is easy to leave in accidentally.

**Fix:** Remove the `when` key entirely if you want the step to always run, or use a meaningful variable:

```yaml
# Use a variable that the user can set
- name: Push to registry
  when: ${do_push}
  kit.push:
    source: ${full_ref}
```

---

## Derived variables that reference unset required variables

**Problem:** If a derived variable references a required variable, it will evaluate to a partial string at load time (before the user fills in the required value).

```yaml
vars:
  repository: ""           # required
  tag: latest
  full_ref: "${repository}:${tag}"  # derived
```

At load time, `full_ref` is `:latest` because `repository` is empty. The UI shows `:latest` in the derived field until the user fills in `repository`.

**Fix:** This is expected behavior — derived variables update live as the user types. No action needed. Just be aware that derived variables shown in the UI may look incomplete until all their dependencies are filled in.

---

## For loop variable is 1-based, not 0-based

**Problem:** The loop variable starts at `1`, not `0`. Code or filenames that expect 0-based indexing will be off by one.

```yaml
# Produces files: shard-1.txt, shard-2.txt, ..., shard-5.txt
- name: Write shards
  for:
    var: i
    count: "5"
    steps:
      - name: Shard ${i}
        write:
          path: ./output/shard-${i}.txt
          content: shard ${i}
```

If your downstream system expects 0-based filenames, account for this in your naming scheme or use a post-processing step.

---

## `read` sets variables that affect only later steps

**Problem:** A variable set by a `read` step is not available to steps that came before it in the flow. Variable values captured at runtime flow forward, not backward.

```yaml
steps:
  - name: Use model name before it's read
    echo: "Model: ${model_name}"    # ${model_name} is empty here

  - name: Read Kitfile
    read:
      format: yaml
      source: ./workspace/Kitfile
      into:
        model_name: package.name

  - name: Use model name after it's read
    echo: "Model: ${model_name}"    # correct — available now
```

**Fix:** Always place `read` steps before any step that uses the variables they set.

---

## `kit.diff` failing stops the flow

**Problem:** `kit.diff` exits with a non-zero exit code when the two artifacts **differ**. In a flow context, this means the step is marked as error and all remaining steps are skipped.

```yaml
steps:
  - name: Diff versions
    kit.diff:
      reference1: ${ref_a}
      reference2: ${ref_b}

  # This step will be skipped if the diff found differences
  - name: Write report
    write: ...
```

**Fix:** Use `kit.diff` as a gate intentionally, or put the `write report` step **before** the diff, or accept that diff failure means the flow stops.

---

## Missing `name` in `for` steps

**Problem:** If the outer `for` step has no `name`, the inner steps default to generic names like `Loop 1`, `Loop 2`, making the UI hard to read.

```yaml
# Hard to read in the UI
- for:
    var: i
    count: "5"
    steps:
      - write:
          path: ./output/shard-${i}.txt
          content: data
```

**Fix:** Always give the outer `for` step a descriptive name, and give inner steps names that use the loop variable:

```yaml
- name: Write ${num_shards} data shards
  for:
    var: i
    count: "${num_shards}"
    steps:
      - name: Write shard ${i}
        write:
          path: ./output/shard-${i}.txt
          content: data
```

---

## Credentials in flow files

**Problem:** Hardcoding passwords or tokens in a flow file commits sensitive values to disk (and potentially to version control).

```yaml
# Wrong — credentials in plaintext
vars:
  username: myuser
  password: supersecrettoken123
```

**Fix:** Declare credentials as required variables so they are supplied at runtime:

```yaml
vars:
  username: ""    # required — supplied at run time
  password: ""    # required — supplied at run time
```

In the desktop UI, required variables are prompted before the flow runs. In the CLI, pass them as flags: `--username=myuser --password=mytoken`.

---

## `kit.unpack` overwrites existing files without warning

**Problem:** `kit.unpack` writes into the target directory without checking whether files already exist. Running a flow twice can overwrite work in progress.

**Fix:** Use a timestamped or versioned directory, or clean the directory first:

```yaml
steps:
  - name: Clean workspace
    run: rm -rf ./workspace

  - name: Unpack
    kit.unpack:
      path: ${model_ref}
      dir: ./workspace
```

---

## `run` command not found in PATH

**Problem:** The shell used by `run` may have a different `PATH` than your interactive terminal, so commands that work in the terminal may fail in a flow.

```yaml
- name: Run Python script
  run: python my_script.py   # may fail if python is not in the shell's PATH
```

**Fix:** Use full paths to executables, or use `env` to locate them:

```yaml
- name: Run Python script
  run: /usr/bin/env python3 my_script.py
```

Or activate the relevant environment in the `run` command:

```yaml
- name: Run in virtualenv
  run: |
    source ./venv/bin/activate
    python my_script.py
```

---

## `write` overwrites without confirmation

**Problem:** The `write` command silently overwrites any existing file at the target path.

**Fix:** This is intentional behavior — flows are meant to be idempotent. If you need to preserve existing content, use a `run` step to check and conditionally write:

```yaml
- name: Write only if missing
  run: |
    if [ ! -f ${output_dir}/config.yaml ]; then
      echo "version: 1" > ${output_dir}/config.yaml
    fi
```

---

## `read` with `merge` and `into` at the same time

**Problem:** `merge` and `into` are mutually exclusive. Specifying both is silently handled by running only the `merge` branch.

**Fix:** Use separate `read` steps if you need both:

```yaml
steps:
  - name: Merge dataset names
    read:
      format: yaml
      source:
        - ./workspace/a/Kitfile
        - ./workspace/b/Kitfile
      merge:
        all_names: datasets

  - name: Read single value
    read:
      format: yaml
      source: ./workspace/a/Kitfile
      into:
        main_author: package.authors
```
