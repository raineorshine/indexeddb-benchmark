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
  createStore: async (storeName: StoreName) => {
    cache[storeName] = {}
  },
  get: async (storeName: StoreName, key: RecordKey): Promise<string | undefined> => {
    return cache[storeName][key]
  },
  set: async (storeName: StoreName, key: RecordKey, value: any): Promise<void> => {
    cache[storeName][key] = value
  },
}

export default runner
