import dbs from './dbs/index'
import keyValueBy from './lib/keyValueBy'
import BenchmarkCase from './types/BenchmarkCase'
import PayloadType from './types/PayloadType'

const testStoreName = 'test'

/** Calculates a random number from 0 to n. */
const randRange = (n: number) => Math.floor(Math.random() * n)

/** Generates data of a given type. */
const generatePayload = (payloadType: PayloadType) => {
  const value =
    payloadType === 'String(1000)'
      ? new Array(1000).fill(0).join('')
      : payloadType === 'Uint8Array(1000)'
      ? new Uint8Array(1000)
      : null
  if (value === null) {
    throw new Error('Unsupported data type: ' + payloadType)
  }
  return value
}

interface TestSpec {
  prefill: string
  measure: string
  spec: Omit<BenchmarkCase, 'name'>
}

const generateTests = ({
  payloadType,
  iterations,
  limit,
  total,
}: {
  payloadType: PayloadType
  iterations: number
  limit: number
  total: number
}): { [key: string]: TestSpec[] } => {
  const payload = generatePayload(payloadType)
  const pages = Math.ceil(total / limit)
  return keyValueBy(dbs, (dbname, db) => {
    /** Create one object store with [iterations] records with keys [0..iterations-1]. */
    const prefillIterationsOnly = async () => {
      const keys = Object.keys(Array(iterations).fill(0))
      const values = keys.map(() => payload)
      await db.createStore(testStoreName)
      await db.bulkSet(testStoreName, keys, values)
    }

    /** Create one object store with [total] records with keys [0..total-1]. */
    const prefillRecords = async () => {
      const keys = Object.keys(Array(total).fill(0))
      const values = keys.map(() => payload)
      await db.createStore(testStoreName)
      await db.bulkSet(testStoreName, keys, values)
    }

    /** Create [total/limit] object stores with [limit] records with keys [0..liimit-1] in each. */
    const prefillObjectStores = async () => {
      // [total/limit] unique store names
      const storeNames = Object.keys(Array(pages).fill(0))
      // [total] non-unique store names for bulkSet corresponding with each record
      const setStoreNames = storeNames.flatMap((storeName, i) => Array(limit).fill(storeName))
      // [limit] records in each store, with keys [0..limit-1]
      const keys = setStoreNames.map((_, i) => i % limit)
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
            bulk: limit,
            before: prefillIterationsOnly,
            measure: async i => {
              const keys = Object.keys(Array(limit).fill(0))
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
            bulk: limit,
            before: () => db.createStore(testStoreName),
            measure: async i => {
              const keys = Object.keys(Array(limit).fill(0))
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
            measure: i => db.get(testStoreName, randRange(total)),
            after: db.clear,
          },
        },

        {
          prefill: 'records',
          measure: 'getAll',
          spec: {
            bulk: total,
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
            bulk: limit,
            before: prefillRecords,
            measure: async i => {
              const keys = Array(limit)
                .fill(0)
                .map(() => randRange(total))
              await db.bulkGet?.(testStoreName, keys, 'readonly')
            },
            after: db.clear,
          },
        },

        {
          prefill: 'records',
          measure: 'getAllByIndex',
          spec: {
            bulk: limit,
            before: async () => {
              const keys = Object.keys(Array(total).fill(0))
              const values = keys.map((_, i) => ({
                indexable: i % pages,
                payload,
              }))
              await db.createStore(testStoreName)
              await db.createIndex?.(testStoreName, 'indexable')
              await db.bulkSet(testStoreName, keys, values)
            },
            measure: async i => {
              await db.getAllByIndex?.(testStoreName, 'indexable', randRange(pages))
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
            measure: async i => {
              const storeName = (i % pages).toString()
              await db.get(storeName, randRange(limit), 'readonly')
            },
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'get (readwrite)',
          spec: {
            before: prefillObjectStores,
            measure: async i => {
              const storeName = (i % pages).toString()
              await db.get(storeName, randRange(limit), 'readwrite')
            },
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'getAll',
          spec: {
            bulk: limit,
            before: prefillObjectStores,
            measure: async i => {
              const storeName = (i % pages).toString()
              await db.getAll?.(storeName)
            },
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'bulkGet (readonly)',
          spec: {
            bulk: limit,
            before: prefillObjectStores,
            measure: async i => {
              const storeNames = Array(limit)
                .fill(0)
                .map((_, i) => (i % pages).toString())
              const keys = storeNames.map((_, i) => i % limit)
              await db.bulkGet?.(storeNames, keys, 'readonly')
            },
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'bulkGet (readwrite)',
          spec: {
            bulk: limit,
            before: prefillObjectStores,
            measure: async i => {
              const storeNames = Array(limit)
                .fill(0)
                .map((_, i) => (i % pages).toString())
              const keys = storeNames.map((_, i) => i % limit)
              await db.bulkGet?.(storeNames, keys, 'readonly')
            },
            after: db.clear,
          },
        },

        {
          prefill: 'object stores',
          measure: 'bulkGet (single store)',
          spec: {
            bulk: limit,
            before: prefillObjectStores,
            measure: async i => {
              const keys = Object.keys(Array(limit).fill(0))
              await db.bulkGet?.('0', keys, 'readonly')
            },
            after: db.clear,
          },
        },
      ],
    }
  })
}

export default generateTests
