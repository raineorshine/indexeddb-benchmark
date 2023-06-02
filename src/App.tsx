import { Fragment, useCallback, useEffect, useMemo, useRef, useState, memo, createContext } from 'react'
import throttle from 'lodash.throttle'
import indexedDB from './dbs/indexedDB'
import Benchmark from './lib/Benchmark'
import FormRow from './components/FormRow'
import BenchmarkResultRow from './components/BenchmarkResultRow'
import BenchmarkResult from './types/BenchmarkResult'
import Database from './types/Database'

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

/** Inserts a value of the selected DataType into a new object store at a random key. */
const set = async (db: Database, storeName: string, key: string, data: DataType): Promise<void> =>
  await db.set(storeName, key, generateData(data))

/** Inserts a value of the selected DataType into a new object store at the given key. */
const setRandom = async (db: Database, storeName: string, data: DataType): Promise<void> =>
  await db.set(storeName, Math.random().toFixed(16), generateData(data))

/** Creates a new object store and sets a value on it. */
const createAndSet = async (db: Database, data: DataType) => {
  const storeName = Math.random().toFixed(16)
  await db.createStore(storeName)
  await setRandom(db, storeName, data)
}

/** Clear the database and wait before starting the next case. */
const after = async (db: Database) => {
  await db.clear()
  await sleep(DELAY_BETWEEN_CASES)
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
  const prefillSetName = (name: string) => `${name} (prefill)`

  /** Generate a name for a prefill empty case. */
  const prefillEmptyName = (name: string) => `${name} (prefill empty)`

  /** Generate a name for a prefill empty case. */
  const prefillSingleObjectStore = (name: string) => `${name} (prefill single object store)`

  /** Generate a name for a prefill get case. */
  const prefillGetReadwriteName = (name: string) => `${name} (prefill get readwrite)`

  /** Generate a name for a prefill get case. */
  const prefillGetName = (name: string) => `${name} (prefill get)`

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
    [prefill],
  )

  const benchmark = useMemo(
    () =>
      Benchmark({
        iterations,
        iteration: progress,
        preMeasureIteration: prefillProgress,
        preMeasureIterations: prefill,
        cycle: (name, { mean }) => {
          progress.cancel()
          prefillProgress.cancel()
          setBenchmarkResult(name, {
            mean,
            prefill: 1,
            progress: 1,
          })
        },
        beforeAll: clearDbs,
        afterAll: clearDbs,
      }),
    [iterations, prefill],
  )

  /** Cancels the current run and clears the benchmark results. */
  const cancel = async () => {
    benchmark.cancel()
    clear()
  }

  // specs for all tests
  const tests: {
    [key: string]: (
      db: Database,
      testName: string,
    ) => {
      measure: (i: number) => void | Promise<void>
      preMeasure?: (i: number) => void | Promise<void>
      before?: () => Promise<void>
      after?: () => Promise<void>
    }
  } = {
    // get (readonly)
    [prefillGetName('indexedDB')]: (db: Database, testName: string) => ({
      preMeasure: async i => {
        const storeName = i.toString()
        const store = await db.createStore(storeName)
        await set(db, storeName, i.toString(), data as DataType)
      },
      measure: async i => {
        await db.get(i.toString(), i.toString())
      },
      before: async () => {
        prefillProgress.cancel()
        setBenchmarkResult(testName, { prefill: 1 })
      },
      after: () => after(db),
    }),

    // get (readwrite)
    [prefillGetReadwriteName('indexedDB')]: (db: Database, testName: string) => ({
      preMeasure: async i => {
        const storeName = i.toString()
        const store = await db.createStore(storeName)
        await set(db, storeName, i.toString(), data as DataType)
      },
      measure: async i => {
        await db.get(i.toString(), i.toString(), 'readwrite')
      },
      before: async () => {
        prefillProgress.cancel()
        setBenchmarkResult(testName, { prefill: 1 })
      },
      after: () => after(db),
    }),

    // single object store
    [prefillSingleObjectStore('indexedDB')]: (db, testName) => ({
      preMeasure: async i => {
        const storeName = Math.random().toFixed(16)
        const store = await db.createStore(storeName)
        await set(db, storeName, i.toString(), data as DataType)
      },
      measure: () => createAndSet(db, data as DataType),
      before: async () => {
        prefillProgress.cancel()
        setBenchmarkResult(testName, { prefill: 1 })
      },
      after: () => after(db),
    }),

    // set
    [prefillSetName('indexedDB')]: (db, testName) => ({
      preMeasure: async i => {
        const storeName = Math.random().toFixed(16)
        const store = await db.createStore(storeName)
        await set(db, storeName, i.toString(), data as DataType)
      },
      measure: () => createAndSet(db, data as DataType),
      before: async () => {
        prefillProgress.cancel()
        setBenchmarkResult(testName, { prefill: 1 })
      },
      after: () => after(db),
    }),

    // empty object stores
    [prefillEmptyName('indexedDB')]: (db, testName) => ({
      preMeasure: async i => {
        const storeName = Math.random().toFixed(16)
        const store = await db.createStore(storeName)
        await set(db, storeName, i.toString(), data as DataType)
      },
      measure: () => createAndSet(db, data as DataType),
      before: async () => {
        prefillProgress.cancel()
        setBenchmarkResult(testName, { prefill: 1 })
      },
      after: () => after(db),
    }),
  }

  const run = async () => {
    if (running.current) return

    await clear()
    running.current = true

    // add a case for each db to benchmark
    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [name, db] = dbEntries[i]

      Object.entries(tests).forEach(([testName, testFactory]) => {
        benchmark.add(testName, testFactory(db, testName))
      })
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
            {Object.keys(dbs).map(dbName => (
              <Fragment key={dbName}>
                {Object.keys(tests).map(testName => (
                  <BenchmarkResultRow key={testName} name={testName} result={benchmarkResults[testName]} />
                ))}
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
