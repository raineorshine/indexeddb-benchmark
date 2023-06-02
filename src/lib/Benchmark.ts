interface BenchmarkCase {
  /** The name of the case. This is passed to several of the callbacks. */
  name: string
  /** The function that will be executed and measured once for each iteration. */
  measure: (i: number) => void | Promise<void>
  /** The function to be executed once per iteration before measurement starts. Useful for prefilling the database. */
  preMeasure?: (i: number) => void | Promise<void>
  /** Callback invoked once before any iterations of a case. */
  before?: (name: string) => void | Promise<void>
  /** Callback invoked once after all iterations of a case have run. Still called if run is aborted. */
  after?: (name: string) => void | Promise<void>
}

const Benchmark = ({
  cycle,
  iteration,
  iterations = 1000,
  beforeAll,
  afterAll,
  preMeasureIteration,
  preMeasureIterations,
}: {
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
  const runCase = async ({ name, before, after, measure }: BenchmarkCase): Promise<void> => {
    await before?.(name)
    if (abort) {
      return after?.(name)
    }
    for (let i = 0; i < iterations; i++) {
      if (abort || !running) {
        reset()
        break
      }
      const start = performance.now()
      await measure(i)
      if (abort || !running) break
      const end = performance.now()
      const ms = end - start
      totalms += ms
      await iteration?.(name, { i, ms, mean: totalms / (i + 1) })
    }
    if (running && !abort) {
      await cycle?.(name, { mean: totalms / iterations })
      totalms = 0
    }
    await after?.(name)
  }

  const run = async () => {
    if (running) return

    running = true
    await beforeAll?.()

    for (let i = 0; i < tests.length; i++) {
      if (abort || !running) break
      await runPreMeasure(tests[i])
      if (abort || !running) break
      await runCase(tests[i])
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
    add: (
      name: string,
      args: {
        preMeasure?: (i: number) => void | Promise<void>
        measure: (i: number) => void | Promise<void>
        before?: (name: string) => void | Promise<void>
        after?: (name: string) => void | Promise<void>
      },
    ) => {
      tests.push({ name, ...args })
    },

    /** Runs all tests and measures performance. */
    run,
  }
}

export default Benchmark
