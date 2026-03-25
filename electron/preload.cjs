const { ipcRenderer } = require('electron')
const path = require('path')

// use kitops as the namespace
window.kitops = {
  // kit cli related actions
  kit: {
    version: () => ipcRenderer.invoke('kit:version'),
    checkUpdate: () => ipcRenderer.invoke('kit:checkUpdate'),
    list: (repository) => ipcRenderer.invoke('kit:list', repository),
    init: (directory, flags) => ipcRenderer.invoke('kit:init', directory, flags),
    info: (path, flags) => ipcRenderer.invoke('kit:info', path, flags),
    inspect: (path, flags) => ipcRenderer.invoke('kit:inspect', path, flags),
    push: (source, destination, flags) => ipcRenderer.invoke('kit:push', source, destination, flags),
    pull: (path, flags) => ipcRenderer.invoke('kit:pull', path, flags),
    pack: (directory, flags) => ipcRenderer.invoke('kit:pack', directory, flags),
    unpack: (path, flags) => ipcRenderer.invoke('kit:unpack', path, flags),
    remove: (path, flags) => ipcRenderer.invoke('kit:remove', path, flags),
    removeAll: (force) => ipcRenderer.invoke('kit:removeAll', force),
    tag: (source, destination) => ipcRenderer.invoke('kit:tag', source, destination),
    diff: (reference1, reference2) => ipcRenderer.invoke('kit:diff', reference1, reference2),

    login: (registry, username, password, flags) => ipcRenderer.invoke('kit:login', registry, username, password, flags),
    loginUnsafe: (registry, username, password, flags) => ipcRenderer.invoke('kit:loginUnsafe', registry, username, password, flags),
    logout: (registry) => ipcRenderer.invoke('kit:logout', registry),

    checkInstalled: () => ipcRenderer.invoke('kit:checkInstalled'),
    setCliPath: (kitBinaryPath) => ipcRenderer.invoke('kit:setCliPath', kitBinaryPath),
    installKit: () => ipcRenderer.invoke('kit:installKit'),
    installCommandLineTool: () => ipcRenderer.invoke('kit:installCommandLineTool'),
    getCliPath: () => ipcRenderer.invoke('kit:getCliPath'),

  },

  credentials: {
    set: (registry, username, password) => ipcRenderer.invoke('credentials:set', registry, username, password),
    get: (registry) => ipcRenderer.invoke('credentials:get', registry),
    has: (registry) => ipcRenderer.invoke('credentials:has', registry),
    delete: (registry) => ipcRenderer.invoke('credentials:delete', registry),
    list: () => ipcRenderer.invoke('credentials:list'),
  },

  kitfiles: {
    list: () => ipcRenderer.invoke('kitfiles:list'),
    add: (kitfilePath) => ipcRenderer.invoke('kitfiles:add', kitfilePath),
    update: (id, updates) => ipcRenderer.invoke('kitfiles:update', id, updates),
    remove: (id) => ipcRenderer.invoke('kitfiles:remove', id),
    duplicate: (id, mode) => ipcRenderer.invoke('kitfiles:duplicate', id, mode),
    refresh: (id) => ipcRenderer.invoke('kitfiles:refresh', id),
  },

  fs: {
    readFile: (filePath) => ipcRenderer.invoke('kit:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('kit:writeFile', filePath, content),
    fileExists: (filePath) => ipcRenderer.invoke('kit:fileExists', filePath),
    getTempDir: (subfolder) => ipcRenderer.invoke('kit:getTempDir', subfolder),
    listDir: (dirPath) => ipcRenderer.invoke('kit:listDir', dirPath),
    deleteDir: (dirPath) => ipcRenderer.invoke('kit:deleteDir', dirPath),
    pathJoin: (...args) => path.join(...args),
  },

  dialog: {
    selectDirectory: (options) => ipcRenderer.invoke('dialog:selectDirectory', options),
    selectFile: (options) => ipcRenderer.invoke('dialog:selectFile', options),
    selectPath: (options) => ipcRenderer.invoke('dialog:selectPath', options),
  },

  shell: {
    showInFolder: (filePath) => ipcRenderer.invoke('shell:showInFolder', filePath),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    quitApp: () => ipcRenderer.invoke('app:quit'),
  },

  app: {
    onLog: (callback) => {
      ipcRenderer.on('log', (event, log) => callback(log))
    },
    removeLogListener: () => {
      ipcRenderer.removeAllListeners('log')
    },
    onMenuAction: (callback) => {
      ipcRenderer.on('menu:action', (event, action) => callback(action))
    },
    removeMenuActionListener: () => {
      ipcRenderer.removeAllListeners('menu:action')
    },
    removeData: (options) => ipcRenderer.invoke('app:removeData', options),
  },

  env: {
    get: (key) => ipcRenderer.invoke('env:get', key),
  },
}
