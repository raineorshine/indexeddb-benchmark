type StoreName = string
type RecordKey = string | number

interface Database {
  open?: () => Promise<void>
  close?: () => Promise<void>
  clear: () => Promise<void>
  createStore: (names: string | string[]) => Promise<void>
  get: (storeName: StoreName, key: RecordKey, mode?: 'readonly' | 'readwrite') => Promise<any>
  set: (storeName: StoreName, key: RecordKey, value: any) => Promise<void>
  bulkSet: (storeNames: StoreName | StoreName[], keys: RecordKey[], values: any[]) => Promise<void>
}

export default Database
