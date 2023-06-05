import memory from './memory'
import indexedDB from './indexedDB'

const dbs = {
  memory,
  indexedDB,
} as const

export type DatabaseName = keyof typeof dbs

export default dbs
