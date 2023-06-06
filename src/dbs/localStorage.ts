import Database from '../types/Database'

const runner: Database = {
  clear: async () => localStorage.clear(),
  createStore: async storeNames => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames]
    names.forEach(name => {
      const store = localStorage.getItem(name)
      if (!store) {
        localStorage.setItem(name, '{}')
      }
    })
  },
  get: async (storeName, key) => {
    const store = localStorage.getItem(storeName)
    return store ? JSON.parse(store)[key.toString()] : undefined
  },
  set: async (storeName, key, value) => {
    const store = JSON.parse(localStorage.getItem(key.toString()) || '{}')
    localStorage.setItem(
      storeName,
      JSON.stringify({
        ...store,
        [key]: value,
      }),
    )
  },
  bulkSet: async () => {
    throw new Error('Not Implemented')
  },
}

export default runner
