interface Database {
  clear: () => Promise<void>
  get: (key: string) => Promise<string | undefined>
  set: (key: string, value: any) => Promise<void>
}

export default Database
