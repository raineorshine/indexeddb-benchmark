interface BenchmarkCase {
  /** The name of the case. This is passed to several of the callbacks. */
  name: string
  /** If true, assumes that measure performs all iterations in one bulk operation. The results will still be averaged over all the benchark's iterations, but the per-operation time will be divided by iterations so that it is comparable with non-bulk tests. */
  bulk?: boolean
  /** Callback invoked once before any iterations of a case (after preMeasure). */
  before?: (name: string) => void | Promise<void>
  /** The function to be executed once per iteration before measurement starts. Useful for prefilling the database. */
  preMeasure?: (i: number) => void | Promise<void>
  /** The function to be executed once per iteration after an iteration of measurement. */
  postMeasure?: (i: number) => void | Promise<void>
  /** The function that will be executed and measured once for each iteration. */
  measure: (i: number) => void | Promise<void>
  /** Callback invoked once after all iterations of a case have run. Still called if run is aborted. */
  after?: (name: string) => void | Promise<void>
}

export default BenchmarkCase
