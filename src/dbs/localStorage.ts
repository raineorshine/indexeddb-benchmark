import DatabaseRunner from '../types/DatabaseRunner'
import DatabaseRunnerConfig from '../types/DatabaseRunnerConfig'

console.log('hello')
const runner: DatabaseRunner = (config: DatabaseRunnerConfig): void => {
  console.log('localStorage runner', config)
}

export default runner
