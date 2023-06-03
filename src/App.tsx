import { Fragment, useCallback, useEffect, useMemo, useRef, useState, memo, createContext } from 'react'
import throttle from 'lodash.throttle'
import indexedDB from './dbs/indexedDB'
import memory from './dbs/memory'
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

const dbs = { memory, indexedDB }

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

const teardown = async (db: Database) => {
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

  const [errors, setErrors] = useState<Form>({})
  const setError = (key: keyof Form, value?: string) =>
    setErrors(errors => ({ ...errors, [key]: value ?? `invalid ${key}` }))
  const clearError = (key: keyof Form, value: string) =>
    setErrors(errors => {
      delete errors[key]
      return errors
    })
  const hasError = () => Object.keys(errors).length === 0

  const [benchmarkResults, setBenchmarkResults] = useState<{
    // key: `${dbName}${testName}`
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
  const setBenchmarkResult = (testKey: string, result: Partial<BenchmarkResult>) => {
    setBenchmarkResults(resultsOld => ({
      ...resultsOld,
      [testKey]: {
        ...resultsOld[testKey],
        ...result,
      },
    }))
  }

  // throttled progress updater
  const progress = useCallback(
    throttle(
      (testKey: string, { i }: { i: number }) => {
        if (!running.current) return
        setBenchmarkResult(testKey, {
          progress: i / iterations,
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
      (testKey: string, { i }: { i: number }) => {
        if (!running.current) return
        setBenchmarkResult(testKey, {
          prefill: i / prefill,
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
        preMeasureIteration: (testKey, { i }) => {
          prefillProgress(testKey, { i })
          if (i === prefill - 1) {
            prefillProgress.flush()
            setBenchmarkResult(testKey, { prefill: 1 })
          }
        },
        preMeasureIterations: prefill,
        cycle: (testKey, { mean }) => {
          prefillProgress.cancel()
          progress.flush()
          setBenchmarkResult(testKey, {
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

  // specs for all tests for a single database
  const tests: {
    [key: string]: (
      db: Database,
      testName: string,
    ) => {
      measure: (i: number) => void | Promise<void>
      preMeasure?: (i: number) => void | Promise<void>
      before?: () => void | Promise<void>
      after?: () => void | Promise<void>
    }
  } = {
    ['get | no prefill']: (db: Database, testName: string) => ({
      preMeasure: async i => {
        if (i > iterations) return
        const storeName = i.toString()
        const store = await db.createStore(storeName)
        await set(db, storeName, i.toString(), data as DataType)
      },
      measure: async i => {
        await db.get(i.toString(), i.toString())
      },
      after: () => teardown(db),
    }),

    ['set! | no prefill']: (db: Database, testName: string) => ({
      preMeasure: async i => {
        if (i > iterations) return
        const storeName = i.toString()
        const store = await db.createStore(storeName)
      },
      measure: async i => {
        const storeName = i.toString()
        await set(db, storeName, i.toString(), data as DataType)
      },
      after: () => teardown(db),
    }),

    ['get | readonly']: (db: Database, testName: string) => ({
      preMeasure: async i => {
        const storeName = i.toString()
        const store = await db.createStore(storeName)
        await set(db, storeName, i.toString(), data as DataType)
      },
      measure: async i => {
        await db.get(i.toString(), i.toString())
      },
      after: () => teardown(db),
    }),

    ['get | readwrite']: (db: Database, testName: string) => ({
      preMeasure: async i => {
        const storeName = i.toString()
        const store = await db.createStore(storeName)
        await set(db, storeName, i.toString(), data as DataType)
      },
      measure: async i => {
        await db.get(i.toString(), i.toString(), 'readwrite')
      },
      after: () => teardown(db),
    }),

    ['get | prefill single object store']: (db, testName) => ({
      before: async () => {
        await db.createStore(testName)
      },
      preMeasure: async i => {
        await set(db, testName, i.toString(), data as DataType)
      },
      measure: async i => {
        await db.get(testName, i.toString())
      },
      after: async () => teardown(db),
    }),

    ['set! | prefill single object store']: (db, testName) => ({
      before: async () => {
        await db.createStore(testName)
      },
      measure: async i => {
        await set(db, testName, i.toString(), data as DataType)
      },
      after: () => teardown(db),
    }),

    ['get | empty prefilled object stores']: (db, testName) => ({
      preMeasure: async i => {
        const storeName = i.toString()
        const store = await db.createStore(storeName)
        await set(db, storeName, i.toString(), data as DataType)
      },
      measure: async i => {
        await db.get(i.toString(), i.toString())
      },
      after: () => teardown(db),
    }),

    ['set! | empty prefilled object stores']: (db, testName) => ({
      preMeasure: async i => {
        const storeName = i.toString()
        const store = await db.createStore(storeName)
      },
      measure: async i => {
        const storeName = i.toString()
        await set(db, storeName, i.toString(), data as DataType)
      },
      after: () => teardown(db),
    }),
  }

  const run = async () => {
    if (running.current) return

    await clear()
    running.current = true

    // add a case for each db to benchmark
    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [dbName, db] = dbEntries[i]

      Object.entries(tests).forEach(([testName, testFactory]) => {
        benchmark.add(`${dbName}-${testName}`, testFactory(db, testName))
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
        <h3>Memory</h3>
        <table>
          <tbody>
            {Object.keys(tests).map(testName => (
              <BenchmarkResultRow key={testName} name={testName} result={benchmarkResults[`memory-${testName}`]} />
            ))}
          </tbody>
        </table>

        <h3>IndexedDB</h3>
        <table>
          <tbody>
            {Object.keys(tests).map(testName => (
              <BenchmarkResultRow key={testName} name={testName} result={benchmarkResults[`indexedDB-${testName}`]} />
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
