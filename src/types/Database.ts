interface Database {
  clear: () => Promise<void>
  createStore: (name: string) => Promise<void>
  get: (storeName: string, key: string | number, mode?: string) => Promise<string | undefined>
  set: (storeName: string, key: string | number, value: any) => Promise<void>
}

export default Database
