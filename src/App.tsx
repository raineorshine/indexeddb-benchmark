import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import throttle from 'lodash.throttle'
import localStorage from './dbs/localStorage'
import indexedDB from './dbs/indexedDB'
import Benchmark from './lib/Benchmark'

interface BenchmarkResult {
  mean?: number
  progress?: number
}

// number of iterations per benchmark case
const DEFAULT_ITERATIONS = 2000

// number of iterations per benchmark case
const DEFAULT_PREFILL = 1000

const dbs = { localStorage, indexedDB }

/** Formats a number with commas in the thousands place. */
const numberWithCommas = (n: number | string, decimals = 3) => {
  const parts = n.toString().split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const before = parts[0]
  const after = (parts[1] || '').slice(0, decimals)
  return `${before}${after ? '.' : ''}${after}`
}

/** Formats a number as a percentage. */
const formatPercentage = (n: number) => (n * 100).toFixed(0) + '%'

/** Formats milliseconds. */
const formatMilliseconds = (ms: number) => (ms ? `${numberWithCommas(ms)} ms` : '0 ms')

/** Formats milliseconds in terms of iterations per second. */
const formatRate = (ms: number) => (ms ? `${numberWithCommas((1000 / ms).toFixed(1))}/sec` : '')

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
  prefill?: string
}

function BenchmarkResultRow({ name, result }: { name: string; result: BenchmarkResult }) {
  return (
    <tr>
      <th>{name}</th>
      <td
        style={{
          minWidth: '2em',
          paddingRight: '0.5em',
          color: result?.progress === 1 ? 'gray' : undefined,
        }}
      >
        {result?.progress ? formatPercentage(result?.progress) : ''}
      </td>
      <td>{result?.mean ? formatMilliseconds(result?.mean) : ''}</td>
      <td style={{ textAlign: 'left' }}>{result?.mean ? formatRate(result?.mean) : ''}</td>
    </tr>
  )
}

function App() {
  // benchmark config
  const [iterations, setIterations] = useState<number>(DEFAULT_ITERATIONS)
  const [prefill, setPrefill] = useState<number>(DEFAULT_PREFILL)
  const [running, setRunning] = useState<boolean>(false)

  /** Generate a name for a prefill case. */
  const prefillName = (name: string) => `${name} (prefilled)`

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
    [key: string]: BenchmarkResult
  }>({})

  const clearBenchmarkResults = () => {
    setBenchmarkResults({})
  }

  const setBenchmarkResult = (name: keyof typeof dbs, { mean, progress }: { mean?: number; progress?: number }) => {
    setBenchmarkResults(results => ({
      ...results,
      [name]: { mean, progress },
    }))
  }

  // throttled progress updater
  const progress = useCallback(
    throttle(
      (name: string, { i, ms }: { i: number; ms: number }) => {
        setBenchmarkResult(name as keyof typeof dbs, { progress: i / iterations })
      },
      16.666,
      { leading: true, trailing: false },
    ),
    [iterations],
  )

  const benchmark = useMemo(
    () =>
      Benchmark({
        iterations,
        iteration: progress,
        cycle: (name, { mean }) => {
          progress.cancel()
          setBenchmarkResult(name as keyof typeof dbs, { mean, progress: 1 })
        },
        setup: clearDbs,
        teardown: clearDbs,
      }),
    [iterations],
  )

  const clear = async () => {
    benchmark.cancel()
    benchmark.clear()
    progress.cancel()
    clearBenchmarkResults()
    await clearDbs()
    setRunning(false)
  }

  const run = async () => {
    await clear()
    setRunning(true)

    // add a case for each db to benchmark
    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [name, db] = dbEntries[i]
      const set = async () => {
        await db.set(Math.random().toFixed(10), Math.random().toFixed(10))
      }
      benchmark.add(name, set, {
        setup: db.clear,
        teardown: db.clear,
      })
      // prefill
      benchmark.add(prefillName(name), set, {
        setup: async () => {
          await db.clear()
          for (let i = 0; i < prefill; i++) {
            await set()
          }
        },
        teardown: db.clear,
      })
    }

    await benchmark.run()
    setRunning(false)
  }

  return (
    <div
      className='App'
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1>OPFS Benchmark</h1>
      <p>
        <b>OPFS</b> vs <b>IndexedDB</b> vs <b>localStorage</b> performance
      </p>

      <section style={{ margin: '2em' }}>
        <h2>Config</h2>
        <p>
          <span style={{ minWidth: '6em', display: 'inline-block', marginRight: '0.5em', textAlign: 'right' }}>
            Prefill:
          </span>
          <input
            type='number'
            value={prefill}
            onChange={e => {
              const prefill = parseInt(e.target.value, 10)
              if (isNaN(prefill)) {
                setError('prefill')
                return
              }
              setPrefill(prefill)
            }}
            style={{
              width: '5em',
              padding: '0.25em 0.5em',
              textAlign: 'right',
            }}
          />
        </p>
        <p>
          <span style={{ minWidth: '6em', display: 'inline-block', marginRight: '0.5em', textAlign: 'right' }}>
            Iterations:
          </span>
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
            style={{
              width: '5em',
              padding: '0.25em 0.5em',
              textAlign: 'right',
            }}
          />
        </p>
      </section>

      <section style={{ margin: '2em' }}>
        <h2>Results</h2>
        <table>
          <tbody>
            {Object.keys(dbs).map(name => (
              <Fragment key={name}>
                <BenchmarkResultRow name={name} result={benchmarkResults[name]} />
                <BenchmarkResultRow name={prefillName(name)} result={benchmarkResults[prefillName(name)]} />
              </Fragment>
            ))}
          </tbody>
        </table>

        <p>
          <button onClick={run} style={{ margin: '0.5em' }}>
            Run benchmark
          </button>
          <button
            onClick={clear}
            disabled={Object.keys(benchmarkResults).length === 0}
            style={{ backgroundColor: '#1a1a1a', margin: '0.5em' }}
          >
            {running ? 'Cancel' : 'Clear'}
          </button>
        </p>
      </section>
    </div>
  )
}

export default App
