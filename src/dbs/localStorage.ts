import Database from '../types/Database'

const runner: Database = {
  clear: async () => localStorage.clear(),
  createStore: async (storeName: string) => {
    const store = localStorage.getItem(storeName)
    if (!store) {
      localStorage.setItem(storeName, '{}')
    }
  },
  get: async (storeName: string, key: string | number): Promise<any> => {
    const store = localStorage.getItem(storeName)
    return store ? JSON.parse(store)[key.toString()] : undefined
  },
  set: async (storeName: string, key: string | number, value: any): Promise<void> => {
    const store = JSON.parse(localStorage.getItem(key.toString()) || '{}')
    localStorage.setItem(
      storeName,
      JSON.stringify({
        ...store,
        [key]: value,
      }),
    )
  },
}

export default runner
