export function register(ipcMain) {
  ipcMain.handle('env:get', (e, key) => {
    return process.env[key] || null
  })
}