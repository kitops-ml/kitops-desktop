import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

import { getDefaultKitopsHome, installCommandLineTool } from './ipc/cli-setup.js'
import * as cliSetup from './ipc/cli-setup.js'
import * as credentials from './ipc/credentials.js'
import * as filesystem from './ipc/filesystem.js'
import * as kitCommands from './ipc/kit-commands.js'
import * as kitfiles from './ipc/kitfiles.js'
import * as env from './ipc/env.js'

import { setMainWindow } from './logging.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow
const getMainWindow = () => mainWindow

if (!process.env.KITOPS_HOME) {
  process.env.KITOPS_HOME = getDefaultKitopsHome()
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

  const cliToolItem = {
    label: 'Install Command Line Tool...',
    click: () => installCommandLineTool({ app, dialog }, getMainWindow),
  }

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
          cliToolItem,
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
    ...(!isMac ? [{ label: 'Tools', submenu: [cliToolItem] }] : []),
    helpMenu,
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

kitCommands.register(ipcMain)
filesystem.register({ ipcMain, dialog, shell }, getMainWindow)
kitfiles.register(ipcMain)
credentials.register({ ipcMain, safeStorage })
env.register(ipcMain)
cliSetup.register({ app, ipcMain, dialog }, getMainWindow)

app.whenReady().then(() => {
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
