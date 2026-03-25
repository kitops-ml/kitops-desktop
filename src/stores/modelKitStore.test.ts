import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useModelKitStore } from './modelKitStore'

describe('modelKitStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts with no pinned modelkits', () => {
    const store = useModelKitStore()
    expect(store.pinnedModelKits).toHaveLength(0)
  })

  it('pins a modelkit', () => {
    const store = useModelKitStore()
    store.pinModelKit('jozu.ml/myorg/mymodel:latest')
    expect(store.isModelKitPinned('jozu.ml/myorg/mymodel:latest')).toBe(true)
  })

  it('does not add duplicates when pinning the same modelkit twice', () => {
    const store = useModelKitStore()
    store.pinModelKit('jozu.ml/myorg/mymodel:latest')
    store.pinModelKit('jozu.ml/myorg/mymodel:latest')
    expect(store.pinnedModelKits).toHaveLength(1)
  })

  it('unpins a modelkit', () => {
    const store = useModelKitStore()
    store.pinModelKit('jozu.ml/myorg/mymodel:latest')
    store.unpinModelKit('jozu.ml/myorg/mymodel:latest')
    expect(store.isModelKitPinned('jozu.ml/myorg/mymodel:latest')).toBe(false)
  })

  it('unpinning a modelkit that was not pinned is a no-op', () => {
    const store = useModelKitStore()
    expect(() => store.unpinModelKit('jozu.ml/myorg/mymodel:latest')).not.toThrow()
    expect(store.pinnedModelKits).toHaveLength(0)
  })

  it('can pin multiple modelkits independently', () => {
    const store = useModelKitStore()
    store.pinModelKit('jozu.ml/myorg/model-a:v1')
    store.pinModelKit('jozu.ml/myorg/model-b:v2')
    expect(store.pinnedModelKits).toHaveLength(2)
    expect(store.isModelKitPinned('jozu.ml/myorg/model-a:v1')).toBe(true)
    expect(store.isModelKitPinned('jozu.ml/myorg/model-b:v2')).toBe(true)
  })

  it('isModelKitPinned returns false for unknown modelkits', () => {
    const store = useModelKitStore()
    expect(store.isModelKitPinned('jozu.ml/nobody/unknown:latest')).toBe(false)
  })
})
