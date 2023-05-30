import { Fragment, useCallback, useEffect, useMemo, useState, memo } from 'react'
import throttle from 'lodash.throttle'
import localStorage from './dbs/localStorage'
import indexedDB from './dbs/indexedDB'
import Benchmark from './lib/Benchmark'

interface BenchmarkResult {
  mean?: number
  prefill?: number
  progress?: number
}

type DataType = 'String(100)' | 'Uint8Array(100)'

// throttle rate for re-rendering progress %
const PROGRESS_THROTTLE = 400

const DEFAULT_DATA: DataType = 'String(100)'

// number of iterations per benchmark case
const DEFAULT_ITERATIONS = 100

// number of iterations per benchmark case
const DEFAULT_PREFILL = 3000

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

const FormRow = memo(function FormRow({
  defaultValue,
  description,
  label,
  set,
  type = 'number',
  options,
}: {
  defaultValue?: string
  description: string
  label: string
  options?: string[]
  set: (value: string) => void
  type?: 'number' | 'radio'
}) {
  const [selected, setSelected] = useState<string | undefined>(options?.[0])
  const [value, setValue] = useState<string>(defaultValue || '')

  return (
    <>
      <tr>
        <td style={{ width: '25%', maxWidth: '12em', verticalAlign: 'top' }}>
          <span style={{ minWidth: '6em', display: 'inline-block', marginRight: '0.5em', textAlign: 'right' }}>
            {label}:
          </span>
        </td>
        <td style={{ textAlign: 'left' }}>
          {type === 'number' ? (
            <input
              type='number'
              onChange={(e: any) => {
                const value = parseInt(e.target.value, 10)
                if (isNaN(value)) {
                  return
                }
                set(e.target.value)
                setValue(e.target.value)
              }}
              style={{
                width: '5em',
                padding: '0.25em 0.5em',
                textAlign: 'right',
              }}
              value={value}
            />
          ) : (
            <>
              {options?.map(option => (
                <label key={option} style={{ display: 'block' }}>
                  <input
                    type='radio'
                    name={label}
                    checked={option === selected}
                    onChange={e => {
                      if (e.target.value) {
                        setSelected(option)
                        set(option)
                        setValue(option)
                      }
                    }}
                  />{' '}
                  {option}
                </label>
              ))}
            </>
          )}
        </td>
      </tr>
      <tr>
        <td colSpan={2}>
          <p
            style={{
              color: 'gray',
              margin: '0.5em 1em 1em',
              marginTop: type === 'radio' ? 0 : '0.5em',
              maxWidth: '16em',
              textAlign: 'left',
            }}
          >
            {description}
          </p>
        </td>
      </tr>
    </>
  )
})

/** A row of benchmark results for a single case within the results table. */
function BenchmarkResultRow({ name, result }: { name: string; result: BenchmarkResult }) {
  return (
    <tr>
      <th>{name}</th>
      <td
        style={{
          minWidth: '2.5em',
          paddingRight: '0.5em',
          color: result?.progress === 1 ? 'gray' : result?.prefill && result.prefill < 1 ? 'goldenrod' : undefined,
        }}
      >
        {result?.progress != null
          ? formatPercentage(result.progress)
          : result?.prefill
          ? formatPercentage(result.prefill)
          : ''}
      </td>
      <td style={{ minWidth: '3.5em' }}>{result?.mean ? formatMilliseconds(result.mean) : ''}</td>
      <td
        title={
          result?.mean && result.mean <= 1
            ? '> 1,000/sec'
            : result?.mean && result.mean > 40
            ? '< 25/sec'
            : result?.mean
            ? '25–1,000/sec'
            : undefined
        }
        style={{
          color:
            result?.mean && result.mean <= 1 ? 'lightgreen' : result?.mean && result.mean > 40 ? 'tomato' : undefined,
          minWidth: '4.5em',
          textAlign: 'left',
        }}
      >
        {result?.mean ? formatRate(result?.mean) : ''}
      </td>
    </tr>
  )
}

function App() {
  // benchmark config
  const [iterations, setIterations] = useState<number>(DEFAULT_ITERATIONS)
  const [data, setData] = useState<string>(DEFAULT_DATA)
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
          progress.flush()
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
        const value =
          data === 'String(100)'
            ? Math.random().toFixed(100 - 2)
            : data === 'Uint8Array(100)'
            ? new Uint8Array(100)
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
          setBenchmarkResult(name, {
            progress: 0,
          })
        },
        teardown: db.clear,
      })

      // prefill
      benchmark.add(prefillName(name), set, {
        setup: async () => {
          setBenchmarkResult(prefillName(name), {
            prefill: 0,
          })
          await db.clear()
          for (let i = 0; i < prefill; i++) {
            await set()
            prefillProgress(prefillName(name), { i })
            setBenchmarkResult(prefillName(name), {
              prefill: (i + 1) / prefill,
            })
          }
          setBenchmarkResult(name, {
            prefill: 1,
          })
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
        <h2 style={{ marginBottom: '1.2em' }}>Config</h2>
        <table style={{ marginLeft: '3em', width: '100%' }}>
          <tbody>
            <FormRow
              defaultValue={DEFAULT_DATA}
              description='Type of data to insert each iteration.'
              label='Data'
              options={useMemo(() => ['String(100)', 'Uint8Array(100)'], [])}
              set={useCallback(value => setData(value), [])}
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
