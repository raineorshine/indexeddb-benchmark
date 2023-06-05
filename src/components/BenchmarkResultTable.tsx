import BenchmarkResult from '../types/BenchmarkResult'
import BenchmarkResultRow from './BenchmarkResultRow'
import { DatabaseName } from '../dbs'

const BenchmarkResultTable = ({
  benchmarkResults,
  dbName,
  onToggleAll,
  onToggleSkip,
  skipped,
  testNames,
}: {
  benchmarkResults: { [key: string]: BenchmarkResult }
  dbName: DatabaseName
  onToggleAll: () => void
  onToggleSkip: (testName: string) => void
  skipped: { [key: string]: boolean }
  testNames: string[]
}) => (
  <table>
    <tbody>
      <tr>
        <td>
          <a onClick={onToggleAll}>all</a>
        </td>
      </tr>
      {testNames.map(testName => (
        <BenchmarkResultRow
          key={testName}
          name={testName}
          result={benchmarkResults[`${dbName}-${testName}`]}
          skip={skipped[`${dbName}-${testName}`]}
          onToggleSkip={() => onToggleSkip(testName)}
        />
      ))}
    </tbody>
  </table>
)

export default BenchmarkResultTable
