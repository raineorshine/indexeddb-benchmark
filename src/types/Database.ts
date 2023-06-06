type StoreName = string

interface Database {
  open?: () => Promise<void>
  close?: () => Promise<void>
  clear: () => Promise<void>
  createStore: (names: string | string[]) => Promise<void>
  get: (storeName: StoreName, key: string | number, mode?: 'readonly' | 'readwrite') => Promise<any>
  set: (storeName: StoreName, key: string | number, value: any) => Promise<void>
  bulkSet: (storeNames: StoreName | StoreName[], keys: (string | number)[], values: any[]) => Promise<void>
}

export default Database
