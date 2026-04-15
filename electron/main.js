import { execFileSync } from 'child_process'
import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

import * as cliSetup from './ipc/cli-setup.js'
import * as credentials from './ipc/credentials.js'
import * as env from './ipc/env.js'
import * as filesystem from './ipc/filesystem.js'
import * as kitCommands from './ipc/kit-commands.js'
import * as kitfiles from './ipc/kitfiles.js'
import * as kitflow from './ipc/kitflow.js'
import * as modelkitLogs from './ipc/modelkit-logs.js'
import { setMainWindow } from './logging.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow
const getMainWindow = () => mainWindow

// Holds a protocol URL that arrived before the window was ready (cold start).
let pendingProtocolUrl = null

function sendProtocolUrl(url) {
  const win = getMainWindow()
  if (win && win.webContents) {
    win.webContents.send('app:protocol-url', url)
  } else {
    pendingProtocolUrl = url
  }
}

// macOS: fires for both cold-start and warm-start deep links.
app.on('open-url', (event, url) => {
  event.preventDefault()
  sendProtocolUrl(url)
})

// Ensure only one instance runs; the second instance passes its args to the first.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Windows / Linux: URL is a CLI argument in the second instance's argv.
    const url = commandLine.find(arg => arg.startsWith('kitops://'))
    if (url) {
      sendProtocolUrl(url)
    }
    // Bring the existing window to focus.
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })
}

if (!process.env.KITOPS_HOME) {
  process.env.KITOPS_HOME = cliSetup.getDefaultKitopsHome()
}

// On non-Windows platforms, apps launched from a GUI (Dock/Finder/DE) have a
// limited PATH. We read the full PATH from the login shell to ensure tools like
// docker-credential-osxkeychain work when the kit CLI runs.
// This is important for `kit login` command.
if (process.platform !== 'win32') {
  try {
    const loginShell = process.env.SHELL || '/bin/sh'
    const output = execFileSync(loginShell, ['-l', '-c', "printf '%s' \"$PATH\""], { timeout: 2000, encoding: 'utf8' })
    const loginPath = output.split('\n')[0].trim()
    if (loginPath) {
      process.env.PATH = loginPath
    }
  } catch {
    // keep whatever PATH we already have
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  setMainWindow(mainWindow)

  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable && !params.selectionText) {
      return
    }

    const menuItems = []

    if (params.isEditable) {
      menuItems.push(
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', enabled: params.editFlags.canSelectAll },
      )
    } else if (params.selectionText) {
      menuItems.push({ role: 'copy', enabled: params.editFlags.canCopy })
    }

    Menu.buildFromTemplate(menuItems).popup({ window: mainWindow })
  })

  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingProtocolUrl) {
      mainWindow.webContents.send('app:protocol-url', pendingProtocolUrl)
      pendingProtocolUrl = null
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function sendMenuAction(action) {
  const win = getMainWindow()
  if (win) {
    win.webContents.send('menu:action', action)
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin'

  const fileMenu = {
    label: 'File',
    submenu: [
      {
        label: 'New Kitfile',
        accelerator: 'CmdOrCtrl+N',
        click: () => sendMenuAction('kitfiles:new'),
      },
      {
        label: 'Import Kitfile...',
        accelerator: 'CmdOrCtrl+I',
        click: () => sendMenuAction('kitfiles:import'),
      },
      { type: 'separator' },
      {
        label: 'All ModelKits',
        click: () => sendMenuAction('modelkits:list'),
      },
      {
        label: 'Pull ModelKit...',
        click: () => sendMenuAction('modelkits:pull'),
      },
      ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : []),
    ],
  }

  const goMenu = {
    label: 'Go',
    submenu: [
      {
        label: 'ModelKits',
        accelerator: 'CmdOrCtrl+1',
        click: () => sendMenuAction('navigate:home'),
      },
      {
        label: 'Disk Usage',
        accelerator: 'CmdOrCtrl+2',
        click: () => sendMenuAction('navigate:disk-usage'),
      },
      {
        label: 'Logs',
        accelerator: 'CmdOrCtrl+3',
        click: () => sendMenuAction('navigate:logs'),
      },
      { type: 'separator' },
      {
        label: 'Settings',
        accelerator: isMac ? 'Cmd+,' : 'Ctrl+,',
        click: () => sendMenuAction('navigate:settings'),
      },
    ],
  }

  const helpMenu = {
    role: 'help',
    submenu: [
      {
        label: 'KitOps Documentation',
        click: () => shell.openExternal('https://kitops.org/docs/overview'),
      },
      {
        label: 'KitOps Website',
        click: () => shell.openExternal('https://kitops.org'),
      },
      { type: 'separator' },
      {
        label: 'Jozu Hub',
        click: () => shell.openExternal('https://jozu.ml'),
      },
      {
        label: 'Jozu',
        click: () => shell.openExternal('https://jozu.com'),
      },
      ...(!isMac ? [{ type: 'separator' }, { role: 'about' }] : []),
    ],
  }

  const template = [
    ...(isMac
      ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      }]
      : []),
    fileMenu,
    { role: 'editMenu' },
    ...(!app.isPackaged ? [{ role: 'viewMenu' }] : []),
    goMenu,
    { role: 'windowMenu' },
    helpMenu,
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

kitCommands.register(ipcMain)
kitflow.register(ipcMain)
filesystem.register({ ipcMain, dialog, shell }, getMainWindow)
kitfiles.register(ipcMain)
modelkitLogs.register(ipcMain)
credentials.register({ ipcMain, safeStorage })
env.register(ipcMain)
cliSetup.register({ app, ipcMain })

app.whenReady().then(() => {
  // Register as the default handler for kitops:// links.
  app.setAsDefaultProtocolClient('kitops')

  // Windows / Linux cold-start: URL is passed as a command-line argument.
  if (process.platform !== 'darwin') {
    const url = process.argv.find(arg => arg.startsWith('kitops://'))
    if (url) {
      pendingProtocolUrl = url
    }
  }

  buildMenu()
  createWindow()
  modelkitLogs.pruneOldLogs().catch(() => { })
  cliSetup.ensureKitflowWrapper()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
