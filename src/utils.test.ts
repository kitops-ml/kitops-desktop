import { describe, expect, it } from 'vitest'

import { formatDigest, isBinaryContent, isPathFolder, numberToSize, pluralize, sanitizePath, sizeToNumber } from './utils'

describe('sizeToNumber', () => {
  it('parses bare bytes', () => {
    expect(sizeToNumber('100b')).toBe(100)
  })

  it('parses KiB', () => {
    expect(sizeToNumber('1 KiB')).toBe(1024)
  })

  it('parses MiB', () => {
    expect(sizeToNumber('1.5 MiB')).toBe(1572864)
  })

  it('parses GiB', () => {
    expect(sizeToNumber('2 GiB')).toBe(2147483648)
  })

  it('is case-insensitive', () => {
    expect(sizeToNumber('1 mib')).toBe(sizeToNumber('1 MiB'))
  })

  it('throws on invalid input', () => {
    expect(() => sizeToNumber('not a size')).toThrow()
  })
})

describe('numberToSize', () => {
  it('formats values under 1024 as bytes', () => {
    expect(numberToSize(500)).toBe('500 B')
  })

  it('formats KiB', () => {
    expect(numberToSize(1024)).toBe('1.00 KiB')
  })

  it('formats MiB', () => {
    expect(numberToSize(1024 ** 2)).toBe('1.00 MiB')
  })

  it('formats GiB', () => {
    expect(numberToSize(1024 ** 3)).toBe('1.00 GiB')
  })
})

describe('isBinaryContent', () => {
  it('returns true when a null byte is present', () => {
    expect(isBinaryContent('hello\0world')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(isBinaryContent('name: my-model\nversion: 1.0')).toBe(false)
  })

  it('only scans the first 8192 characters', () => {
    const clean = 'a'.repeat(8193) + '\0'
    expect(isBinaryContent(clean)).toBe(false)
  })
})

describe('pluralize', () => {
  it('uses singular for count 1', () => {
    expect(pluralize(1, 'tag')).toBe('1 tag')
  })

  it('appends s for count 0', () => {
    expect(pluralize(0, 'tag')).toBe('0 tags')
  })

  it('appends s for count > 1', () => {
    expect(pluralize(3, 'tag')).toBe('3 tags')
  })

  it('uses custom plural form when provided', () => {
    expect(pluralize(2, 'repository', 'repositories')).toBe('2 repositories')
  })

  it('uses singular custom form when count is 1', () => {
    expect(pluralize(1, 'repository', 'repositories')).toBe('1 repository')
  })
})

describe('formatDigest', () => {
  it('strips the sha256: prefix and abbreviates to 7 chars', () => {
    expect(formatDigest('sha256:abcdef1234567890')).toBe('ABCDEF1')
  })

  it('uppercases the result', () => {
    expect(formatDigest('sha256:aabbccdd')).toBe('AABBCCD')
  })

  it('returns empty string for empty input', () => {
    expect(formatDigest('')).toBe('')
  })
})

describe('sanitizePath', () => {
  it('replaces slashes and colons with underscores', () => {
    expect(sanitizePath('jozu.ml/myorg/mymodel:latest')).toBe('jozu.ml_myorg_mymodel_latest')
  })

  it('leaves alphanumerics, dots, hyphens and underscores intact', () => {
    expect(sanitizePath('model.v1-final_2')).toBe('model.v1-final_2')
  })
})

describe('isPathFolder', () => {
  it('returns true for paths ending with /', () => {
    expect(isPathFolder('datasets/training/')).toBe(true)
  })

  it('returns false for file paths', () => {
    expect(isPathFolder('model/weights.bin')).toBe(false)
  })
})
