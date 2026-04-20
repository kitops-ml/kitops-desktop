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

// Converts an absolute path to a relative path from baseDir.
// Returns the original path unchanged if it is already relative or if baseDir is empty.
// Preserves trailing separators and prefixes sub-paths with ./
export function toRelativePath(path: string, baseDir: string): string {
  if (!baseDir || !window.kitops.fs.pathIsAbsolute(path)) {
    return path
  }

  const sep = window.kitops.fs.pathSep
  const trailingSlash = path.endsWith('/') || path.endsWith('\\') ? path[path.length - 1] : ''
  const cleanPath = trailingSlash ? path.slice(0, -1) : path

  const relative = window.kitops.fs.pathRelative(baseDir, cleanPath)

  if (relative === '') {
    return '.' + sep
  }

  // pathRelative returns an absolute path when no relative path is possible (e.g. Windows cross-drive)
  if (window.kitops.fs.pathIsAbsolute(relative)) {
    return path
  }

  const withTrailing = relative + trailingSlash
  return relative.startsWith('..') ? withTrailing : '.' + sep + withTrailing
}

// Formats a duration in milliseconds as a short human-readable string
export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

// Returns a human-readable relative time string, e.g. "5m ago", "2h ago", "Never"
export function relativeTime(isoString: string | null): string {
  if (!isoString) {
    return 'Never'
  }
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) {
    return 'Just now'
  }
  if (mins < 60) {
    return `${mins}m ago`
  }
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) {
    return `${hrs}h ago`
  }
  const days = Math.floor(hrs / 24)
  if (days < 7) {
    return `${days}d ago`
  }
  return `${Math.floor(days / 7)}w ago`
}

// Convert dash-case to camelCase, e.g. "tls-verify" → "tlsVerify"
export function toCamelCase(key: string): string {
  return key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

// Cleans up IPC and kitops-ts error messages by removing boilerplate, version notices, and noise
// Returns a short, user-friendly error message
export function cleanIpcError(message: string): string {
  // Remove IPC wrapper prefix (e.g., "Error invoking remote method 'kit:pull': ")
  let cleaned = message.replace(/^Error invoking remote method '[^']+': /, '')

  // Remove "Kit command failed with exit code X: " prefix
  cleaned = cleaned.replace(/^Kit command failed with exit code \d+: /, '')

  // Remove version update notification that spans multiple lines
  cleaned = cleaned.replace(
    /Note: A new version of Kit is available!.*?show-update-notifications=false'\s*/s,
    '',
  )

  // Extract the actual error message after [ERROR] if it exists
  const errorMatch = cleaned.match(/\[ERROR\]\s*(.+?)(?:\s*$|(?=\[))/s)
  if (errorMatch) {
    cleaned = errorMatch[1]
  }

  // Clean up common error patterns for readability
  // Simplify credential and network errors
  if (cleaned.includes('docker-credential')) {
    // Extract just the key part of credential errors
    const credMatch = cleaned.match(/(Failed to fetch [^:]+):|exec: "([^"]+)": ([^"]+)/)
    if (credMatch) {
      cleaned = credMatch[1] || `${credMatch[2]}: ${credMatch[3]}`
    }
  }

  return cleaned.trim()
}