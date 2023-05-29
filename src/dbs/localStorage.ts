import Database from '../types/Database'

const runner: Database = {
  get: (key: string): Promise<string | undefined> => {
    return Promise.resolve(localStorage.getItem(key) || undefined)
  },
  set: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value)
  },
}

export default runner
