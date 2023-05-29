interface Database {
  clear: () => Promise<void>
  get: (key: string) => Promise<string | undefined>
  set: (key: string, value: string) => Promise<void>
}

export default Database
