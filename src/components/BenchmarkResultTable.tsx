import BenchmarkResult from '../types/BenchmarkResult'
import BenchmarkResultRow from './BenchmarkResultRow'
import { DatabaseName } from '../dbs'

const BenchmarkResultTable = ({
  benchmarkResults,
  dbName,
  iterations,
  onToggleAll,
  onToggleSkip,
  total,
  skipped,
  tests,
}: {
  benchmarkResults: { [key: string]: BenchmarkResult }
  dbName: DatabaseName
  iterations: number
  onToggleAll: () => void
  onToggleSkip: (key: string) => void
  total: number
  skipped: { [key: string]: boolean }
  tests: { prefill: string; measure: string }[]
}) => (
  <table>
    <thead>
      <tr style={{ fontWeight: 'bold' }}>
        <td style={{ paddingRight: '1.5em' }}>
          <a onClick={onToggleAll}>all</a>
        </td>
        <td style={{ textAlign: 'left' }}>Prefill ({total})</td>
        <td style={{ textAlign: 'left' }}>Measure ({iterations})</td>
        <td></td>
        <td>Result</td>
      </tr>
    </thead>
    <tbody>
      {tests.map(test => {
        const testKey = `${dbName}-${test.prefill}-${test.measure}`
        return (
          <BenchmarkResultRow
            key={testKey}
            prefill={test.prefill}
            measure={test.measure}
            result={benchmarkResults[testKey]}
            skip={skipped[testKey]}
            onToggleSkip={() => onToggleSkip(testKey)}
          />
        )
      })}
    </tbody>
  </table>
)

export default BenchmarkResultTable
