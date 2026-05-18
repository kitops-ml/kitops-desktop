import * as kitops from '@kitops/kitops-ts'

import { withLogging } from '../logging.js'

export function register(ipcMain) {
  ipcMain.handle('kit:version', () => withLogging('version', null, kitops.version))

  ipcMain.handle('kit:checkUpdate', async () => {
    const result = await kitops.kit('version')
    const match = result.stderr
      .match(/You are using Kit v([\d.]+)\. The latest version is v([\d.]+)[\s\S]*?(https:\/\/\S+)/)

    if (!match) {
      return null
    }
    return { current: match[1], latest: match[2], url: match[3] }
  })

  ipcMain.handle('kit:list', () => withLogging('list', null, kitops.list))

  ipcMain.handle('kit:init', (e, directory, flags) =>
    withLogging('init', { directory, flags }, () => kitops.init(directory, flags)),
  )

  ipcMain.handle('kit:inspect', (e, path, flags, modelkitDigest) =>
    withLogging('inspect', { path, flags }, () => kitops.inspect(path, flags), modelkitDigest),
  )

  ipcMain.handle('kit:push', (e, source, destination, flags, modelkitDigest) =>
    withLogging('push', { source, destination, flags }, () => kitops.push(source, destination || undefined, flags), modelkitDigest),
  )

  ipcMain.handle('kit:pull', (e, options) => {
    const reference = typeof options === 'string' ? options : options.reference
    const flags = typeof options === 'string' ? undefined : options.flags
    return withLogging('pull', { reference, flags }, () => kitops.pull(reference, flags))
  })

  ipcMain.handle('kit:info', (e, path, flags, modelkitDigest) => {
    return withLogging('info', { path, flags }, () => kitops.info(path, flags), modelkitDigest)
  })

  ipcMain.handle('kit:unpack', (e, path, flags, modelkitDigest) =>
    withLogging('unpack', { path, flags }, () => kitops.unpack(path, flags), modelkitDigest),
  )

  ipcMain.handle('kit:pack', (e, directory, flags) =>
    withLogging('pack', { directory, flags }, () => kitops.pack(directory, flags)),
  )

  ipcMain.handle('kit:remove', (e, path, flags = {}, modelkitDigest) =>
    withLogging('remove', { path, flags }, () => kitops.remove(path, flags), modelkitDigest),
  )

  ipcMain.handle('kit:removeAll', (e, force = false) =>
    withLogging('remove --all', { force }, () => kitops.remove('', { all: true, ...(force ? { force: true } : {}) })),
  )

  ipcMain.handle('kit:login', (e, registry, username, password, flags) =>
    withLogging('login', { registry, username, flags }, () => kitops.login(registry, username, password, flags)),
  )

  ipcMain.handle('kit:loginUnsafe', (e, registry, username, password, flags) =>
    withLogging('login', { registry, username, flags }, () => kitops.loginUnsafe(registry, username, password, flags)),
  )

  ipcMain.handle('kit:logout', (e, registry) =>
    withLogging('logout', { registry }, () => kitops.logout(registry)),
  )

  ipcMain.handle('kit:tag', (e, source, destination, modelkitDigest) =>
    withLogging('tag', { source, destination }, () => kitops.tag(source, destination), modelkitDigest),
  )

  ipcMain.handle('kit:diff', (e, reference1, reference2) =>
    withLogging('diff', { reference1, reference2 }, () => kitops.diff(reference1, reference2)),
  )
}
