type Mode = 'readonly' | 'readwrite'
type StoreName = string
type RecordKey = string | number

interface Database {
  open?: () => Promise<void>
  close?: () => Promise<void>
  clear: () => Promise<void>
  createStore: (names: string | string[]) => Promise<void>
  get: (storeName: StoreName, key: RecordKey, mode?: Mode) => Promise<any>
  bulkGet: (storeNames: StoreName | StoreName[], keys: RecordKey[], mode?: Mode) => Promise<any[]>
  set: (storeName: StoreName, key: RecordKey, value: any) => Promise<void>
  bulkSet: (storeNames: StoreName | StoreName[], keys: RecordKey[], values: any[]) => Promise<void>
}

export default Database
