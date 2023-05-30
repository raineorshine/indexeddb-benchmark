import BenchmarkResult from '../types/BenchmarkResult'

/** Formats a number with commas in the thousands place. */
const numberWithCommas = (n: number | string, decimals = 3) => {
  const parts = n.toString().split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const before = parts[0]
  const after = (parts[1] || '').slice(0, decimals)
  return `${before}${after ? '.' : ''}${after}`
}

/** Formats a number as a percentage. */
const formatPercentage = (n: number) => (n * 100).toFixed(0) + '%'

/** Formats milliseconds. */
const formatMilliseconds = (ms: number) => (ms ? `${numberWithCommas(ms)} ms` : '0 ms')

/** Formats milliseconds in terms of iterations per second. */
const formatRate = (ms: number) => (ms ? `${numberWithCommas((1000 / ms).toFixed(1))}/sec` : '')

/** A row of benchmark results for a single case within the results table. */
function BenchmarkResultRow({ name, result }: { name: string; result: BenchmarkResult }) {
  return (
    <tr>
      <th>{name}</th>
      <td
        style={{
          minWidth: '2.5em',
          paddingRight: '0.5em',
          color: result?.progress === 1 ? 'gray' : result?.prefill && result.prefill < 1 ? 'goldenrod' : undefined,
        }}
      >
        {result?.progress != null
          ? formatPercentage(result.progress)
          : result?.prefill
          ? formatPercentage(result.prefill)
          : ''}
      </td>
      <td style={{ minWidth: '3.5em' }}>{result?.mean ? formatMilliseconds(result.mean) : ''}</td>
      <td
        title={
          result?.mean && result.mean <= 1
            ? '> 1,000/sec'
            : result?.mean && result.mean > 40
            ? '< 25/sec'
            : result?.mean
            ? '25–1,000/sec'
            : undefined
        }
        style={{
          color:
            result?.mean && result.mean <= 1 ? 'lightgreen' : result?.mean && result.mean > 40 ? 'tomato' : undefined,
          minWidth: '4.5em',
          textAlign: 'left',
        }}
      >
        {result?.mean ? formatRate(result?.mean) : ''}
      </td>
    </tr>
  )
}

export default BenchmarkResultRow