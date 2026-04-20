import * as nodePath from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toRelativePath } from '../../utils'

function mockFs(sep: string) {
  const pathImpl = sep === '/' ? nodePath.posix : nodePath.win32
  vi.stubGlobal('window', {
    kitops: {
      fs: {
        pathSep: sep,
        pathIsAbsolute: (p: string) => pathImpl.isAbsolute(p),
        pathRelative: (from: string, to: string) => pathImpl.relative(from, to),
        pathJoin: (...args: string[]) => pathImpl.join(...args),
      },
    },
  })
}

// Unix separator tests
describe('toRelativePath (unix)', () => {
  const sep = '/'

  beforeEach(() => mockFs(sep))

  it('returns a ./ path for a file directly inside the base dir', () => {
    expect(toRelativePath('/home/user/project/model.pt', '/home/user/project')).toBe('./model.pt')
  })

  it('returns a ./ path for a nested file inside the base dir', () => {
    expect(toRelativePath('/home/user/project/weights/model.pt', '/home/user/project')).toBe('./weights/model.pt')
  })

  it('returns ../ path for a file outside the base dir', () => {
    expect(toRelativePath('/home/user/data/dataset.csv', '/home/user/project')).toBe('../data/dataset.csv')
  })

  it('returns multiple ../ for a file with no common ancestor below root', () => {
    expect(toRelativePath('/tmp/model.pt', '/home/user/project')).toBe('../../../tmp/model.pt')
  })

  it('returns ./ when path equals baseDir', () => {
    expect(toRelativePath('/home/user/project', '/home/user/project')).toBe('./')
  })

  it('returns the original path when already relative', () => {
    expect(toRelativePath('./model.pt', '/home/user/project')).toBe('./model.pt')
  })

  it('returns the original path when baseDir is empty', () => {
    expect(toRelativePath('/home/user/project/model.pt', '')).toBe('/home/user/project/model.pt')
  })

  it('handles a trailing slash in the file path gracefully', () => {
    const result = toRelativePath('/home/user/project/data/', '/home/user/project')
    expect(result).toBe('./data/')
  })
})

// Windows separator tests
describe('toRelativePath (windows)', () => {
  const sep = '\\'

  beforeEach(() => mockFs(sep))

  it('returns a .\\ path for a file directly inside the base dir', () => {
    expect(toRelativePath('C:\\Users\\user\\project\\model.pt', 'C:\\Users\\user\\project')).toBe('.\\model.pt')
  })

  it('returns ..\\ path for a file outside the base dir on the same drive', () => {
    expect(toRelativePath('C:\\Users\\user\\data\\dataset.csv', 'C:\\Users\\user\\project')).toBe('..\\data\\dataset.csv')
  })

  it('returns the original absolute path when drives differ (no relative path possible)', () => {
    expect(toRelativePath('D:\\models\\file.pt', 'C:\\Users\\project')).toBe('D:\\models\\file.pt')
  })

  it('handles UNC paths within the same share', () => {
    expect(toRelativePath('\\\\server\\share\\models\\file.pt', '\\\\server\\share\\project')).toBe('..\\models\\file.pt')
  })

  it('returns the original path when already relative', () => {
    expect(toRelativePath('model\\weights.bin', 'C:\\Users\\project')).toBe('model\\weights.bin')
  })

  it('returns the original path when baseDir is empty', () => {
    expect(toRelativePath('C:\\Users\\project\\model.pt', '')).toBe('C:\\Users\\project\\model.pt')
  })
})
