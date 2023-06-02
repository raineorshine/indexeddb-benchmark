interface BenchmarkCase {
  /** The name of the case. This is passed to several of the callbacks. */
  name: string
  /** The synchronous or asynchronous function that will be executed and measured. */
  measure: (i: number) => Promise<void> | void
  /** Callback invoked once before any iterations of a case. */
  before?: (name: string) => Promise<void>
  /** Callback invoked once after all iterations of a case have run. Still called if run is aborted. */
  after?: (name: string) => Promise<void>
}

const Benchmark = ({
  cycle,
  iteration,
  iterations = 1000,
  beforeAll,
  afterAll,
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
  /** Total number of iterations to run in each case. */
  iterations?: number
  /** Global setup called once at the start of run. */
  beforeAll?: () => Promise<void>
  /** Global teardown called once at the end of run. */
  afterAll?: () => Promise<void>
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

  /** Run all the iterations for a single case. */
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
      const p = measure(i)
      if (p instanceof Promise) {
        await p
      }
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
      const { name, measure: f, before, after } = tests[i]
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

    /** Clears all cases. */
    clear: () => {
      tests.length = 0
      reset()
    },

    /** Adds a new case. */
    add: (
      name: string,
      {
        measure,
        before,
        after,
      }: {
        measure: (i: number) => Promise<void> | void
        before?: (name: string) => Promise<void>
        after?: (name: string) => Promise<void>
      },
    ) => {
      tests.push({ name, measure, before, after })
    },

    /** Runs all cases and measures performance. */
    run,
  }
}

export default Benchmark
