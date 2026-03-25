import { spawn } from 'child_process'
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

function getShellProfilePath() {
  const shell = process.env.SHELL || ''
  return shell.includes('zsh')
    ? path.join(os.homedir(), '.zshrc')
    : path.join(os.homedir(), '.bashrc')
}

async function setupShellEnvironment(binaryPath, kitopsHome, { createSymlink = true } = {}) {
  const result = { symlinked: false, shellProfileUpdated: false, shellProfile: null, pathAdded: false }
  if (process.platform === 'win32') {
    return result
  }

  const installDir = path.dirname(binaryPath)

  if (createSymlink) {
    const symlinkPath = '/usr/local/bin/kit'
    if (process.platform === 'darwin') {
      try {
        await new Promise((resolve, reject) => {
          const script = `do shell script "ln -sf '${binaryPath}' '${symlinkPath}'" with administrator privileges`
          const child = spawn('osascript', ['-e', script], { stdio: 'pipe' })
          child.on('error', reject)
          child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`osascript failed: ${code}`)))
        })
        result.symlinked = true
      } catch {
        // user cancelled or it failed, fall back to PATH
      }
    } else {
      try {
        await fs.unlink(symlinkPath).catch(() => { })
        await fs.symlink(binaryPath, symlinkPath)
        result.symlinked = true
      } catch {
        // no permission, fall back to PATH
      }
    }
  }

  const shellProfile = getShellProfilePath()
  result.shellProfile = shellProfile

  try {
    const profileContent = await fs.readFile(shellProfile, 'utf-8').catch(() => '')
    const lines = []

    if (!profileContent.includes('KITOPS_HOME')) {
      lines.push(`export KITOPS_HOME="${kitopsHome}"`)
    }
    if (!result.symlinked && !profileContent.includes(installDir)) {
      lines.push(`export PATH="${installDir}:$PATH"`)
      result.pathAdded = true
    }

    if (lines.length > 0) {
      await fs.appendFile(shellProfile, `\n# KitOps (added by KitOps Desktop)\n${lines.join('\n')}\n\n`, 'utf-8')
      result.shellProfileUpdated = true
    }
  } catch (err) {
    console.error('Failed to update shell profile:', err.message)
  }

  return result
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

export async function installCommandLineTool({ dialog }, getMainWindow) {
  const kitPath = process.env.KITOPS_CLI_PATH
  const kitopsHome = process.env.KITOPS_HOME || getDefaultKitopsHome()

  if (!kitPath || !await validateKitBinary(kitPath)) {
    dialog.showMessageBox(getMainWindow(), {
      type: 'warning',
      title: 'Kit CLI Not Installed',
      message: 'Kit CLI is not installed yet. Use the setup dialog to install it first.',
      buttons: ['OK'],
    })
    return
  }

  const result = await setupShellEnvironment(kitPath, kitopsHome)

  const details = []
  if (result.symlinked) {
    details.push('Symlink created at /usr/local/bin/kit')
  }
  if (result.pathAdded) {
    details.push(`Kit added to PATH in ${result.shellProfile}`)
  }
  if (result.shellProfileUpdated) {
    details.push(`KITOPS_HOME configured in ${result.shellProfile}`)
  }

  if (details.length === 0) {
    details.push('Command line tool is already configured.')
  } else {
    details.push('\nOpen a new terminal for changes to take effect.')
  }

  dialog.showMessageBox(getMainWindow(), {
    type: 'info',
    title: 'Command Line Tool',
    message: 'Command Line Tool Setup',
    detail: details.join('\n'),
    buttons: ['OK'],
  })
}

export function register({ app, ipcMain, dialog }, getMainWindow) {
  ipcMain.handle('kit:installCommandLineTool', () => installCommandLineTool({ app, dialog }, getMainWindow))

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

      const shellSetup = await setupShellEnvironment(binaryPath, defaultHome)
      await fs.unlink(archivePath).catch(() => { })

      return { success: true, kitPath: binaryPath, kitopsHome: defaultHome, ...shellSetup }
    } catch (error) {
      await fs.unlink(archivePath).catch(() => { })
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('kit:getCliPath', () => process.env.KITOPS_CLI_PATH || 'kit')

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
