import { useState } from 'react'
import type { ItemsActions } from '../hooks/useItems'
import type { Recurrence, RRuleDay } from '../types/item'
import { EventCategoryPicker } from './EventCategoryPicker'
import { RecurrenceFields } from './RecurrenceFields'

export interface EventAddPayload {
  title: string
  recurrence: Recurrence | null
  categoryId: string | null
  time?: string
}

interface EventQuickAddFormProps {
  items: ItemsActions
  onAdd: (payload: EventAddPayload) => void
  onCancel: () => void
  compact?: boolean
  defaultWeeklyDay?: RRuleDay
}

export function EventQuickAddForm({
  items,
  onAdd,
  onCancel,
  compact = false,
  defaultWeeklyDay,
}: EventQuickAddFormProps) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const inputClass = compact
    ? 'w-full rounded-md border border-hairline bg-white px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30'
    : 'w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30'

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd({
      title: trimmed,
      recurrence,
      categoryId,
      time: time.trim() || undefined,
    })
  }

  return (
    <div
      className={
        compact
          ? 'space-y-1.5 rounded-xl border border-hairline bg-white p-2 shadow-lg'
          : 'space-y-2 rounded-xl border border-dashed border-hairline bg-[#FAFAFA] p-3'
      }
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="이벤트 제목"
        autoFocus
        className={inputClass}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <EventCategoryPicker
        categories={items.categories}
        selectedId={categoryId}
        onSelect={setCategoryId}
        items={items}
        compact={compact}
      />
      <RecurrenceFields
        recurrence={recurrence}
        onRecurrenceChange={setRecurrence}
        compact={compact}
        defaultWeeklyDay={defaultWeeklyDay}
      />
      {!compact && (
        <input
          type="text"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="시간 (선택) 16:30–18:30"
          className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] focus:outline-none"
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!title.trim()}
          onClick={submit}
          className={`rounded-lg bg-[#007AFF] font-medium text-white disabled:opacity-40 ${
            compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'
          }`}
        >
          추가
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-lg text-muted ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'}`}
        >
          취소
        </button>
      </div>
    </div>
  )
}
