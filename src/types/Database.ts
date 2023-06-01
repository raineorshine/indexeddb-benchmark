interface Database {
  clear: () => Promise<void>
  createStore: (name: string) => Promise<void>
  get: (storeName: string, key: string) => Promise<string | undefined>
  set: (storeName: string, key: string, value: any) => Promise<void>
}

export default Database
