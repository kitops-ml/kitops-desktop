import compareVersionsYaml from '../../kitflows/compare-versions.yaml?raw'
import datasetPublishYaml from '../../kitflows/dataset-publish.yaml?raw'
import experimentSnapshotYaml from '../../kitflows/experiment-snapshot.yaml?raw'
import fullKitfileYaml from '../../kitflows/full-kitfile.yaml?raw'
import packAndPushYaml from '../../kitflows/pack-and-push.yaml?raw'
import pullAndInspectYaml from '../../kitflows/pull-and-inspect.yaml?raw'
import pullForFineTuningYaml from '../../kitflows/pull-for-fine-tuning.yaml?raw'
import registrySyncYaml from '../../kitflows/registry-sync.yaml?raw'
import stampModelCardYaml from '../../kitflows/stamp-model-card.yaml?raw'
import testPromptInOllamaYaml from '../../kitflows/test-prompt-in-ollama.yaml?raw'
import validateAndPromoteYaml from '../../kitflows/validate-and-promote.yaml?raw'

export interface KitFlowExample {
  filename: string
  name: string
  description: string
  yaml: string
}

export const KITFLOW_EXAMPLES: KitFlowExample[] = [
  {
    filename: 'full-kitfile.yaml',
    name: 'Full Kitfile',
    description: 'A comprehensive example showcasing all features of the Kitfile spec in one place.',
    yaml: fullKitfileYaml,
  },
  {
    filename: 'pull-and-inspect.yaml',
    name: 'Pull and inspect',
    description: 'Pull a modelkit from a registry and inspect its metadata and layer structure.',
    yaml: pullAndInspectYaml,
  },
  {
    filename: 'experiment-snapshot.yaml',
    name: 'Experiment snapshot',
    description: 'Version a training run as a reproducible modelkit the moment it finishes — model, data, code, and results in one artifact.',
    yaml: experimentSnapshotYaml,
  },
  {
    filename: 'pull-for-fine-tuning.yaml',
    name: 'Pull for fine-tuning',
    description: 'Pull a base model and training dataset and stage them into an isolated local workspace ready for fine-tuning.',
    yaml: pullForFineTuningYaml,
  },
  {
    filename: 'dataset-publish.yaml',
    name: 'Publish dataset',
    description: 'Pack and publish a curated dataset as a standalone versioned modelkit, with optional pre-publish validation.',
    yaml: datasetPublishYaml,
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
    filename: 'validate-and-promote.yaml',
    name: 'Validate and promote',
    description: 'CI/CD promotion gate: pull the candidate, diff against current production, and promote only when the delta looks right.',
    yaml: validateAndPromoteYaml,
  },
  {
    filename: 'registry-sync.yaml',
    name: 'Registry sync',
    description: 'Mirror a modelkit from one registry to another — useful for dev → staging → prod pipelines and air-gapped environments.',
    yaml: registrySyncYaml,
  },
  {
    filename: 'test-prompt-in-ollama.yaml',
    name: 'Test prompt in Ollama',
    description: 'Pull a modelkit, load its GGUF weights into a local Ollama instance, and fire a test prompt to verify the model responds correctly.',
    yaml: testPromptInOllamaYaml,
  },
]
