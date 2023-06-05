interface Database {
  open?: () => Promise<void>
  close?: () => Promise<void>
  clear: () => Promise<void>
  createStore: (name: string) => Promise<void>
  get: (storeName: string, key: string | number, mode?: 'readonly' | 'readwrite') => Promise<any>
  set: (storeName: string, key: string | number, value: any) => Promise<void>
  bulkSet?: (storeName: string, keys: (string | number)[], values: any[]) => Promise<void>
}

export default Database
