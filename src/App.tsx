import { Fragment, useCallback, useEffect, useMemo, useRef, useState, memo, createContext } from 'react'
import throttle from 'lodash.throttle'
import dbs, { DatabaseName } from './dbs/index'
import localStorage from './dbs/localStorage'
import Benchmark from './lib/Benchmark'
import FormRow from './components/FormRow'
import BenchmarkResultTable from './components/BenchmarkResultTable'
import BenchmarkResult from './types/BenchmarkResult'
import Database from './types/Database'
import BenchmarkCase from './types/BenchmarkCase'
import PayloadType from './types/PayloadType'

// throttle rate for re-rendering progress percentage
const PROGRESS_THROTTLE = 33.333

const DEFAULT_DATA: PayloadType = 'Uint8Array(1000)'

// number of insertions per benchmark case
const DEFAULT_ITERATIONS = 100

// number of insertions to prefill per benchmark case
const DEFAULT_PREFILL = 3000

/** Clears all databases. */
const clearDbs = async (): Promise<void> => {
  const dbEntries = Object.entries(dbs)
  for (let i = 0; i < dbEntries.length; i++) {
    const [name, db] = dbEntries[i]
    await db.clear()
  }
}

// set up the localStorage store for benchmark settings that should be persisted between sessions
localStorage.createStore('settings')

/** Set a value on localStorage (throttled). */
const setLocalSetting = throttle((key: string, value: any): void => {
  localStorage.set('settings', key, value)
}, 100)

