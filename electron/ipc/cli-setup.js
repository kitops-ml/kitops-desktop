import { spawn } from 'child_process'
import { app } from 'electron'
import { createWriteStream } from 'fs'
import fs from 'fs/promises'
import http from 'http'
import https from 'https'
import os from 'os'
import path from 'path'

export function getDefaultKitopsHome() {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Caches', 'kitops')
    case 'linux':
      return process.env.XDG_DATA_HOME
        ? path.join(process.env.XDG_DATA_HOME, 'kitops')
        : path.join(os.homedir(), '.local', 'share', 'kitops')
    case 'win32':
      return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'kitops')
    default:
      return path.join(os.homedir(), '.kitops')
  }
}

function setupShellEnvironment(binaryPath, kitopsHome) {
  if (process.platform === 'win32') {
    return { pathSnippet: null, homeSnippet: null }
  }

  const installDir = path.dirname(binaryPath)
  return {
    pathSnippet: `export PATH="${installDir}:$PATH"`,
    homeSnippet: `export KITOPS_HOME="${kitopsHome}"`,
  }
}

function validateKitBinary(binPath) {
  return new Promise((resolve) => {
    const child = spawn(binPath, ['version'], { stdio: 'pipe' })
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

function getKitDownloadInfo() {
  const osMap = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
  const archMap = { arm64: 'arm64', x64: 'x86_64', ia32: 'i386' }
  const extMap = { darwin: 'zip', linux: 'tar.gz', win32: 'zip' }

  const osName = osMap[process.platform]
  const archName = archMap[process.arch]
  const ext = extMap[process.platform]

  if (!osName) {
    throw new Error(`Unsupported platform: ${process.platform}`)
  }
  if (!archName) {
    throw new Error(`Unsupported architecture: ${process.arch}`)
  }

  return {
    fileName: `kitops-${osName}-${archName}.${ext}`,
    ext,
    defaultHome: getDefaultKitopsHome(),
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const doRequest = (currentUrl) => {
      const mod = currentUrl.startsWith('https') ? https : http
      mod.get(currentUrl, { headers: { 'User-Agent': 'KitOps-Desktop' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`))
          return
        }
        const file = createWriteStream(destPath)
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
        file.on('error', reject)
      }).on('error', reject)
    }
    doRequest(url)
  })
}

function spawnAsync(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'pipe', ...options })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} failed with code ${code}`)))
  })
}

/**
 * Writes a platform-appropriate wrapper script for the kitflow CLI into the
 * same directory as the kit binary (userData/kitops/).  That directory is
 * already covered by the PATH snippet the app generates, so once the user has
 * done the one-time CLI setup, both `kit` and `kitflow` are available.
 *
 * The wrapper calls the bundled kitflow.cjs through Electron's own Node runtime
 * (ELECTRON_RUN_AS_NODE=1), so no separate Node.js installation is required.
 * Only runs when the app is packaged; silently skipped in development.
 */
export async function ensureKitflowWrapper() {
  if (!app.isPackaged) {
    return
  }

  const installDir = path.join(app.getPath('userData'), 'kitops')
  const kitflowBundleSrc = path.join(process.resourcesPath, 'kitflow.cjs')
  const kitflowBundle = path.join(installDir, 'kitflow.cjs')
  const electronBin = process.execPath

  try {
    await fs.mkdir(installDir, { recursive: true })
    await fs.copyFile(kitflowBundleSrc, kitflowBundle)

    if (process.platform === 'win32') {
      await fs.writeFile(
        path.join(installDir, 'kitflow.cmd'),
        `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${electronBin}" "${kitflowBundle}" %*\r\n`,
      )
    } else {
      const wrapperPath = path.join(installDir, 'kitflow')
      await fs.writeFile(
        wrapperPath,
        `#!/bin/sh\nexec env ELECTRON_RUN_AS_NODE=1 "${electronBin}" "${kitflowBundle}" "$@"\n`,
      )
      await fs.chmod(wrapperPath, 0o755)
    }
  } catch (e) {
    console.error('Failed to write kitflow wrapper:', e.message)
  }
}

export function register({ app, ipcMain }) {
  ipcMain.handle('kit:getShellSnippets', () => {
    const kitPath = process.env.KITOPS_CLI_PATH
    const kitopsHome = process.env.KITOPS_HOME || getDefaultKitopsHome()
    if (!kitPath) {
      return { pathSnippet: null, homeSnippet: null }
    }
    return setupShellEnvironment(kitPath, kitopsHome)
  })

  ipcMain.handle('kit:checkInstalled', async () => {
    if (process.env.KITOPS_CLI_PATH && await validateKitBinary(process.env.KITOPS_CLI_PATH)) {
      return { installed: true }
    }

    if (await validateKitBinary('kit')) {
      try {
        const cmd = process.platform === 'win32' ? 'where' : 'which'
        const resolvedPath = await fs.realpath(
          await new Promise((resolve, reject) => {
            const child = spawn(cmd, ['kit'], { stdio: ['pipe', 'pipe', 'pipe'] })
            let stdout = ''
            child.stdout.on('data', (data) => {
              stdout += data.toString()
            })
            child.on('error', reject)
            child.on('close', (code) => code === 0 ? resolve(stdout.trim().split('\n')[0]) : reject(new Error('not found')))
          }),
        )
        if (resolvedPath) {
          process.env.KITOPS_CLI_PATH = resolvedPath
        }
      } catch {
        // not critical
      }
      return { installed: true }
    }

    const binaryName = process.platform === 'win32' ? 'kit.exe' : 'kit'
    const appKitPath = path.join(app.getPath('userData'), 'kitops', binaryName)
    if (await validateKitBinary(appKitPath)) {
      process.env.KITOPS_CLI_PATH = appKitPath
      return { installed: true }
    }

    return { installed: false }
  })

  ipcMain.handle('kit:setCliPath', async (e, kitBinaryPath) => {
    try {
      await spawnAsync(kitBinaryPath, ['version'])
      process.env.KITOPS_CLI_PATH = kitBinaryPath
      return { success: true }
    } catch (error) {
      return { success: false, error: `Not a valid kit binary: ${error.message}` }
    }
  })

  ipcMain.handle('kit:installKit', async () => {
    const { fileName, ext, defaultHome } = getKitDownloadInfo()
    const installDir = path.join(app.getPath('userData'), 'kitops')
    const downloadUrl = `https://github.com/kitops-ml/kitops/releases/latest/download/${fileName}`
    const archivePath = path.join(installDir, fileName)

    try {
      await fs.mkdir(installDir, { recursive: true })
      await downloadFile(downloadUrl, archivePath)

      if (ext === 'zip') {
        if (process.platform === 'win32') {
          await spawnAsync('powershell', ['-Command', `Expand-Archive -Path "${archivePath}" -DestinationPath "${installDir}" -Force`])
        } else {
          await spawnAsync('unzip', ['-o', archivePath, '-d', installDir])
        }
      } else {
        await spawnAsync('tar', ['-xzf', archivePath, '-C', installDir])
      }

      const binaryName = process.platform === 'win32' ? 'kit.exe' : 'kit'
      const binaryPath = path.join(installDir, binaryName)

      if (process.platform !== 'win32') {
        await fs.chmod(binaryPath, 0o755)
      }

      await spawnAsync(binaryPath, ['version'])

      process.env.KITOPS_CLI_PATH = binaryPath
      process.env.KITOPS_HOME = defaultHome

      const shellSetup = setupShellEnvironment(binaryPath, defaultHome)
      await fs.unlink(archivePath).catch(() => { })

      return { success: true, kitPath: binaryPath, kitopsHome: defaultHome, ...shellSetup }
    } catch (error) {
      await fs.unlink(archivePath).catch(() => { })
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('kit:getCliPath', () => process.env.KITOPS_CLI_PATH || 'kit')

  ipcMain.handle('kit:isAppInstalled', async () => {
    const binaryName = process.platform === 'win32' ? 'kit.exe' : 'kit'
    const appKitPath = path.join(app.getPath('userData'), 'kitops', binaryName)
    const currentPath = process.env.KITOPS_CLI_PATH || ''
    try {
      const [resolvedCurrent, resolvedApp] = await Promise.all([
        fs.realpath(currentPath).catch(() => currentPath),
        fs.realpath(appKitPath).catch(() => appKitPath),
      ])
      return resolvedCurrent === resolvedApp
    } catch {
      return false
    }
  })

  ipcMain.handle('app:removeData', async (e, { includeModelKits = false } = {}) => {
    try {
      const userData = app.getPath('userData')
      await fs.rm(userData, { recursive: true, force: true })

      if (includeModelKits) {
        const kitopsHome = process.env.KITOPS_HOME || getDefaultKitopsHome()
        await fs.rm(kitopsHome, { recursive: true, force: true })
      }

      app.quit()
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('app:quit', () => app.quit())
}
