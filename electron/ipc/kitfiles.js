import fs from 'fs/promises'
import path from 'path'

import { generateId, jsonStore } from '../store.js'

const store = jsonStore('draft-kitfiles.json')

async function parseMetadata(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const nameMatch = content.match(/^\s*name:\s*(.+)$/m)
    const versionMatch = content.match(/^\s*version:\s*(.+)$/m)
    const descriptionMatch = content.match(/^\s*description:\s*(.+)$/m)

    return {
      name: nameMatch ? nameMatch[1].trim() : path.basename(path.dirname(filePath)),
      version: versionMatch ? versionMatch[1].trim() : '1.0.0',
      description: descriptionMatch ? descriptionMatch[1].trim() : '',
    }
  } catch {
    return {
      name: path.basename(path.dirname(filePath)),
      version: '1.0.0',
      description: '',
    }
  }
}

function parseKitfilePaths(content) {
  const paths = []

  const modelPathMatch = content.match(/^model:\s*\n\s*path:\s*(.+)$/m)
  if (modelPathMatch) {
    paths.push({ type: 'model', path: modelPathMatch[1].trim() })
  }

  const codeSection = content.match(/^code:\s*\n((?:\s+-\s*path:\s*.+\n?)+)/m)
  if (codeSection) {
    for (const match of codeSection[1].matchAll(/^\s*-\s*path:\s*(.+)$/gm)) {
      paths.push({ type: 'code', path: match[1].trim() })
    }
  }

  const datasetSection = content.match(/^datasets:\s*\n((?:\s+-\s*path:\s*.+\n?)+)/m)
  if (datasetSection) {
    for (const match of datasetSection[1].matchAll(/^\s*-\s*path:\s*(.+)$/gm)) {
      paths.push({ type: 'dataset', path: match[1].trim() })
    }
  }

  return paths
}

async function copyRecursive(src, dest) {
  const stat = await fs.stat(src)
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src)
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(src, dest)
  }
}

function makeEntry(filePath, metadata) {
  return {
    id: generateId(),
    path: filePath,
    directory: path.dirname(filePath),
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function register(ipcMain) {
  ipcMain.handle('kitfiles:list', () => store.load())

  ipcMain.handle('kitfiles:add', async (e, kitfilePath) => {
    const kitfiles = await store.load()

    const existing = kitfiles.find(k => k.path === kitfilePath)
    if (existing) {
      const metadata = await parseMetadata(kitfilePath)
      Object.assign(existing, metadata, { updatedAt: new Date().toISOString() })
      await store.save(kitfiles)
      return existing
    }

    const metadata = await parseMetadata(kitfilePath)
    const entry = makeEntry(kitfilePath, metadata)
    kitfiles.push(entry)
    await store.save(kitfiles)
    return entry
  })

  ipcMain.handle('kitfiles:update', async (e, id, updates) => {
    const kitfiles = await store.load()
    const index = kitfiles.findIndex(k => k.id === id)
    if (index === -1) {
      throw new Error('Kitfile not found')
    }

    kitfiles[index] = { ...kitfiles[index], ...updates, updatedAt: new Date().toISOString() }
    await store.save(kitfiles)
    return kitfiles[index]
  })

  ipcMain.handle('kitfiles:remove', async (e, id) => {
    const kitfiles = await store.load()
    await store.save(kitfiles.filter(k => k.id !== id))
    return { success: true }
  })

  ipcMain.handle('kitfiles:refresh', async (e, id) => {
    const kitfiles = await store.load()
    const kitfile = kitfiles.find(k => k.id === id)
    if (!kitfile) {
      throw new Error('Kitfile not found')
    }

    try {
      await fs.access(kitfile.path)
    } catch {
      await store.save(kitfiles.filter(k => k.id !== id))
      return { removed: true }
    }

    const metadata = await parseMetadata(kitfile.path)
    Object.assign(kitfile, metadata, { updatedAt: new Date().toISOString() })
    await store.save(kitfiles)
    return kitfile
  })

  ipcMain.handle('kitfiles:duplicate', async (e, id, mode) => {
    const kitfiles = await store.load()
    const original = kitfiles.find(k => k.id === id)
    if (!original) {
      throw new Error('Kitfile not found')
    }

    const content = await fs.readFile(original.path, 'utf-8')
    const originalDir = path.dirname(original.path)
    const parentDir = path.dirname(originalDir)
    const baseName = path.basename(originalDir)

    // find a unique directory name
    let copyNum = 1
    let newDirName = `${baseName}-copy`
    let newDir = path.join(parentDir, newDirName)

    try {
      await fs.access(newDir)
      while (true) {
        copyNum++
        newDirName = `${baseName}-copy-${copyNum}`
        newDir = path.join(parentDir, newDirName)
        try {
          await fs.access(newDir)
        } catch {
          break
        }
      }
    } catch {
      // name is available
    }

    await fs.mkdir(newDir, { recursive: true })

    const copyName = copyNum > 1 ? `${original.name}-copy-${copyNum}` : `${original.name}-copy`
    let updatedContent = content.replace(/^(\s*name:\s*).+$/m, `$1${copyName}`)

    if (mode === 'copy-assets') {
      for (const ref of parseKitfilePaths(content)) {
        const srcPath = path.join(originalDir, ref.path)
        try {
          await fs.access(srcPath)
          await copyRecursive(srcPath, path.join(newDir, ref.path))
        } catch {
          // referenced file missing, skip
        }
      }
    } else if (mode === 'update-references') {
      const relativePath = path.relative(newDir, originalDir)
      for (const ref of parseKitfilePaths(content)) {
        const escaped = ref.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        updatedContent = updatedContent.replace(
          new RegExp(`(path:\\s*)${escaped}`, 'g'),
          `$1${path.join(relativePath, ref.path)}`,
        )
      }
    }

    const newPath = path.join(newDir, 'Kitfile')
    await fs.writeFile(newPath, updatedContent, 'utf-8')

    const metadata = await parseMetadata(newPath)
    const entry = makeEntry(newPath, metadata)
    kitfiles.push(entry)
    await store.save(kitfiles)
    return entry
  })
}
