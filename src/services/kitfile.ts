import type { Kitfile } from '@kitops/kitops-ts'
import { parse as parseYaml, stringify } from 'yaml'

export function kitfileToYaml(formData: Kitfile, showModel: boolean): string {
  const kit: Record<string, unknown> = { manifestVersion: '1.0' }

  const pkg: Record<string, unknown> = {}
  if (formData.package.name) {
    pkg.name = formData.package.name
  }
  if (formData.package.version) {
    pkg.version = formData.package.version
  }
  if (formData.package.description) {
    pkg.description = formData.package.description
  }
  const authors = formData.package.authors.filter(a => a.trim())
  if (authors.length) {
    pkg.authors = authors
  }
  kit.package = pkg

  if (showModel) {
    const model: Record<string, unknown> = { path: formData.model.path || 'model/' }
    if (formData.model.name) {
      model.name = formData.model.name
    }
    if (formData.model.framework) {
      model.framework = formData.model.framework
    }
    if (formData.model.version) {
      model.version = formData.model.version
    }
    if (formData.model.description) {
      model.description = formData.model.description
    }
    if (formData.model.license) {
      model.license = formData.model.license
    }
    const validParts = formData.model.parts.filter(p => p.path)
    if (validParts.length) {
      model.parts = validParts.map(p => {
        const part: Record<string, string> = { path: p.path }
        if (p.name) {
          part.name = p.name
        }
        if (p.type) {
          part.type = p.type
        }
        return part
      })
    }
    const parametersStr = formData.model.parameters as string
    if (parametersStr?.trim()) {
      try {
        model.parameters = parseYaml(parametersStr)
      } catch {
        model.parameters = parametersStr
      }
    }
    kit.model = model
  }

  const validCode = formData.code.filter(c => c.path)
  if (validCode.length) {
    kit.code = validCode.map(c => {
      const entry: Record<string, string> = { path: c.path }
      if (c.description) {
        entry.description = c.description
      }
      if (c.license) {
        entry.license = c.license
      }
      return entry
    })
  }

  const validDatasets = formData.datasets.filter(d => d.path)
  if (validDatasets.length) {
    kit.datasets = validDatasets.map(d => {
      const entry: Record<string, string> = { path: d.path }
      if (d.name) {
        entry.name = d.name
      }
      if (d.description) {
        entry.description = d.description
      }
      if (d.license) {
        entry.license = d.license
      }
      return entry
    })
  }

  const validDocs = formData.docs.filter(d => d.path)
  if (validDocs.length) {
    kit.docs = validDocs.map(d => {
      const entry: Record<string, string> = { path: d.path }
      if (d.description) {
        entry.description = d.description
      }
      return entry
    })
  }

  const validPrompts = formData.prompts.filter(d => d.path)
  if (validPrompts.length) {
    kit.prompts = validPrompts.map(d => {
      const entry: Record<string, string> = { path: d.path }
      if (d.description) {
        entry.description = d.description
      }
      return entry
    })
  }

  return stringify(kit)
}
