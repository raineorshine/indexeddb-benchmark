import Database from '../types/Database'

const dbname = 'test'
let dbinstance: IDBDatabase | null = null
let dbversion = 1

const runner: Database = {
  /** Open a global database connection. */
  open: async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(dbname)
      openRequest.onerror = console.error
      openRequest.onsuccess = (e: any) => {
        dbinstance = e.target.result
        resolve()
      }
    })
  },

  close: async (): Promise<void> => {
    dbinstance?.close()
  },

  /** Closes and deletes he database. */
  clear: async (): Promise<void> => {
    dbinstance?.close()
    dbinstance = null
    dbversion = 1
    await indexedDB.deleteDatabase(dbname)
  },

  /** Gets a value at a key from a store. */
  get: (storeName: string, key: string | number, mode: 'readonly' | 'readwrite' = 'readonly'): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!dbinstance) throw new Error('You have to open the database first.')
      const tx = dbinstance.transaction(storeName, mode, { durability: 'relaxed' })
      const store = tx.objectStore(storeName)
      const getRequest = store.get(key)
      getRequest.onerror = console.error
      getRequest.onsuccess = () => {
        resolve(getRequest.result)
      }
    })
  },

  /** Creates a new store. */
  createStore: async (storeName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      dbinstance?.close()
      const openRequest = indexedDB.open(dbname, ++dbversion)
      openRequest.onerror = console.error
      openRequest.onupgradeneeded = (e: any) => {
        const db: IDBDatabase = e.target.result
        db.createObjectStore(storeName)
      }
      openRequest.onsuccess = (e: any) => {
        dbinstance = e.target.result
        resolve()
      }
    })
  },

  /** Sets a value in a new random object store. */
  set: async (storeName: string, key: string | number, value: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!dbinstance) throw new Error('You have to open the database first.')
      const tx = dbinstance.transaction(storeName, 'readwrite', { durability: 'relaxed' })
      const store = tx.objectStore(storeName)
      const addRequest = store.add(value, key)
      addRequest.onerror = console.error
      addRequest.onsuccess = () => resolve()
    })
  },

  /** Sets more than one value in a random new object store. Faster than set. */
  bulkSet: async (storeName: string, keys: (string | number)[], values: string[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!dbinstance) throw new Error('You have to open the database first.')
      const tx = dbinstance.transaction(storeName, 'readwrite', { durability: 'relaxed' })
      const store = tx.objectStore(storeName)
      keys.forEach((_, i) => {
        store.add(values[i], keys[i])
      })
      tx.oncomplete = () => resolve()
      tx.onerror = console.error
    })
  },
}

export default runner
