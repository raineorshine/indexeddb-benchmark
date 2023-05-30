interface BenchmarkCase {
  /** The name of the case. This is passed to several of the callbacks. */
  name: string
  /** The synchronous or asynchronous function that will be executed and measured. */
  f: () => Promise<void> | void
  /** Callback invoked once before any iterations of a case. */
  setup?: (name: string) => Promise<void>
  /** Callback invoked once after all iterations of a case have run. */
  teardown?: (name: string) => Promise<void>
}

const Benchmark = ({
  cycle,
  iteration,
  iterations = 1000,
  setup,
  teardown,
}: {
  /** Callback invoked after all iterations of a case are run. */
  cycle?: (
    name: string,
    stats: {
      /** The mean number of milliseconds of an iteration of this case. */
      mean: number
    },
  ) => void
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
  ) => void
  /** Total number of iterations to run in each case. */
  iterations?: number
  /** Global setup called once at the start of run. */
  setup?: () => Promise<void>
  /** Global teardown called once at the end of run. */
  teardown?: () => Promise<void>
} = {}) => {
  const cases: BenchmarkCase[] = []
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
  const runCase = async ({ name, setup, teardown, f }: BenchmarkCase): Promise<void> => {
    await setup?.(name)
    if (abort) {
      return teardown?.(name)
    }
    for (let j = 0; j < iterations; j++) {
      if (abort || !running) {
        await teardown?.(name)
        reset()
        return
      }
      const start = performance.now()
      await Promise.resolve(f())
      if (abort || !running) break
      const end = performance.now()
      const ms = end - start
      totalms += ms
      iteration?.(name, { i: j, ms, mean: totalms / (j + 1) })
    }
    if (running && !abort) {
      cycle?.(name, { mean: totalms / iterations })
    }
    await teardown?.(name)
  }

  const run = async () => {
    if (running) return

    running = true
    await setup?.()

    for (let i = 0; i < cases.length; i++) {
      const { name, f, setup, teardown } = cases[i]
      if (abort || !running) break
      await runCase(cases[i])
    }

    await teardown?.()
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
      cases.length = 0
      reset()
    },

    /** Adds a new case. */
    add: (
      name: string,
      f: () => Promise<void> | void,
      { setup, teardown }: { setup?: (name: string) => Promise<void>; teardown?: (name: string) => Promise<void> } = {},
    ) => {
      cases.push({ name, f, setup, teardown })
    },

    /** Runs all cases and measures performance. */
    run,
  }
}

export default Benchmark
