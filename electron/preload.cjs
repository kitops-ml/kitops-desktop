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
    info: (path, flags, modelkitDigest) => ipcRenderer.invoke('kit:info', path, flags, modelkitDigest),
    inspect: (path, flags, modelkitDigest) => ipcRenderer.invoke('kit:inspect', path, flags, modelkitDigest),
    push: (source, destination, flags, modelkitDigest) => ipcRenderer.invoke('kit:push', source, destination, flags, modelkitDigest),
    pull: (path, flags) => ipcRenderer.invoke('kit:pull', path, flags),
    pack: (directory, flags) => ipcRenderer.invoke('kit:pack', directory, flags),
    unpack: (path, flags, modelkitDigest) => ipcRenderer.invoke('kit:unpack', path, flags, modelkitDigest),
    remove: (path, flags, modelkitDigest) => ipcRenderer.invoke('kit:remove', path, flags, modelkitDigest),
    removeAll: (force) => ipcRenderer.invoke('kit:removeAll', force),
    tag: (source, destination, modelkitDigest) => ipcRenderer.invoke('kit:tag', source, destination, modelkitDigest),
    diff: (reference1, reference2) => ipcRenderer.invoke('kit:diff', reference1, reference2),

    login: (registry, username, password, flags) => ipcRenderer.invoke('kit:login', registry, username, password, flags),
    loginUnsafe: (registry, username, password, flags) => ipcRenderer.invoke('kit:loginUnsafe', registry, username, password, flags),
    logout: (registry) => ipcRenderer.invoke('kit:logout', registry),

    checkInstalled: () => ipcRenderer.invoke('kit:checkInstalled'),
    setCliPath: (kitBinaryPath) => ipcRenderer.invoke('kit:setCliPath', kitBinaryPath),
    installKit: () => ipcRenderer.invoke('kit:installKit'),
    getShellSnippets: () => ipcRenderer.invoke('kit:getShellSnippets'),
    getCliPath: () => ipcRenderer.invoke('kit:getCliPath'),
    isAppInstalled: () => ipcRenderer.invoke('kit:isAppInstalled'),

    // Generic streaming runner — passes a full CLI args array directly (used by pull, push, etc.).
    run: (args) => ipcRenderer.invoke('kit:run', args),

    // Streaming progress for long-running operations (pull, push).
    // Register before starting the operation; remove after it resolves/rejects.
    onProgress: (callback) => {
      ipcRenderer.on('kit:progress', (_event, line) => callback(line))
    },
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('kit:progress')
    },
    // Kills the currently-running streaming operation (pull or push).
    cancelOperation: () => ipcRenderer.invoke('kit:stop'),

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
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),
    getTempDir: (subfolder) => ipcRenderer.invoke('fs:getTempDir', subfolder),
    listDir: (dirPath) => ipcRenderer.invoke('fs:listDir', dirPath),
    deleteDir: (dirPath) => ipcRenderer.invoke('fs:deleteDir', dirPath),
    mkdir: (dirPath) => ipcRenderer.invoke('fs:mkdir', dirPath),
    copyPath: (src, dest) => ipcRenderer.invoke('fs:copyPath', src, dest),
    movePath: (src, dest) => ipcRenderer.invoke('fs:movePath', src, dest),

    // We might be tempted to expose the entire 'path' module, but that would be a security risk; just expose the things we need
    pathJoin: (...args) => path.join(...args),
    pathIsAbsolute: (p) => path.isAbsolute(p),
    pathRelative: (from, to) => path.relative(from, to),
    pathBasename: (p) => path.basename(p),
    pathSep: path.sep,
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
    onProtocolUrl: (callback) => {
      ipcRenderer.on('app:protocol-url', (_event, url) => callback(url))
    },
    removeProtocolUrlListener: () => {
      ipcRenderer.removeAllListeners('app:protocol-url')
    },
    removeData: (options) => ipcRenderer.invoke('app:removeData', options),
  },

  kitflow: {
    // Spawns the kitflow binary with pre-supplied vars and streams JSON events
    // back to the renderer via onEvent. Resolves when the flow finishes.
    run: (filePath, vars) => ipcRenderer.invoke('kitflow:run', filePath, vars),
    cancel: () => ipcRenderer.invoke('kitflow:cancel'),
    onEvent: (callback) => ipcRenderer.on('kitflow:event', (_e, event) => callback(event)),
    removeEventListener: () => ipcRenderer.removeAllListeners('kitflow:event'),
  },

  env: {
    get: (key) => ipcRenderer.invoke('env:get', key),
  },

  modelkitLogs: {
    read: (digest) => ipcRenderer.invoke('modelkitLogs:read', digest),
    prune: () => ipcRenderer.invoke('modelkitLogs:prune'),
  },
}
