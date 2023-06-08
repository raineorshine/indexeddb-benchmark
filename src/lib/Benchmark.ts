import BenchmarkCase from '../types/BenchmarkCase'

/** Asynchronously waits for a number of milliseconds*/
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const Benchmark = ({
  delay = 100,
  cycle,
  iteration,
  iterations = 1000,
  beforeAll,
  afterAll,
  preMeasureIteration,
  preMeasureIterations,
}: {
  delay?: number
  /** Callback invoked after all iterations of a case are run. Not called if run is aborted. */
  cycle?: (
    name: string,
    stats: {
      /** The mean number of milliseconds of an iteration of this case. */
      mean: number
    },
  ) => void | Promise<void>
  /** Callback invoked after a single iteration of a case is run. */
  iteration?: (
    name: string,
    stats: {
      /** The index of the current iteration. */
      i: number
      /** The number of milliseconds of this iteration. */
      ms: number
      /** The running mean number of milliseconds of all iterations so far. */
      mean: number
    },
  ) => void | Promise<void>
  /** Callback invoked after a single iteration of a preMeasure is run. */
  preMeasureIteration?: (name: string, stats: { i: number }) => void | Promise<void>
  /** Total number of iterations to run and measure in each case. */
  iterations?: number
  /** Total number of iterations to run before measurement in each case. */
  preMeasureIterations?: number
  /** Global setup called once at the start of run. */
  beforeAll?: () => void | Promise<void>
  /** Global teardown called once at the end of run. */
  afterAll?: () => void | Promise<void>
} = {}) => {
  const tests: BenchmarkCase[] = []
  let totalms = 0

  // abort current run
  let abort = false

  // track running for cancel method
  let running = false

  /** Resets the benchmark running state. */
  const reset = () => {
    abort = false
    running = false
    totalms = 0
  }

  /** Execute the preMeasure callback for all the iterations of a single test. */
  const runPreMeasure = async ({ name, before, after, preMeasure }: BenchmarkCase): Promise<void> => {
    if (!preMeasure) return
    for (let i = 0; i < (preMeasureIterations || 0); i++) {
      if (abort || !running) {
        reset()
        break
      }
      await preMeasure(i)
      await preMeasureIteration?.(name, { i })
      if (abort || !running) break
    }
  }

  /** Execute and measure all the iterations of a single test. */
  const runCase = async ({ name, bulk, measure, postMeasure }: BenchmarkCase): Promise<void> => {
    for (let i = 0; i < iterations; i++) {
      if (abort || !running) {
        reset()
        break
      }
      const start = performance.now()
      await measure(i)
      const end = performance.now()
      // if doing a bulk operation, each iteration performs multiple operations (bulkIterations), so we need to divide the actual ms by bulkIterations to get an average per-operation measurement that is comparable to non-bulk tests
      const ms = (end - start) / (bulk ?? 1)
      if (abort || !running) break
      totalms += ms
      await iteration?.(name, { i, ms, mean: totalms / (i + 1) })
      if (abort || !running) break
      await postMeasure?.(i)
    }
    if (running && !abort) {
      await cycle?.(name, { mean: totalms / iterations })
      totalms = 0
    }
  }

  const run = async () => {
    if (running) return

    running = true
    await beforeAll?.()

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i]
      await test.before?.(test.name)
      await runPreMeasure(test)
      await sleep(delay)
      await runCase(test)
      await test.after?.(test.name)
      await sleep(delay)
    }

    await afterAll?.()
    reset()
  }

  return {
    /** Cancels an in progress run. Subsequent calls to run will wait for aborted run to wind down. */
    cancel: (): void => {
      if (!running) return
      abort = true
    },

    /** Clears all tests. */
    clear: () => {
      tests.length = 0
      reset()
    },

    /** Adds a new test. */
    add: (name: string, args: Omit<BenchmarkCase, 'name'>) => {
      tests.push({ name, ...args })
    },

    /** Runs all tests and measures performance. */
    run,
  }
}

export default Benchmark
