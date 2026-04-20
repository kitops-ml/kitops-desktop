export function validateRepositoryName(value: string): string {
  if (!value) {
    return ''
  }

  if (!value.toLowerCase().match(/^[a-z0-9]/)) {
    return 'Must start with a letter or number'
  }

  const component = '[a-z0-9]+((\\.|-+|_|__)[a-z0-9]+)*'
  const urlRe = new RegExp(`^${component}(/${component})*$`)
  if (!urlRe.test(value.toLowerCase())) {
    return 'Must contain only letters, numbers, hyphens and underscores'
  }

  return ''
}
