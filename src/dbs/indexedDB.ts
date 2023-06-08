import Database from '../types/Database'

const dbname = 'test'
let dbinstance: IDBDatabase | null = null
let dbversion = 1

const runner: Database = {
  /** Open a global database connection. */
  open: async () => {
    return new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(dbname)
      openRequest.onerror = reject
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
      getRequest.onerror = reject
      getRequest.onsuccess = () => {
        resolve(getRequest.result)
      }
    })
  },

  /** Gets one or more values for the given keys from a store. */
  getAllByIndex: (storeName, indexName, key, mode = 'readonly') => {
    return new Promise((resolve, reject) => {
      if (!dbinstance) throw new Error('You have to open the database first.')
      const tx = dbinstance.transaction(storeName, mode, { durability: 'relaxed' })
      const store = tx.objectStore(storeName)
      const index = store.index(indexName)
      const req = index.getAll(key)
      req.onerror = reject
      req.onsuccess = (e: any) => {
        resolve(e.target.result)
      }
    })
  },

  /** Gets all values in a store. */
  getAll: (storeName, mode = 'readonly') => {
    return new Promise((resolve, reject) => {
      if (!dbinstance) throw new Error('You have to open the database first.')
      const tx = dbinstance.transaction(storeName, mode, { durability: 'relaxed' })
      const store = tx.objectStore(storeName)
      const req = store.getAll()
      req.onerror = reject
      req.onsuccess = (e: any) => {
        resolve(e.target.result)
      }
    })
  },

  /** Gets one or more values for the given keys from a store. */
  bulkGet: (storeNames, keys, mode) => {
    return new Promise((resolve, reject) => {
      if (!dbinstance) throw new Error('You have to open the database first.')
      const tx = dbinstance.transaction(storeNames, 'readwrite', { durability: 'relaxed' })
      const results: any[] = Array(keys.length).fill(undefined)
      keys.forEach((key, i) => {
        const storeName = Array.isArray(storeNames) ? storeNames[i] : storeNames
        const store = tx.objectStore(storeName)
        const getRequest = store.get(key)
        getRequest.onerror = reject
        getRequest.onsuccess = (e: any) => {
          results[i] = e.target.result
        }
      })
      tx.onerror = reject
      tx.oncomplete = () => resolve(results)
    })
  },

  /** Creates one or more new store. */
  createStore: async storeNames => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames]
    return new Promise((resolve, reject) => {
      dbinstance?.close()
      const openRequest = indexedDB.open(dbname, ++dbversion)
      openRequest.onerror = reject
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

  /** Creates an index on a record property. */
  createIndex: async (storeName, keyPath) => {
    return new Promise((resolve, reject) => {
      if (!dbinstance) throw new Error('You have to open the database first.')
      dbinstance?.close()
      const openRequest = indexedDB.open(dbname, ++dbversion)
      openRequest.onerror = reject
      openRequest.onupgradeneeded = (e: any) => {
        const tx: IDBTransaction = e.target.transaction
        const store = tx.objectStore(storeName)
        store.createIndex(keyPath, keyPath)
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
      addRequest.onerror = reject
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
      tx.onerror = reject
      tx.oncomplete = () => resolve()
    })
  },
}

export default runner
