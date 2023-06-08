import dbs from './dbs/index'
import keyValueBy from './lib/keyValueBy'
import BenchmarkCase from './types/BenchmarkCase'
import PayloadType from './types/PayloadType'

const testStoreName = 'test'

/** Calculates a random number from 0 to n. */
const randRange = (n: number) => Math.floor(Math.random() * n)

/** Generates data of a given type. */
const generateData = (data: PayloadType) => {
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

interface TestSpec {
  prefill: string
  measure: string
  spec: Omit<BenchmarkCase, 'name'>
}

const generateTests = ({
  data,
  iterations,
  prefill,
}: {
  data: PayloadType
  iterations: number
  prefill: number
}): { [key: string]: TestSpec[] } => {
  const payload = generateData(data)
  return keyValueBy(dbs, (dbname, db) => {
    /** Create one object store with [iterations] records with keys [0..iterations-1]. */
    const prefillIterationsOnly = async () => {
      const keys = Object.keys(Array(iterations).fill(0))
      const values = keys.map(() => payload)
      await db.createStore(testStoreName)
      await db.bulkSet(testStoreName, keys, values)
    }

    /** Create one object store with [prefill] records with keys [0..prefill-1]. */
    const prefillRecords = async () => {
      const keys = Object.keys(Array(prefill).fill(0))
      const values = keys.map(() => payload)
      await db.createStore(testStoreName)
      await db.bulkSet(testStoreName, keys, values)
    }

    /** Create [prefill] object stores with [iterations] records with keys [0..iterations-1] in each. */
    const prefillObjectStores = async () => {
      // unique store names
      const storeNames = Object.keys(Array(prefill).fill(0))
      // store names parallel to keys (i.e. prefill * measure)
      const setStoreNames = storeNames.flatMap((storeName, i) => Array(iterations).fill(storeName))
      // set [iterations] values in each store, with keys 0..iterations-1
      const keys = setStoreNames.map((_, i) => i % iterations)
      const values = keys.map(() => payload)
      await db.createStore(storeNames)
      await db.bulkSet(setStoreNames, keys, values)
    }

    return {
      [dbname]: [
        {
          prefill: '',
          measure: 'get',
          spec: {
            before: prefillIterationsOnly,
            measure: i => db.get(testStoreName, i),
            after: db.clear,
          },
        },

        {
          prefill: '',
          measure: 'bulkGet',
          spec: {
            bulk: iterations,
            before: prefillIterationsOnly,
            measure: async i => {
              const keys = Array(iterations)
                .fill(0)
                .map((value, i) => i)
              await db.bulkGet?.(testStoreName, keys)
            },
            after: db.clear,
          },
        },

        {
          prefill: '',
          measure: 'set',
          spec: {
            before: () => db.createStore(testStoreName),
            measure: i => db.set(testStoreName, i, payload),
            after: db.clear,
          },
        },

        {
          prefill: '',
          measure: 'bulkSet',
          spec: {
            bulk: iterations,
            before: () => db.createStore(testStoreName),
            measure: async i => {
              const keys = Array(iterations)
                .fill(0)
                .map((value, i) => i)
              const values = keys.map(() => payload)
              await db.bulkSet?.(testStoreName, keys, values)
            },
            postMeasure: async () => {
              await db.clear()
              await db.open?.()
              await db.createStore(testStoreName)
            },
            after: db.clear,
          },
        },

        {
          prefill: 'records',
          measure: 'get',
          spec: {
            before: prefillRecords,
            measure: i => db.get(testStoreName, i),
            after: db.clear,
          },
        },

        {
          prefill: 'records',
          measure: 'getAll',
          spec: {
            bulk: prefill,
            before: prefillRecords,
            measure: async i => {
              await db.getAll?.(testStoreName)
            },
            after: db.clear,
          },
        },

        {
          prefill: 'records',
          measure: 'bulkGet',
          spec: {
            bulk: iterations,
            before: prefillRecords,
            measure: async i => {
              const keys = Array(iterations)
                .fill(0)
                .map(() => randRange(iterations))
              await db.bulkGet?.(testStoreName, keys, 'readonly')
            },
            after: db.clear,
          },
        },

        {
          prefill: 'records',
          measure: 'getByIndex',
          spec: {
            before: async () => {
              const keys = Object.keys(Array(prefill).fill(0))
              const values = keys.map((_, i) => ({
                foo: `foo-${i}`,
                payload,
              }))
              await db.createStore(testStoreName)
              await db.createIndex?.(testStoreName, 'foo')
              await db.bulkSet(testStoreName, keys, values)
            },
            measure: async i => {
              await db.getByIndex?.(testStoreName, 'foo', `foo-${i}`)
            },
            after: db.clear,
          },
        },

        {
          prefill: 'records',
          measure: 'set',
          spec: {
            before: () => db.createStore(testStoreName),
            measure: i => db.set(testStoreName, i, payload),
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'get (readonly)',
          spec: {
            before: prefillObjectStores,
            measure: i => db.get(i.toString(), i, 'readonly'),
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'get (readwrite)',
          spec: {
            before: prefillObjectStores,
            measure: i => db.get(i.toString(), i, 'readwrite'),
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'getAll',
          spec: {
            before: prefillObjectStores,
            measure: async i => {
              await db.getAll?.(i.toString())
            },
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'bulkGet (readonly)',
          spec: {
            bulk: iterations,
            before: prefillObjectStores,
            measure: async i => {
              const storeNames = Object.keys(Array(iterations).fill(0))
              const keys = storeNames.map(() => randRange(iterations))
              await db.bulkGet?.(storeNames, keys, 'readonly')
            },
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'bulkGet (readwrite)',
          spec: {
            bulk: iterations,
            before: prefillObjectStores,
            measure: async i => {
              const storeNames = Object.keys(Array(iterations).fill(0))
              const keys = storeNames.map(() => randRange(iterations))
              await db.bulkGet?.(storeNames, keys, 'readwrite')
            },
            after: db.clear,
          },
        },
      ],
    }
  })
}

export default generateTests
