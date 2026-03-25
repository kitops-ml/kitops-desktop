import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export function register({ ipcMain, dialog, shell }, getMainWindow) {
  ipcMain.handle('kit:readFile', async (e, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('kit:writeFile', async (e, filePath, content) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('kit:fileExists', async (e, filePath) => {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('kit:getTempDir', (e, subfolder) => path.join(os.tmpdir(), subfolder || 'kitops-desktop'))

  ipcMain.handle('kit:listDir', async (e, dirPath) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return {
        success: true,
        files: entries.map(entry => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
        })),
      }
    } catch (error) {
      return { success: false, error: error.message, files: [] }
    }
  })

  ipcMain.handle('dialog:selectDirectory', async (e, options = {}) => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ['openDirectory', 'createDirectory'],
      title: options.title || 'Select Directory',
      defaultPath: options.defaultPath || os.homedir(),
      buttonLabel: options.buttonLabel || 'Select',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, path: result.filePaths[0] }
  })

  ipcMain.handle('dialog:selectPath', async (e, options = {}) => {
    const properties = ['openFile', 'openDirectory']
    if (options.multiple) {
      properties.push('multiSelections')
    }
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties,
      title: options.title || 'Select',
      defaultPath: options.defaultPath || os.homedir(),
      buttonLabel: options.buttonLabel || 'Select',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, path: result.filePaths[0], paths: result.filePaths }
  })

  ipcMain.handle('dialog:selectFile', async (e, options = {}) => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ['openFile'],
      title: options.title || 'Select File',
      defaultPath: options.defaultPath || os.homedir(),
      buttonLabel: options.buttonLabel || 'Select',
      filters: options.filters || [],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, path: result.filePaths[0] }
  })

  ipcMain.handle('shell:showInFolder', (e, filePath) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('shell:openExternal', async (e, url) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('kit:deleteDir', async (e, dirPath) => {
    try {
      await fs.rm(dirPath, { recursive: true, force: true })
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}
