import Database from '../types/Database'

const dbname = 'test'
let dbversion = 1

const runner: Database = {
  clear: async (): Promise<void> => {
    dbversion = 1
    const dbs = await indexedDB.databases()
    for (let i = 0; i < dbs.length; i++) {
      const name = dbs[i]?.name
      if (name) {
        await indexedDB.deleteDatabase(name)
      }
    }
  },
  get: (key: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(dbname)
      openRequest.onerror = console.error
      openRequest.onsuccess = (e: any) => {
        const db: IDBDatabase = e.target.result
        const tx = db.transaction('updates', 'readonly')
        const updatesStore = tx.objectStore('updates')
        const countRequest = updatesStore.count()
        countRequest.onerror = console.error
        countRequest.onsuccess = () => {
          db.close()
          resolve(countRequest.result.toString())
        }
      }
    })
  },
  set: async (key: string, value: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const storeName = Math.random()
      const openRequest = indexedDB.open(dbname, dbversion++)
      openRequest.onerror = console.error
      openRequest.onupgradeneeded = (e: any) => {
        const db = e.target.result
        db.createObjectStore(storeName)
      }
      openRequest.onsuccess = (e: any) => {
        const db = e.target.result
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)

        // add
        const addRequest = store.add(Math.random(), Math.random())
        addRequest.onerror = console.error
        addRequest.onsuccess = () => {
          // getAll
          const getRequest = store.getAll()
          getRequest.onerror = console.error
          getRequest.onsuccess = () => {
            db.close()
            resolve(getRequest.result.length)
          }
        }
      }
    })
  },
}

export default runner
