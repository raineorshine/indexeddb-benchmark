import { useEffect, useState } from 'react'
import './App.css'
import localStorageRunner from './dbs/localStorage'

function App() {
  const [numUpdates, setNumUpdates] = useState<null | number>(null)

  // directly fetch the number of updates saved to IndexedDB on mount
  useEffect(() => {
    const openRequest = indexedDB.open('test')
    openRequest.onerror = console.error
    openRequest.onsuccess = (e: any) => {
      const db: IDBDatabase = e.target.result
      const tx = db.transaction('updates', 'readonly')
      const updatesStore = tx.objectStore('updates')
      const countRequest = updatesStore.count()
      countRequest.onerror = console.error
      countRequest.onsuccess = () => {
        setNumUpdates(countRequest.result)
      }
    }
  }, [])

  return (
    <div className='App'>
      <div className='card'>
        <div>
          <p>
            <button onClick={() => window.location.reload()}>Refresh</button>
          </p>
          <p>YJS updates persisted to IndexedDB: {numUpdates}</p>
        </div>
      </div>
    </div>
  )
}

export default App
