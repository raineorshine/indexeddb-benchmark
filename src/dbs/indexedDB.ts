import Database from '../types/Database'

const runner: Database = {
  get: (key: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log('localStorage: read')
      const openRequest = indexedDB.open('test')
      openRequest.onerror = console.error
      openRequest.onsuccess = (e: any) => {
        const db: IDBDatabase = e.target.result
        const tx = db.transaction('updates', 'readonly')
        const updatesStore = tx.objectStore('updates')
        const countRequest = updatesStore.count()
        countRequest.onerror = console.error
        countRequest.onsuccess = () => {
          resolve(countRequest.result.toString())
        }
      }
    })
  },
  set: async (key: string, value: string): Promise<void> => {
    console.log('localStorage: write')
  },
}

export default runner
