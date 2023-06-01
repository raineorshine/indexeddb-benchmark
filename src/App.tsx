import { Fragment, useCallback, useEffect, useMemo, useRef, useState, memo, createContext } from 'react'
import throttle from 'lodash.throttle'
import indexedDB from './dbs/indexedDB'
import Benchmark from './lib/Benchmark'
import FormRow from './components/FormRow'
import BenchmarkResultRow from './components/BenchmarkResultRow'
import BenchmarkResult from './types/BenchmarkResult'

type DataType = 'String(1000)' | 'Uint8Array(1000)'

// time to wait between cases
const DELAY_BETWEEN_CASES = 100

// throttle rate for re-rendering progress percentage
const PROGRESS_THROTTLE = 33.333

const DEFAULT_DATA: DataType = 'Uint8Array(1000)'

// number of insertions per benchmark case
const DEFAULT_ITERATIONS = 100

// number of insertions to prefill per benchmark case
const DEFAULT_PREFILL = 3000

const dbs = { indexedDB }

/** Clears all databases. */
const clearDbs = async (): Promise<void> => {
  const dbEntries = Object.entries(dbs)
  for (let i = 0; i < dbEntries.length; i++) {
    const [name, db] = dbEntries[i]
    await db.clear()
  }
}

/** Generates data of a given type. */
const generateData = (data: DataType): any => {
  const value =
    data === 'String(1000)'
      ? new Array(1000).fill(0).join('')
      : data === 'Uint8Array(1000)'
      ? new Uint8Array(1000)
      : null
  if (value === null) {
    throw new Error('Unsupported data type: ' + data)
  }
  return value
}

/** Asynchronously waits for a number of milliseconds*/
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface Form {
  iterations?: string
  prefill?: string
}

