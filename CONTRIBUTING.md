# Contributing to KitOps Desktop

Thanks for your interest in contributing! Here's what you need to know.

## Ways to Contribute

We welcome many different types of contributions including:

* [New features](https://github.com/kitops-ml/kitops-desktop/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)
* [Bug fixes](https://github.com/kitops-ml/kitops-desktop/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)
* [Documentation](https://github.com/kitops-ml/kitops-desktop/issues?q=is%3Aopen+is%3Aissue+label%3Adocumentation)
* [Builds and CI/CD](https://github.com/kitops-ml/kitops-desktop/issues?q=is%3Aopen+is%3Aissue+label%3Abuild)
* Release management
* Issue triage
* Answering questions on Discord, or the mailing list
* UI/UX
* Communications, social media, blog posts, or other marketing

If you think there's something else you can help with please contact us in the [#general channel of our Discord server](https://discord.gg/Tapeh8agYy) and let's discuss how we can work together.

## Development Environment Setup

### Prerequisites

- [Node.js](https://nodejs.org) 23+
- [pnpm](https://pnpm.io) 10+

### Setup

```bash
git clone https://github.com/kitops-ml/kitops-desktop.git
cd kitops-desktop
pnpm install
pnpm run electron:dev
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for a full breakdown of the project structure,
how IPC between Electron and Vue works, how to add new views, and more.

## Making changes

### Branches

Work on a feature branch off `main`:

```bash
git checkout -b your-feature-name
```

### Code style

The project uses ESLint. Run it before committing:

```bash
pnpm run lint
# or auto-fix
pnpm run lint:fix
```

A few things to keep in mind:
- Single quotes, no semicolons, 2-space indent
- Prefer regular functions for top-level declarations and exported functions
- Arrow functions are fine for callbacks, watchers, and computed properties
- Keep Vue components in the `<script>`, `<template>`, `<style>` order
- Imports are auto-sorted by eslint — just let `lint:fix` handle it

### Terminology

When writing UI copy or documentation, use the right terms:

- **Kitfile** — the definition file (like a Dockerfile)
- **ModelKit** — the built artifact (not "kit" or "kits")
- **Repository** — the namespace (`jozu.ml/myorg/mymodel`)
- **Tag** — the label within a repository (`:latest`, `:v1.0`)

### Commits

Write clear, descriptive commit messages. The first line should be a short imperative
summary (`Add disk usage grouping by repository`, not `Fixed stuff`).

### Pre-commit hooks

Husky runs `eslint --fix` on staged files automatically. If the hook fails,
fix the issue before committing — don't skip it.

## Opening a pull request

1. Make sure `pnpm run lint` passes
2. Test your changes manually — see the checklist in [DEVELOPMENT.md](DEVELOPMENT.md)
3. Fill out the PR template
4. Keep PRs focused — one feature or fix per PR makes review much easier

## Reporting bugs

Use the [bug report template](../../issues/new?template=bug_report.yml).
Include your OS, app version, and steps to reproduce.

## Requesting features

Use the [feature request template](../../issues/new?template=feature_request.yml).

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
Be kind and respectful in all interactions.
