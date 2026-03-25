// Convert size in human-readable (eg. b, MiB, GiB, etc.) format to int number (bytes)
export function sizeToNumber(size: string): number {
  const sizeStr = size.toLowerCase()
  const units: { [key: string]: number } = {
    b: 1,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    pib: 1024 ** 5,
  }

  const regex = /^([\d.]+)\s*(b|kib|mib|gib|tib|pib)?$/i
  const match = sizeStr.trim().match(regex)

  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`)
  }

  const value = parseFloat(match[1])
  const unit = match[2] ? match[2].toLowerCase() : 'b'

  return Math.round(value * units[unit])
}

// Convert int number (bytes) to human-readable size format (eg. b, MiB, GiB, etc.)
export function numberToSize(num: number): string {
  if (num < 1024) {
    return `${num} B`
  }
  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  let unitIndex = -1
  let size = num

  do {
    size /= 1024
    unitIndex++
  } while (size >= 1024 && unitIndex < units.length - 1)

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

export function isBinaryContent(content: string) {
  // Scan the first 8192 decoded characters for null characters
  const sample = content.slice(0, 8192)
  return sample.includes('\0')
}

// Pluralize a word based on the count. Can pass a custom plural for irregular forms,
// eg. "1 layer" vs "2 layers" or "1 child" vs "2 children"
export function pluralize(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : (plural ?? singular + 's')}`
}

// Shortens a sha256 digest to a 7-char uppercase ID, e.g. "sha256:abcdef1..." → "ABCDEF1"
export function formatDigest(digest: string): string {
  if (!digest) {
    return ''
  }
  return digest.replace('sha256:', '').slice(0, 7).toUpperCase()
}

// Replaces anything that isn't alphanumeric, dot, dash, or underscore with an underscore — safe for filenames
export function sanitizePath(path: string): string {
  return path.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Kitfile layer paths ending with "/" are directories, not files
// @TODO: we might need a more robust check to determine this.
export function isPathFolder(path: string) {
  return path.endsWith('/')
}