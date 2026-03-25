import { describe, expect, it } from 'vitest'

import { validateRepositoryName } from './validateRepositoryName'

describe('validateRepositoryName', () => {
  it('returns empty string for empty input', () => {
    expect(validateRepositoryName('')).toBe('')
  })

  it('accepts a simple name', () => {
    expect(validateRepositoryName('mymodel')).toBe('')
  })

  it('accepts a name with hyphens', () => {
    expect(validateRepositoryName('my-model')).toBe('')
  })

  it('accepts a name with a single underscore', () => {
    expect(validateRepositoryName('my_model')).toBe('')
  })

  it('accepts a name with double underscore', () => {
    expect(validateRepositoryName('my__model')).toBe('')
  })

  it('accepts a name with dots', () => {
    expect(validateRepositoryName('my.model')).toBe('')
  })

  it('accepts a multi-segment path', () => {
    expect(validateRepositoryName('myorg/mymodel')).toBe('')
  })

  it('accepts a deeply nested path', () => {
    expect(validateRepositoryName('myorg/sub/mymodel')).toBe('')
  })

  it('accepts mixed separators across segments', () => {
    expect(validateRepositoryName('my-org/my_model/v1.0')).toBe('')
  })

  it('is case-insensitive (accepts uppercase input)', () => {
    expect(validateRepositoryName('MyModel')).toBe('')
  })

  it('rejects a name starting with a hyphen', () => {
    expect(validateRepositoryName('-mymodel')).toBe('Must start with a letter or number')
  })

  it('rejects a name starting with an underscore', () => {
    expect(validateRepositoryName('_mymodel')).toBe('Must start with a letter or number')
  })

  it('rejects a name starting with a dot', () => {
    expect(validateRepositoryName('.mymodel')).toBe('Must start with a letter or number')
  })

  it('rejects triple underscores', () => {
    expect(validateRepositoryName('my___model')).toBe('Must contain only letters, numbers, hyphens and underscores')
  })

  it('rejects consecutive slashes', () => {
    expect(validateRepositoryName('myorg//mymodel')).toBe('Must contain only letters, numbers, hyphens and underscores')
  })

  it('rejects trailing slash', () => {
    expect(validateRepositoryName('myorg/mymodel/')).toBe('Must contain only letters, numbers, hyphens and underscores')
  })

  it('rejects spaces', () => {
    expect(validateRepositoryName('my model')).toBe('Must contain only letters, numbers, hyphens and underscores')
  })
})
