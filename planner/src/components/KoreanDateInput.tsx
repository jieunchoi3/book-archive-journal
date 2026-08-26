import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'

interface KoreanDateInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  min?: string
  max?: string
}

function isoToDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  return `${iso.slice(0, 4)}/${iso.slice(5, 7)}/${iso.slice(8, 10)}`
}

function parseDisplay(text: string): string | null {
  const normalized = text.trim().replace(/[.-]/g, '/')
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const iso = `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return iso
}

export function KoreanDateInput({ value, onChange, className = '', min, max }: KoreanDateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(() => isoToDisplay(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(isoToDisplay(value))
  }, [value, editing])

  const commitDraft = () => {
    const parsed = parseDisplay(draft)
    if (parsed) {
      onChange(parsed)
      setDraft(isoToDisplay(parsed))
    } else {
      setDraft(isoToDisplay(value))
    }
    setEditing(false)
  }

  const openPicker = () => {
    const picker = pickerRef.current
    if (!picker) return
    if (typeof picker.showPicker === 'function') {
      picker.showPicker()
      return
    }
    picker.click()
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="YYYY/MM/DD"
        value={editing ? draft : isoToDisplay(value)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          setEditing(true)
          setDraft(isoToDisplay(value))
        }}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={className}
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-[#F2F2F7] hover:text-[#48484A]"
        aria-label="달력에서 선택"
      >
        <Calendar size={15} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value}
        min={min}
        max={max}
        lang="ko-KR"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onChange(e.target.value)
          setDraft(isoToDisplay(e.target.value))
          setEditing(false)
        }}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
    </div>
  )
}
