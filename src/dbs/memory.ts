import Database from '../types/Database'

let cache: { [key: string]: any } = {}

const runner: Database = {
  clear: async () => {
    cache = {}
  },
  get: async (key: string): Promise<string | undefined> => {
    return cache[key]
  },
  set: async (key: string, value: any): Promise<void> => {
    cache[key] = value
  },
}

export default runner
