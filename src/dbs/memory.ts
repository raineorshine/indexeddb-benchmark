import Database from '../types/Database'

type StoreName = string
type RecordKey = string | number

let cache: {
  [key: StoreName]: {
    [key: RecordKey]: string
  }
} = {}

const runner: Database = {
  clear: async () => {
    cache = {}
  },
  createStore: async (storeNames: StoreName | StoreName[]) => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames]
    names.forEach(name => {
      cache[name] = {}
    })
  },
  get: async (storeName: StoreName, key: RecordKey): Promise<string | undefined> => {
    return cache[storeName][key]
  },
  set: async (storeName: StoreName, key: RecordKey, value: any): Promise<void> => {
    cache[storeName][key] = value
  },
  bulkSet: async (storeNames: StoreName | StoreName[], keys: RecordKey[], values: any[]): Promise<void> => {
    keys.forEach((_, i) => {
      const storeName = Array.isArray(storeNames) ? storeNames[i] : storeNames
      cache[storeName][keys[i]] = values[i]
    })
  },
}

export default runner
