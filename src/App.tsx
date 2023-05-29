import { useEffect, useMemo, useState } from 'react'
import './App.css'
import localStorage from './dbs/localStorage'
import indexedDB from './dbs/indexedDB'
import Benchmark from './lib/Benchmark'

const dbs = { localStorage, indexedDB }
type AAA = keyof typeof dbs

const clearDbs = async (): Promise<void> => {
  const dbEntries = Object.entries(dbs)
  for (let i = 0; i < dbEntries.length; i++) {
    const [name, db] = dbEntries[i]
    await db.clear()
  }
}

clearDbs()

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
    [key: string]: string
  }>({})

  const clearBenchmarkResults = () => {
    setBenchmarkResults({})
  }

  const setBenchmarkResult = (name: keyof typeof dbs, result: string) => {
    setBenchmarkResults(results => ({
      ...results,
      [name]: result,
    }))
  }

  const benchmark = useMemo(
    () =>
      Benchmark({
        cycle: (name, { mean }) => {
          setBenchmarkResult(name as keyof typeof dbs, mean.toString())
        },
      }),
    [],
  )
  const run = async () => {
    benchmark.clear()
    clearBenchmarkResults()
    await clearDbs()

    // add a case for each db to benchmark
    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [name, db] = dbEntries[i]
      benchmark.add(name, async () => {
        await db.set(Math.random().toFixed(10), Math.random().toFixed(10))
      })
    }

    await benchmark.run()
    console.log('Done')
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
            <td>{benchmarkResults.localStorage}</td>
          </tr>
          <tr>
            <th>IndexedDB</th>
            <td>{benchmarkResults.indexedDB}</td>
          </tr>
          <tr>
            <th>OPFS</th>
            <td>{benchmarkResults.opfs}</td>
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
