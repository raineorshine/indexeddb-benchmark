import Database from '../types/Database'

const runner: Database = {
  clear: async () => localStorage.clear(),
  createStore: async (storeName: string) => {
    localStorage.setItem(storeName, '{}')
  },
  get: async (storeName: string, key: string): Promise<string | undefined> => {
    const store = localStorage.getItem(storeName)
    return store ? JSON.parse(store)[key] : undefined
  },
  set: async (storeName: string, key: string, value: string): Promise<void> => {
    const store = JSON.parse(localStorage.getItem(key) || '{}')
    store[key] = value
    localStorage.setItem(storeName, store)
  },
}

export default runner
