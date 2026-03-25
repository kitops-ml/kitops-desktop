import { jsonStore } from '../store.js'

const store = jsonStore('credentials.json')

export function register({ ipcMain, safeStorage }) {
  ipcMain.handle('credentials:set', async (e, registry, username, password) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is not available on this system')
    }

    const credentials = await store.load({})
    credentials[registry] = {
      username,
      // latin1 round-trips arbitrary bytes through JSON without corruption
      password: safeStorage.encryptString(password).toString('latin1'),
    }

    await store.save(credentials)
    return { success: true }
  })

  ipcMain.handle('credentials:get', async (e, registry) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is not available on this system')
    }

    const credentials = await store.load({})
    const stored = credentials[registry]
    if (!stored) {
      return null
    }

    return {
      username: stored.username,
      password: safeStorage.decryptString(Buffer.from(stored.password, 'latin1')),
    }
  })

  ipcMain.handle('credentials:has', async (e, registry) => {
    const credentials = await store.load({})
    return registry in credentials
  })

  ipcMain.handle('credentials:delete', async (e, registry) => {
    const credentials = await store.load({})
    delete credentials[registry]
    await store.save(credentials)
    return { success: true }
  })

  ipcMain.handle('credentials:list', async () => {
    const credentials = await store.load({})
    return Object.keys(credentials).map(registry => ({
      registry,
      username: credentials[registry].username,
    }))
  })
}
