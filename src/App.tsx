import { useEffect, useState } from 'react'
import './App.css'
import localStorage from './dbs/localStorage'

const dbs = { localStorage }

interface Form {
  iterations?: string
}

function App() {
  // benchmark config
  const [iterations, setIterations] = useState<number>(1000)

  // form validation
  const [errors, setErrors] = useState<Form>({})
  const setError = (key: keyof Form, value?: string) =>
    setErrors(errors => ({ ...errors, [key]: value ?? `invalid ${key}` }))
  const clearError = (key: keyof Form, value: string) =>
    setErrors(errors => {
      delete errors[key]
      return errors
    })
  const hasError = () => Object.keys(errors).length === 0

  // benchmark results
  const [benchmarkResults, setBenchmarkResults] = useState<{
    [key: string]: {
      iterations: number
      time: number
    }
  }>({})
  // const [indexedDBResults, setIndexedDBResults] = useState<number>()
  // const [opfsResults, setOPFSResults] = useState<number>(null)

  const clearBenchmarkResults = () => {
    setBenchmarkResults({})
  }

  const run = async () => {
    clearBenchmarkResults()
    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [name, db] = dbEntries[i]
      const t = Date.now()
      for (let j = 0; j < iterations; j++) {
        await db.set(j.toString(), j.toString())
        setBenchmarkResults(results => ({
          ...results,
          [name]: {
            iterations: (results[name]?.iterations || 0) + 1,
            time: 0,
          },
        }))
      }
      const time = Date.now() - t

      setBenchmarkResults(results => ({
        ...results,
        [name]: {
          ...results[name],
          time,
        },
      }))
    }
  }

  return (
    <div className='App'>
      <h1>OPFS Benchmark</h1>
      <p>OPFS vs IndexedDB vs localStorage performance</p>

      <h2>Config:</h2>
      <p>
        Iterations:{' '}
        <input
          type='number'
          value={iterations}
          onChange={e => {
            const iterations = parseInt(e.target.value, 10)
            if (isNaN(iterations)) {
              setError('iterations')
              return
            }
            setIterations(iterations)
          }}
        />
      </p>

      <h2>Results:</h2>
      <table>
        <tbody>
          <tr>
            <th>localStorage</th>
            <td>
              {benchmarkResults.localStorage ? (1000 / benchmarkResults.localStorage.time).toFixed(1) : '...'} / sec
            </td>
          </tr>
          <tr>
            <th>IndexedDB</th>
            {/*<td>{localStorageResults ?? '...'}</td>*/}
          </tr>
          <tr>
            <th>localStorage</th>
            {/*<td>{localStorageResults ?? '...'}</td>*/}
          </tr>
        </tbody>
      </table>

      <div>
        <p>
          <button onClick={run}>Run benchmark</button>
        </p>
      </div>
    </div>
  )
}

export default App
