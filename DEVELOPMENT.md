# KitOps Desktop - Development Guide

## Quick Start

### Initial Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run electron:dev
```

The app will open automatically with hot-reload enabled.

## Adding IPC Commands

All kit operations go through `@kitops/kitops-ts` via Electron IPC. Here's the pattern for adding a new command:

### Step 1: Add a handler in electron/ipc/kit-commands.js

```javascript
// Add import at the top
import { list, pack, push, pull, init, version } from '@kitops/kitops-ts'

// Replace each handler
ipcMain.handle('kit:version', async () => {
  return await version()
})

ipcMain.handle('kit:list', async () => {
  return await list()
})

ipcMain.handle('kit:pack', async (event, options) => {
  // options: { directory, flags: { file, tag, ... } }
  return await pack(options)
})

ipcMain.handle('kit:push', async (event, options) => {
  // options: { name, tag, registry }
  return await push(options)
})

ipcMain.handle('kit:pull', async (event, options) => {
  // options: { reference }
  return await pull(options)
})

ipcMain.handle('kit:init', async (event, options) => {
  // options: { directory }
  return await init(options)
})
```

## File Picker Integration

To enable file/folder selection for models and datasets:

### Add to electron/main.js

```javascript
import { dialog } from 'electron'

ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: options?.filters
  })
  return result.filePaths[0]
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.filePaths[0]
})
```

### Add to electron/preload.js

```javascript
window.kitops = {
  // ... existing methods
  selectFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory')
}
```

### Use in KitfileEditorView.vue

```javascript
async function selectFile(type) {
  if (type === 'model') {
    const path = await window.kitops.selectFile({
      filters: [
        { name: 'Model Files', extensions: ['pt', 'pth', 'h5', 'pb', 'onnx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (path) {
      formData.value.model.path = path
    }
  }
}
```

## Adding New Features

### Adding a New IPC Handler

1. **Define in main.js**:
```javascript
ipcMain.handle('kit:remove', async (event, modelKitId) => {
  return await remove(modelKitId)
})
```

2. **Expose in preload.js**:
```javascript
window.kitops = {
  // ...
  remove: (id) => ipcRenderer.invoke('kit:remove', id)
}
```

3. **Use in Vue components**:
```javascript
async function removeModelKit(id) {
  await window.kitops.remove(id)
  await fetchModelKits()
}
```

### Adding a New View

1. **Create the component** in `src/views/YourView.vue`
2. **Add route** in `src/router/index.js`:
```javascript
{
  path: '/your-path',
  name: 'your-view',
  component: YourView
}
```
3. **Add navigation** in `src/components/Sidebar.vue`

## Styling Guidelines

### Using the Design System

The app has a comprehensive CSS variable system:

```css
/* Colors */
var(--color-bg-primary)
var(--color-bg-secondary)
var(--color-surface)
var(--color-gold)
var(--color-off-white)

/* Spacing */
var(--space-1) through var(--space-16)

/* Radius */
var(--radius-sm), var(--radius-md), var(--radius-lg)

/* Transitions */
var(--transition-fast), var(--transition-base), var(--transition-slow)
```

### Component Patterns

**Button styles**:
```vue
<button class="btn-primary">Primary Action</button>
<button class="btn-secondary">Secondary Action</button>
```

**Form inputs**:
```vue
<input class="input" type="text" />
<select class="input">...</select>
<textarea class="input textarea">...</textarea>
```

**Icons**: Always wrap SVGs with a class:
```vue
<svg class="icon" viewBox="0 0 24 24">...</svg>
```

## Testing the App

### Manual Testing Checklist

- [ ] Create new Kitfile from template
- [ ] Edit Kitfile form fields
- [ ] Preview generated YAML
- [ ] Pack ModelKit
- [ ] View ModelKit details
- [ ] Navigate between views

## Common Development Tasks

### Adding a Kitfile Template

Edit `views/NewKitfileView.vue`:

```javascript
const templates = [
  // ... existing templates
  {
    id: 'your-template',
    name: 'Your Template',
    description: 'Description here',
    tags: ['Tag1', 'Tag2'],
  }
]
```

Then add a matching `case` in `loadTemplate()` in `KitfileEditorView.vue` that populates `formData` with the template's default values.

### Updating the Store

The Pinia store (`stores/kitStore.js`) manages app state. Add new state/actions:

```javascript
export const useKitStore = defineStore('kit', () => {
  // Add new state
  const yourState = ref(null)

  // Add new action
  async function yourAction() {
    // implementation
  }

  return {
    // Export it
    yourState,
    yourAction
  }
})
```

### Debugging

Enable DevTools in production:

```javascript
// electron/main.js
mainWindow.webContents.openDevTools()
```

View IPC calls:
```javascript
// electron/main.js
ipcMain.handle('kit:list', async () => {
  console.log('IPC: kit:list called')
  const result = await list()
  console.log('IPC: kit:list result:', result)
  return result
})
```

## Building for Distribution

```bash
# Build for your platform
pnpm run electron:build

# Output will be in dist-electron/
```

Configure builds in `package.json` under the `build` key.

## Troubleshooting

### "Cannot find module '@kitops/kitops-ts'"

Make sure you've linked the library:
```bash
cd ../kitops-ts && pnpm link
cd ../kitops-desktop && pnpm link kitops-ts
```

### Hot reload not working

Restart the dev server:
```bash
pnpm run electron:dev
```

### Vite errors

Clear cache and reinstall:
```bash
rm -rf node_modules dist .vite
pnpm install
```

### Electron won't start

Check if port 5173 is already in use:
```bash
lsof -i :5173
```

## Next Steps

1. **Add authentication** - Implement registry login/logout flows
2. **Error handling** - Better user feedback for CLI errors
3. **Testing** - Add unit tests for stores and components
5. **Documentation** - Add JSDoc comments to functions

## Resources

- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Pinia State Management](https://pinia.vuejs.org/)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Vite Configuration](https://vitejs.dev/config/)
- [KitOps Documentation](https://kitops.org/docs/)
