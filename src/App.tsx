import { useEffect, useMemo, useState } from 'react'
import './App.css'
import localStorage from './dbs/localStorage'
import indexedDB from './dbs/indexedDB'
import Benchmark from './lib/Benchmark'

Benchmark.options.maxTime = 0.001

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
  const suite = useMemo<any>(() => new Benchmark.Suite(), [])

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
    suite.reset()
  }

  const setBenchmarkResult = (name: keyof typeof dbs, result: string) => {
    setBenchmarkResults(results => ({
      ...results,
      [name]: result,
    }))
  }

  const run = async () => {
    clearBenchmarkResults()
    clearDbs()

    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [name, db] = dbEntries[i]
      suite.add(name, {
        fn: async (deferred: any) => {
          await db.set(Math.random().toFixed(10), Math.random().toFixed(10))
          deferred.resolve()
        },
        defer: true,
      })
    }

    suite
      .on('cycle', (e: any) => {
        console.log('e', e.target)
        setBenchmarkResult(e.target.name, e.target.toString())
      })
      .on('complete', () => {
        console.log('Done')
        // console.log('Fastest is ' + suite.filter('fastest').map('name'))
      })
      // run async
      .run({
        async: true,
      })
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
