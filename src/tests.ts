import dbs from './dbs/index'
import keyValueBy from './lib/keyValueBy'
import BenchmarkCase from './types/BenchmarkCase'
import PayloadType from './types/PayloadType'

const testStoreName = 'test'

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
  return keyValueBy(dbs, (dbname, db) => ({
    [dbname]: [
      {
        prefill: '',
        measure: 'get',
        spec: {
          before: async () => {
            // only set iterations, since this test case has no prefill
            const keys = Array(iterations)
              .fill(0)
              .map((_, i) => i)
            const values = keys.map(() => payload)
            await db.createStore(testStoreName)
            await db.bulkSet(testStoreName, keys, values)
          },
          measure: i => db.get(testStoreName, i),
          after: db.clear,
        },
      },

      {
        prefill: '',
        measure: 'bulkGet',
        spec: {
          bulk: true,
          before: async () => {
            // only set iterations, since this test case has no prefill
            const keys = Array(iterations)
              .fill(0)
              .map((_, i) => i)
            const values = keys.map(() => payload)
            await db.createStore(testStoreName)
            await db.bulkSet(testStoreName, keys, values)
          },
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
          measure: i => db.set(testStoreName, i, generateData(data)),
          after: db.clear,
        },
      },

      {
        prefill: '',
        measure: 'bulkSet',
        spec: {
          bulk: true,
          before: () => db.createStore(testStoreName),
          measure: async i => {
            const keys = Array(iterations)
              .fill(0)
              .map((value, i) => i)
            const values = keys.map(() => generateData(data))
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
          before: async () => {
            const keys = Array(prefill)
              .fill(0)
              .map((_, i) => i)
            const values = keys.map(() => payload)
            await db.createStore(testStoreName)
            await db.bulkSet(testStoreName, keys, values)
          },
          measure: i => db.get(testStoreName, i),
          after: db.clear,
        },
      },

      {
        prefill: 'records',
        measure: 'set',
        spec: {
          before: () => db.createStore(testStoreName),
          measure: i => db.set(testStoreName, i, generateData(data)),
          after: db.clear,
        },
      },

      {
        prefill: 'object stores',
        measure: 'get (readonly)',
        spec: {
          before: async () => {
            const keys = Array(prefill)
              .fill(0)
              .map((_, i) => i)
            const storeNames = Object.keys(keys)
            const values = keys.map(() => payload)
            await db.createStore(storeNames)
            await db.bulkSet(storeNames, keys, values)
          },
          measure: i => db.get(i.toString(), i, 'readonly'),
          after: db.clear,
        },
      },

      {
        prefill: 'object stores',
        measure: 'get (readwrite)',
        spec: {
          before: async () => {
            const keys = Array(prefill)
              .fill(0)
              .map((_, i) => i)
            const storeNames = Object.keys(keys)
            const values = keys.map(() => payload)
            await db.createStore(storeNames)
            await db.bulkSet(storeNames, keys, values)
          },
          measure: i => db.get(i.toString(), i, 'readwrite'),
          after: db.clear,
        },
      },

      {
        prefill: 'object stores',
        measure: 'bulkGet (readonly)',
        spec: {
          bulk: true,
          before: async () => {
            const keys = Array(prefill)
              .fill(0)
              .map((_, i) => i)
            const storeNames = Object.keys(keys)
            const values = keys.map(() => payload)
            await db.createStore(storeNames)
            await db.bulkSet(storeNames, keys, values)
          },
          measure: async i => {
            const keys = Array(iterations)
              .fill(0)
              .map((value, i) => i)
            const storeNames = Object.keys(keys)
            await db.bulkGet?.(storeNames, keys, 'readonly')
          },
          after: db.clear,
        },
      },

      {
        prefill: 'object stores',
        measure: 'bulkGet (readwrite)',
        spec: {
          bulk: true,
          before: async () => {
            const keys = Array(prefill)
              .fill(0)
              .map((_, i) => i)
            const storeNames = Object.keys(keys)
            const values = keys.map(() => payload)
            await db.createStore(storeNames)
            await db.bulkSet(storeNames, keys, values)
          },
          measure: async i => {
            const keys = Array(iterations)
              .fill(0)
              .map((value, i) => i)
            const storeNames = Object.keys(keys)
            await db.bulkGet?.(storeNames, keys, 'readwrite')
          },
          after: db.clear,
        },
      },
    ],
  }))
}

export default generateTests