function App() {
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false)
  const [iterations, setIterations] = useState<number>(DEFAULT_ITERATIONS)
  const [data, setData] = useState<PayloadType>(DEFAULT_DATA)
  const [prefill, setPrefill] = useState<number>(DEFAULT_PREFILL)
  const running = useRef<boolean>(false)

  const [skipped, setSkipped] = useState<{
    [key: string]: boolean
  }>({})

  const [benchmarkResults, setBenchmarkResults] = useState<{
    // key: `${dbName}-${testName}`
    [key: string]: BenchmarkResult
  }>({})

  const payload = useMemo(() => generateData(data), [data])

  /** Calls setSkipped and persists the value to local settings. */
  const setSkippedPersisted = (setter: (skippedOld: typeof skipped) => typeof skipped) => {
    setSkipped(skippedOld => {
      const skippedNew = setter(skippedOld)
      setLocalSetting('skipped', skippedNew)
      return skippedNew
    })
  }

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

  const testStoreName = 'test'

  // specs for all tests for a single database
  const tests: {
    prefill: string
    measure: string
    spec: (db: Database) => Omit<BenchmarkCase, 'name'>
  }[] = [
    {
      prefill: '',
      measure: 'get',
      spec: (db: Database) => ({
        before: async () => {
          // only set iterations, since this test case has no prefill
          const keys = Array(iterations)
            .fill(0)
            .map((_, i) => i)
          const values = keys.map(() => payload)
          await db.createStore(testStoreName)
          await db.bulkSet(testStoreName, keys, values)
        },
        measure: i => db.get(testStoreName, i),
        after: db.clear,
      }),
    },

    {
      prefill: '',
      measure: 'bulkGet',
      spec: db => ({
        bulk: true,
        before: async () => {
          // only set iterations, since this test case has no prefill
          const keys = Array(iterations)
            .fill(0)
            .map((_, i) => i)
          const values = keys.map(() => payload)
          await db.createStore(testStoreName)
          await db.bulkSet(testStoreName, keys, values)
        },
        measure: async i => {
          const keys = Array(iterations)
            .fill(0)
            .map((value, i) => i)
          await db.bulkGet?.(testStoreName, keys)
        },
        after: db.clear,
      }),
    },

    {
      prefill: '',
      measure: 'set',
      spec: db => ({
        before: () => db.createStore(testStoreName),
        measure: i => db.set(testStoreName, i, generateData(data)),
        after: db.clear,
      }),
    },

    {
      prefill: '',
      measure: 'bulkSet',
      spec: db => ({
        bulk: true,
        before: () => db.createStore(testStoreName),
        measure: async i => {
          const keys = Array(iterations)
            .fill(0)
            .map((value, i) => i)
          const values = keys.map(() => generateData(data))
          await db.bulkSet?.(testStoreName, keys, values)
        },
        postMeasure: async () => {
          await db.clear()
          await db.open?.()
          await db.createStore(testStoreName)
        },
        after: db.clear,
      }),
    },

    {
      prefill: 'records',
      measure: 'get',
      spec: db => ({
        before: async () => {
          const keys = Array(prefill)
            .fill(0)
            .map((_, i) => i)
          const values = keys.map(() => payload)
          await db.createStore(testStoreName)
          await db.bulkSet(testStoreName, keys, values)
        },
        measure: i => db.get(testStoreName, i),
        after: db.clear,
      }),
    },

    {
      prefill: 'records',
      measure: 'set',
      spec: db => ({
        before: () => db.createStore(testStoreName),
        measure: i => db.set(testStoreName, i, generateData(data)),
        after: db.clear,
      }),
    },

    {
      prefill: 'object stores',
      measure: 'get (readonly)',
      spec: (db: Database) => ({
        before: async () => {
          const keys = Array(prefill)
            .fill(0)
            .map((_, i) => i)
          const storeNames = Object.keys(keys)
          const values = keys.map(() => payload)
          await db.createStore(storeNames)
          await db.bulkSet(storeNames, keys, values)
        },
        measure: i => db.get(i.toString(), i, 'readonly'),
        after: db.clear,
      }),
    },

    {
      prefill: 'object stores',
      measure: 'get (readwrite)',
      spec: (db: Database) => ({
        before: async () => {
          const keys = Array(prefill)
            .fill(0)
            .map((_, i) => i)
          const storeNames = Object.keys(keys)
          const values = keys.map(() => payload)
          await db.createStore(storeNames)
          await db.bulkSet(storeNames, keys, values)
        },
        measure: i => db.get(i.toString(), i, 'readwrite'),
        after: db.clear,
      }),
    },

    {
      prefill: 'object stores',
      measure: 'bulkGet (readonly)',
      spec: (db: Database) => ({
        bulk: true,
        before: async () => {
          const keys = Array(prefill)
            .fill(0)
            .map((_, i) => i)
          const storeNames = Object.keys(keys)
          const values = keys.map(() => payload)
          await db.createStore(storeNames)
          await db.bulkSet(storeNames, keys, values)
        },
        measure: async i => {
          const keys = Array(iterations)
            .fill(0)
            .map((value, i) => i)
          const storeNames = Object.keys(keys)
          await db.bulkGet?.(storeNames, keys, 'readonly')
        },
        after: db.clear,
      }),
    },

    {
      prefill: 'object stores',
      measure: 'bulkGet (readwrite)',
      spec: (db: Database) => ({
        bulk: true,
        before: async () => {
          const keys = Array(prefill)
            .fill(0)
            .map((_, i) => i)
          const storeNames = Object.keys(keys)
          const values = keys.map(() => payload)
          await db.createStore(storeNames)
          await db.bulkSet(storeNames, keys, values)
        },
        measure: async i => {
          const keys = Array(iterations)
            .fill(0)
            .map((value, i) => i)
          const storeNames = Object.keys(keys)
          await db.bulkGet?.(storeNames, keys, 'readwrite')
        },
        after: db.clear,
      }),
    },
  ]

  const run = async () => {
    if (running.current) return

    await clear()
    running.current = true

    // add a case for each db to benchmark
    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [dbName, db] = dbEntries[i]

      await db.open?.()
      tests.forEach(({ prefill, measure, spec }) => {
        const testKey = `${dbName}-${prefill}-${measure}`
        if (!skipped[testKey]) {
          benchmark.add(testKey, spec(db, `${prefill}-${measure}`))
        }
      })
      await db.close?.()
    }

    if (running.current) {
      await benchmark.run()
    }
    running.current = false
  }

  useEffect(() => {
    clearDbs()
    localStorage.get('settings', 'skipped').then(skipped => {
      if (skipped) {
        setSkipped(skipped)
      }
      setSettingsLoaded(true)
    })
  }, [])

  /** Toggles all tests skipped at once. */
  const toggleAllSkipped = useCallback(
    (dbName: DatabaseName, value?: boolean) => {
      setSkippedPersisted(skippedOld => {
        const firstSkipped = skippedOld[`${dbName}-${tests[0].prefill}-${tests[0].measure}`]
        return tests.reduce((accum, test) => {
          const testKey = `${dbName}-${test.prefill}-${test.measure}`
          return { ...accum, [testKey]: value ?? !firstSkipped }
        }, skippedOld)
      })
    },
    [tests],
  )

  /** Toggles a single test skipped. */
  const toggleSkip = useCallback(
    (testKey: string, value?: boolean) => {
      setSkippedPersisted(skippedOld => ({
        ...skippedOld,
        [testKey]: value ?? !skippedOld[testKey],
      }))
    },
    [skipped],
  )

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

        {settingsLoaded &&
          (Object.keys(dbs) as DatabaseName[]).map(dbName => (
            <Fragment key={dbName}>
              <h3>{dbName}</h3>
              <BenchmarkResultTable
                benchmarkResults={benchmarkResults}
                dbName={dbName}
                iterations={iterations}
                onToggleAll={() => toggleAllSkipped(dbName)}
                onToggleSkip={toggleSkip}
                prefill={prefill}
                skipped={skipped}
                tests={tests}
              />
            </Fragment>
          ))}

        <p>
          <button onClick={run} style={{ margin: '0.5em' }}>
            Run benchmark
          </button>
          <button
            onClick={cancel}
            disabled={Object.keys(benchmarkResults).length === 0 && !running.current}
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
