import Database from '../types/Database'

const dbname = 'test'
let dbinstance: IDBDatabase | null = null
let dbversion = 1

const runner: Database = {
  /** Open a global database connection. */
  open: async () => {
    return new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(dbname)
      openRequest.onerror = console.error
      openRequest.onsuccess = (e: any) => {
        dbinstance = e.target.result
        resolve()
      }
    })
  },

  close: async () => {
    dbinstance?.close()
  },

  /** Closes and deletes he database. */
  clear: async () => {
    dbinstance?.close()
    dbinstance = null
    dbversion = 1
    await indexedDB.deleteDatabase(dbname)
  },

  /** Gets a value at a key from a store. */
  get: (storeName, key, mode = 'readonly') => {
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

  /** Gets one or more values for the given keys from a store. */
  bulkGet: (storeNames, keys, mode) => {
    return new Promise((resolve, reject) => {
      if (!dbinstance) throw new Error('You have to open the database first.')
      const tx = dbinstance.transaction(storeNames, 'readwrite', { durability: 'relaxed' })
      const results: any[] = []
      keys.forEach((key, i) => {
        const storeName = Array.isArray(storeNames) ? storeNames[i] : storeNames
        const store = tx.objectStore(storeName)
        const getRequest = store.get(key)
        getRequest.onerror = console.error
        getRequest.onsuccess = (e: any) => {
          results.push(e.target.result)
        }
      })
      tx.onerror = console.error
      tx.oncomplete = () => resolve(results)
    })
  },

  /** Creates one or more new store. */
  createStore: async storeNames => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames]
    return new Promise((resolve, reject) => {
      dbinstance?.close()
      const openRequest = indexedDB.open(dbname, ++dbversion)
      openRequest.onerror = console.error
      openRequest.onupgradeneeded = (e: any) => {
        const db: IDBDatabase = e.target.result
        names.forEach(name => {
          db.createObjectStore(name)
        })
      }
      openRequest.onsuccess = (e: any) => {
        dbinstance = e.target.result
        resolve()
      }
    })
  },

  /** Sets a value in a new random object store. */
  set: async (storeName, key, value) => {
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
  bulkSet: async (storeNames, keys, values) => {
    return new Promise((resolve, reject) => {
      if (!dbinstance) throw new Error('You have to open the database first.')
      const tx = dbinstance.transaction(storeNames, 'readwrite', { durability: 'relaxed' })
      keys.forEach((_, i) => {
        const storeName = Array.isArray(storeNames) ? storeNames[i] : storeNames
        const store = tx.objectStore(storeName)
        store.add(values[i], keys[i])
      })
      tx.oncomplete = () => resolve()
      tx.onerror = console.error
    })
  },
}

export default runner
