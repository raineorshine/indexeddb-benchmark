import { useMemo } from 'react'
import BenchmarkResult from '../types/BenchmarkResult'
import { getScale } from 'color2k'

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
const formatRate = (ms: number) => (ms ? `${numberWithCommas((1000 / ms).toFixed(1))}/sec` : 'very fast')

/** Generates a scaling function that gives a color a certain % along a gradient. */
const colorScale = getScale('lightgreen', 'goldenrod', 'tomato')

/** Generates a color from red to yellow to green for a number 1–100,000. */
const rateColor = (ms: number) => colorScale(ms / 7)

/** A row of benchmark results for a single case within the results table. */
function BenchmarkResultRow({
  prefill,
  measure,
  result,
  skip,
  onToggleSkip,
}: {
  prefill?: string
  measure: string
  result: BenchmarkResult
  skip?: boolean
  onToggleSkip: () => void
}) {
  const skipStyle = useMemo(() => (skip ? { opacity: 0.2 } : undefined), [skip])

  return (
    <tr>
      <td style={{ textAlign: 'left' }}>
        <input type='checkbox' onChange={onToggleSkip} checked={!skip} />
      </td>
      <td style={{ textAlign: 'left', ...skipStyle }}>
        <a onClick={onToggleSkip} style={{ color: 'inherit' }}>
          {prefill}
        </a>
      </td>
      <td style={{ textAlign: 'left', ...skipStyle }}>
        <a onClick={onToggleSkip} style={{ color: 'inherit' }}>
          {measure}
        </a>
      </td>
      <td
        style={{
          minWidth: '2.5em',
          paddingRight: '0.5em',
          color:
            result?.progress === 1
              ? 'gray'
              : result?.beforeProgress && result.beforeProgress < 1
              ? 'goldenrod'
              : undefined,
          ...skipStyle,
        }}
      >
        {result?.progress != null
          ? formatPercentage(result.progress)
          : result?.beforeProgress
          ? formatPercentage(result.beforeProgress)
          : ''}
      </td>
      <td style={{ minWidth: '3.5em', ...skipStyle }}>{result?.mean != null ? formatMilliseconds(result.mean) : ''}</td>
      <td
        title={
          result?.mean && result.mean <= 1
            ? '> 1,000/sec'
            : result?.mean && result.mean > 40
            ? '< 25/sec'
            : result?.mean
            ? '25–1,000/sec'
            : 'very fast'
        }
        style={{
          color: result?.mean ? rateColor(result.mean) : undefined,
          minWidth: '4.5em',
          textAlign: 'left',
          ...skipStyle,
        }}
      >
        {result?.mean != null ? formatRate(result?.mean) : ''}
      </td>
    </tr>
  )
}

export default BenchmarkResultRow
