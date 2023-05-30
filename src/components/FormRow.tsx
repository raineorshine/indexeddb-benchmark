import { useState, memo } from 'react'

const FormRow = memo(function FormRow({
  defaultValue,
  description,
  label,
  set,
  type = 'number',
  options,
}: {
  defaultValue?: string
  description: string
  label: string
  options?: string[]
  set: (value: string) => void
  type?: 'number' | 'radio'
}) {
  const [selected, setSelected] = useState<string | undefined>(options?.[0])
  const [value, setValue] = useState<string>(defaultValue || '')

  return (
    <>
      <tr>
        <td style={{ width: '25%', maxWidth: '12em', verticalAlign: 'top' }}>
          <span style={{ minWidth: '6em', display: 'inline-block', marginRight: '0.5em', textAlign: 'right' }}>
            {label}:
          </span>
        </td>
        <td style={{ textAlign: 'left' }}>
          {type === 'number' ? (
            <input
              type='number'
              onChange={(e: any) => {
                const value = parseInt(e.target.value, 10)
                if (isNaN(value)) {
                  return
                }
                set(e.target.value)
                setValue(e.target.value)
              }}
              style={{
                width: '5em',
                padding: '0.25em 0.5em',
                textAlign: 'right',
              }}
              value={value}
            />
          ) : (
            <>
              {options?.map(option => (
                <label key={option} style={{ display: 'block' }}>
                  <input
                    type='radio'
                    name={label}
                    checked={option === selected}
                    onChange={e => {
                      if (e.target.value) {
                        setSelected(option)
                        set(option)
                        setValue(option)
                      }
                    }}
                  />{' '}
                  {option}
                </label>
              ))}
            </>
          )}
        </td>
      </tr>
      <tr>
        <td colSpan={2}>
          <p
            style={{
              color: 'gray',
              margin: '0.5em 1em 1em',
              marginTop: type === 'radio' ? 0 : '0.5em',
              maxWidth: '16em',
              textAlign: 'left',
            }}
          >
            {description}
          </p>
        </td>
      </tr>
    </>
  )
})

export default FormRow
