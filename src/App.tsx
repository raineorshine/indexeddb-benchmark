import { Fragment, useCallback, useEffect, useMemo, useRef, useState, memo, createContext } from 'react'
import throttle from 'lodash.throttle'
import dbs, { DatabaseName } from './dbs/index'
import localStorage from './dbs/localStorage'
import Benchmark from './lib/Benchmark'
import FormRow from './components/FormRow'
import BenchmarkResultTable from './components/BenchmarkResultTable'
import BenchmarkResult from './types/BenchmarkResult'
import generateTests from './tests'
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

  const tests = useMemo(() => generateTests({ data, iterations, prefill }), [data, iterations, prefill])

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
      const [dbname, db] = dbEntries[i]

      await db.open?.()
      tests[dbname].forEach(({ prefill, measure, spec }) => {
        const testKey = `${dbname}-${prefill}-${measure}`
        if (!skipped[testKey]) {
          benchmark.add(testKey, spec)
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
    (dbname: DatabaseName, value?: boolean) => {
      setSkippedPersisted(skippedOld => {
        const firstSkipped = skippedOld[`${dbname}-${tests[dbname][0].prefill}-${tests[dbname][0].measure}`]
        return tests[dbname].reduce((accum, test) => {
          const testKey = `${dbname}-${test.prefill}-${test.measure}`
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
          (Object.keys(dbs) as DatabaseName[]).map(dbname => (
            <Fragment key={dbname}>
              <h3>{dbname}</h3>
              <BenchmarkResultTable
                benchmarkResults={benchmarkResults}
                dbName={dbname}
                iterations={iterations}
                onToggleAll={() => toggleAllSkipped(dbname)}
                onToggleSkip={toggleSkip}
                prefill={prefill}
                skipped={skipped}
                tests={tests[dbname]}
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
