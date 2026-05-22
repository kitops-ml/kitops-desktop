---
title: Shell Command
description: The run command — execute shell commands with full pipe and redirect support.
outline: deep
---

# Shell Command (`run`)

The `run` command executes an arbitrary shell command. It uses the system shell (`sh` on Unix-like systems), so pipes, redirects, environment variable expansions, and glob patterns all work as expected.

## Shorthand form

Pass the command as a plain string:

```yaml
- name: List output directory
  run: ls -la ${output_dir}
```

```yaml
- name: Count files
  run: find ${output_dir} -type f | wc -l
```

## Object form

Use an object when you need to set the working directory:

```yaml
- name: Run validation script
  run:
    command: python validate.py --data ${dataset_dir} --strict
    dir: ${workspace}
```

| Parameter | Type | Description |
|---|---|---|
| `command` | string | The shell command to execute; supports `${var}` interpolation |
| `dir` | string | Working directory for the command, relative to workspace root (defaults to workspace root) |

## Output streaming

Standard output and standard error are both captured and streamed live to the step's output panel in the desktop UI. In the terminal, output appears progressively as the command runs.

## Failure behavior

If the command exits with a non-zero exit code, the step is marked as **error** and all subsequent steps are marked **skipped**. The exit code message is shown in the step's error field.

## Examples

### Run a Python script

```yaml
- name: Run preprocessing
  run:
    command: python preprocess.py --input ./raw --output ${output_dir}
    dir: ${workspace}
```

### Shell pipeline

```yaml
- name: Find large files
  run: find ${output_dir} -size +100M -exec ls -lh {} \;
```

### Multi-line shell script

YAML block scalars let you write multi-line commands cleanly:

```yaml
- name: Generate checksums
  run: |
    cd ${output_dir}
    sha256sum model/*.bin > checksums.txt
    echo "Checksums written to ${output_dir}/checksums.txt"
```

### Conditional command within a step

```yaml
- name: Load into Ollama
  run: |
    ollama pull llama3
    ollama run llama3 "Summarize this: $(cat ${output_dir}/prompt.txt)"
```

## Path resolution for `dir`

The `dir` parameter is resolved relative to the workspace root (the directory containing the flow YAML file). Absolute paths and paths that escape the workspace are rejected. If `dir` is omitted, the command runs from the workspace root.

## Security note

The `run` command executes developer-authored shell commands from a YAML file you control — similar to a shell step in a Makefile or GitHub Actions workflow. Variable values are interpolated into the command string before it is passed to the shell.

Because of this, be careful with variables that might contain shell metacharacters if they come from untrusted external sources (e.g., a registry tag scraped from user input). For flows that operate entirely on known, controlled inputs this is not a concern.
