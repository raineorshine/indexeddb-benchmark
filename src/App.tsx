import { useCallback, useEffect, useMemo, useState } from 'react'
import throttle from 'lodash.throttle'
import './App.css'
import localStorage from './dbs/localStorage'
import indexedDB from './dbs/indexedDB'
import Benchmark from './lib/Benchmark'

// number of iterations per benchmark case
const ITERATIONS = 2000

/** Formats a number with commas in the thousands place. */
const numberWithCommas = (n: number | string) => {
  const parts = n.toString().split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

/** Formats a number as a percentage. */
const formatPercentage = (n: number) => (n * 100).toFixed(0) + '%'

/** Formats milliseconds. */
const formatMilliseconds = (ms: number) =>
  ms ? `${numberWithCommas(ms)} ms — ${numberWithCommas((1000 / ms).toFixed(1))}/sec` : '0 ms'

const dbs = { localStorage, indexedDB }

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
  const [iterations, setIterations] = useState<number>(ITERATIONS)

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

  // throttled progress updater
  const progress = useCallback(
    throttle((name: string, { i, ms }: { i: number; ms: number }) => {
      setBenchmarkResult(name as keyof typeof dbs, formatPercentage(i / iterations))
    }, 16.666),
    [],
  )

  const benchmark = useMemo(
    () =>
      Benchmark({
        iterations,
        iteration: progress,
        cycle: (name, { mean }) => {
          progress.cancel()
          setBenchmarkResult(name as keyof typeof dbs, formatMilliseconds(mean))
        },
        setup: clearDbs,
        teardown: clearDbs,
      }),
    [iterations],
  )
  const run = async () => {
    benchmark.cancel()
    benchmark.clear()
    clearBenchmarkResults()
    await clearDbs()

    // add a case for each db to benchmark
    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [name, db] = dbEntries[i]
      benchmark.add(
        name,
        async () => {
          await db.set(Math.random().toFixed(10), Math.random().toFixed(10))
        },
        {
          setup: db.clear,
          teardown: db.clear,
        },
      )
    }

    await benchmark.run()
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