function App() {
  // benchmark config
  const [iterations, setIterations] = useState<number>(DEFAULT_ITERATIONS)
  const [data, setData] = useState<string>(DEFAULT_DATA)
  const [prefill, setPrefill] = useState<number>(DEFAULT_PREFILL)
  const running = useRef<boolean>(false)

  /** Generate a name for a prefill case. */
  const prefillName = (name: string) => `${name} (prefill)`

  /** Generate a name for a prefill empty case. */
  const prefillEmptyName = (name: string) => `${name} (prefill empty)`

  /** Generate a name for a prefill empty case. */
  const prefillSingleObjectStore = (name: string) => `${name} (prefill single object store)`

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

  /** Clears the database, benchmark results, and throttled progress timers. Assumes the benchmark is has already ended or been cancelled. */
  const clear = async () => {
    running.current = false
    progress.cancel()
    prefillProgress.cancel()
    benchmark.clear()
    setBenchmarkResults({})
    await clearDbs()
  }

  /** Sets a benchmark result for a specific case. Only overwrites given properties. */
  const setBenchmarkResult = (name: string, result: Partial<BenchmarkResult>) => {
    setBenchmarkResults(resultsOld => ({
      ...resultsOld,
      [name]: {
        ...resultsOld[name],
        ...result,
      },
    }))
  }

  // throttled progress updater
  const progress = useCallback(
    throttle(
      (name: string, { i }: { i: number }) => {
        if (!running.current) return
        setBenchmarkResult(name, {
          progress: (i + 1) / iterations,
        })
      },
      PROGRESS_THROTTLE,
      { leading: true, trailing: false },
    ),
    [iterations],
  )

  // throttled prefill progress updater
  const prefillProgress = useCallback(
    throttle(
      (name: string, { i }: { i: number }) => {
        if (!running.current) return
        setBenchmarkResult(name, {
          prefill: (i + 1) / prefill,
        })
      },
      PROGRESS_THROTTLE,
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
          prefillProgress.cancel()
          setBenchmarkResult(name, {
            mean,
            prefill: 1,
            progress: 1,
          })
        },
        setup: clearDbs,
        teardown: clearDbs,
      }),
    [iterations],
  )

  /** Cancels the current run and clears the benchmark results. */
  const cancel = async () => {
    benchmark.cancel()
    clear()
  }

  const run = async () => {
    if (running.current) return

    await clear()
    running.current = true

    // add a case for each db to benchmark
    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [name, db] = dbEntries[i]

      /** Inserts a value of the selected DataType into a new object store. */
      const set = async (storeName: string) => {
        const key = Math.random().toFixed(16)
        await db.set(storeName, key, generateData(data as DataType))
      }

      /** Creates a new object store and sets a value on it. */
      const createAndSet = async () => {
        const storeName = Math.random().toFixed(16)
        await db.createStore(storeName)
        await set(storeName)
      }

      /** Clear the database and delay at the end of each case. */
      const teardown = async () => {
        await db.clear()
        await sleep(DELAY_BETWEEN_CASES)
      }

      // normal
      benchmark.add(name, createAndSet, {
        setup: async name => {
          setBenchmarkResult(name, { progress: 0 })
        },
        teardown,
      })

      // prefill single object store
      if (prefill > 0) {
        const caseName = prefillSingleObjectStore(name)
        benchmark.add(caseName, createAndSet, {
          setup: async () => {
            // start prefill progress at 0%
            setBenchmarkResult(caseName, { prefill: 0 })

            const storeName = Math.random().toFixed(16)
            await db.createStore(storeName)
            if (!running.current) return

            for (let i = 0; i < prefill; i++) {
              if (!running.current) return
              await set(storeName)
              prefillProgress(caseName, { i })
            }

            // end prefill progress to 100%
            prefillProgress.cancel()
            setBenchmarkResult(caseName, { prefill: 1 })
          },
          teardown,
        })
      }

      // prefill empty
      if (prefill > 0) {
        const caseName = prefillEmptyName(name)
        benchmark.add(caseName, createAndSet, {
          setup: async () => {
            // start prefill progress at 0%
            setBenchmarkResult(caseName, { prefill: 0 })

            for (let i = 0; i < prefill; i++) {
              if (!running.current) return
              const storeName = Math.random().toFixed(16)
              await db.createStore(storeName)
              if (!running.current) return
              prefillProgress(caseName, { i })
            }

            // end prefill progress to 100%
            prefillProgress.cancel()
            setBenchmarkResult(caseName, { prefill: 1 })
          },
          teardown,
        })
      }

      // prefill
      if (prefill > 0) {
        const caseName = prefillName(name)
        benchmark.add(caseName, createAndSet, {
          setup: async () => {
            // start prefill progress at 0%
            setBenchmarkResult(caseName, { prefill: 0 })

            for (let i = 0; i < prefill; i++) {
              if (!running.current) return
              await createAndSet()
              if (!running.current) return
              prefillProgress(caseName, { i })
            }

            // end prefill progress to 100%
            prefillProgress.cancel()
            setBenchmarkResult(caseName, { prefill: 1 })
          },
          teardown,
        })
      }
    }

    if (running.current) {
      await benchmark.run()
    }
    running.current = false
  }

  useEffect(() => {
    clearDbs()
  }, [])

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
        <b>OPFS</b> vs <b>IndexedDB</b> performance
      </p>

      <section style={{ margin: '2em' }}>
        <h2 style={{ marginBottom: '1.2em' }}>Config</h2>
        <div style={{ margin: '0 auto' }}>
          <table style={{ marginLeft: '3.6em', width: '100%' }}>
            <tbody>
              <FormRow
                defaultValue={DEFAULT_DATA}
                description='Type of data to insert each iteration.'
                label='Data'
                options={useMemo(() => ['String(1000)', 'Uint8Array(1000)'], [])}
                set={setData}
                type='radio'
              />
              <FormRow
                defaultValue={DEFAULT_PREFILL.toString()}
                description='Number of insertions to execute before starting measurements.'
                label='Prefill'
                set={useCallback(value => setPrefill(parseInt(value, 10)), [])}
              />
              <FormRow
                defaultValue={DEFAULT_ITERATIONS.toString()}
                description='Number of insertions to execute and measure after the database is prefilled.'
                label='Iterations'
                set={useCallback((value: string) => setIterations(parseInt(value, 10)), [])}
              />
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ margin: '2em' }}>
        <h2>Results</h2>
        <table>
          <tbody>
            {Object.keys(dbs).map(name => (
              <Fragment key={name}>
                <BenchmarkResultRow name={name} result={benchmarkResults[name]} />
                {prefill > 0 && (
                  <>
                    <BenchmarkResultRow
                      name={prefillSingleObjectStore(name)}
                      result={benchmarkResults[prefillSingleObjectStore(name)]}
                    />
                    <BenchmarkResultRow
                      name={prefillEmptyName(name)}
                      result={benchmarkResults[prefillEmptyName(name)]}
                    />
                    <BenchmarkResultRow name={prefillName(name)} result={benchmarkResults[prefillName(name)]} />
                  </>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        <p>
          <button onClick={run} style={{ margin: '0.5em' }}>
            Run benchmark
          </button>
          <button
            onClick={cancel}
            disabled={Object.keys(benchmarkResults).length === 0}
            style={{ backgroundColor: '#1a1a1a', margin: '0.5em' }}
          >
            {running.current ? 'Cancel' : 'Clear'}
          </button>
        </p>
      </section>
    </div>
  )
}

export default App
