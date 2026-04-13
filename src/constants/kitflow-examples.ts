import compareVersionsYaml from '../../kitflows/compare-versions.yaml?raw'
import crossRegistryMirrorYaml from '../../kitflows/cross-registry-mirror.yaml?raw'
import generateReleaseNotesYaml from '../../kitflows/generate-release-notes.yaml?raw'
import packAndPushYaml from '../../kitflows/pack-and-push.yaml?raw'
import promoteToProductionYaml from '../../kitflows/promote-to-production.yaml?raw'
import pullAndInspectYaml from '../../kitflows/pull-and-inspect.yaml?raw'
import setupPromptEncryptionYaml from '../../kitflows/setup-prompt-encryption.yaml?raw'
import stampModelCardYaml from '../../kitflows/stamp-model-card.yaml?raw'

export interface KitFlowExample {
  filename: string
  name: string
  description: string
  yaml: string
}

export const KITFLOW_EXAMPLES: KitFlowExample[] = [
  {
    filename: 'pull-and-inspect.yaml',
    name: 'Pull and inspect',
    description: 'Pull a modelkit from a registry and inspect its metadata and layer structure.',
    yaml: pullAndInspectYaml,
  },
  {
    filename: 'cross-registry-mirror.yaml',
    name: 'Cross-registry mirror',
    description: 'Pull from one registry and push to another. Great for dev → staging → prod migrations.',
    yaml: crossRegistryMirrorYaml,
  },
  {
    filename: 'pack-and-push.yaml',
    name: 'Pack and push',
    description: 'Pack a local Kitfile directory into a modelkit and push it to a registry.',
    yaml: packAndPushYaml,
  },
  {
    filename: 'compare-versions.yaml',
    name: 'Compare versions',
    description: 'Pull two versions of the same modelkit, diff their layers, and write a side-by-side comparison report.',
    yaml: compareVersionsYaml,
  },
  {
    filename: 'stamp-model-card.yaml',
    name: 'Stamp model card',
    description: 'Generate a MODEL-CARD.md from Kitfile metadata and repack — keeps docs in sync automatically.',
    yaml: stampModelCardYaml,
  },
  {
    filename: 'promote-to-production.yaml',
    name: 'Promote to production',
    description: 'CI/CD promotion gate: pull from staging, diff against current prod, retag, and push.',
    yaml: promoteToProductionYaml,
  },
  {
    filename: 'generate-release-notes.yaml',
    name: 'Generate release notes',
    description: 'Pull two versions, diff the layers, and write a pre-populated RELEASE-NOTES.md template.',
    yaml: generateReleaseNotesYaml,
  },
  {
    filename: 'setup-prompt-encryption.yaml',
    name: 'Setup prompt encryption',
    description: 'Bundle SOPS encryption config and helper scripts into a modelkit so prompt files can be encrypted before sharing.',
    yaml: setupPromptEncryptionYaml,
  },
]
