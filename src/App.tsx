import { Fragment, useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import throttle from 'lodash.throttle'
import indexedDB from './dbs/indexedDB'
import Benchmark from './lib/Benchmark'
import FormRow from './components/FormRow'
import BenchmarkResultRow from './components/BenchmarkResultRow'
import BenchmarkResult from './types/BenchmarkResult'

type DataType = 'String(1000)' | 'Uint8Array(1000)'

// throttle rate for re-rendering progress %
const PROGRESS_THROTTLE = 250

const DEFAULT_DATA: DataType = 'String(1000)'

// number of iterations per benchmark case
const DEFAULT_ITERATIONS = 100

// number of iterations per benchmark case
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

clearDbs()

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

  const cancel = async () => {
    benchmark.cancel()
    benchmark.clear()
    progress.cancel()
    prefillProgress.cancel()
    clearBenchmarkResults()
    await clearDbs()
    running.current = false
  }

  const run = async () => {
    if (running.current) return

    benchmark.clear()
    clearBenchmarkResults()
    running.current = true

    // add a case for each db to benchmark
    const dbEntries = Object.entries(dbs)
    for (let i = 0; i < dbEntries.length; i++) {
      const [name, db] = dbEntries[i]

      /** Inserts a value in the database based on the selected DataType. */
      const set = async () => {
        const value =
          data === 'String(1000)'
            ? new Array(1000).fill(0).join('')
            : data === 'Uint8Array(1000)'
            ? new Uint8Array(1000)
            : null
        if (value === null) {
          throw new Error('Unsupported data type: ' + data)
        }
        await db.set(Math.random().toFixed(10), value)
      }

      // normal
      benchmark.add(name, set, {
        setup: async name => {
          await clearDbs()
          progress.cancel()
          setBenchmarkResult(name, { progress: 0 })
        },
        teardown: db.clear,
      })

      // prefill
      if (prefill > 0) {
        benchmark.add(prefillName(name), set, {
          setup: async () => {
            setBenchmarkResult(prefillName(name), { prefill: 0 })
            await db.clear()
            for (let i = 0; i < prefill; i++) {
              if (!running.current) return
              await set()
              if (!running.current) return
              prefillProgress(prefillName(name), { i })
            }
            prefillProgress.cancel()
            setBenchmarkResult(prefillName(name), { prefill: 1 })
          },
          teardown: db.clear,
        })
      }
    }

    if (running.current) {
      await benchmark.run()
    }
    running.current = false
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
                description='Number of iterations to measure for each case.'
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
                  <BenchmarkResultRow name={prefillName(name)} result={benchmarkResults[prefillName(name)]} />
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
