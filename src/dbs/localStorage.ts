import Database from '../types/Database'

const runner: Database = {
  clear: async () => localStorage.clear(),
  get: async (key: string): Promise<string | undefined> => {
    return localStorage.getItem(key) || undefined
  },
  set: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value)
  },
}

export default runner
