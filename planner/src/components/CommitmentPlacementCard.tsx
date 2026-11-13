import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import type { WeekCommitment, WeekCommitmentPlacement } from '../types/weekCommitment'
import {
  commitmentPlacementDragId,
  type CommitmentPlacementDragData,
} from '../lib/taskDnd'
import { TaskCheckbox } from './TaskCheckbox'

interface CommitmentPlacementCardProps {
  placement: WeekCommitmentPlacement
  commitment: WeekCommitment
  onToggleTask: (taskId: string) => void
  onAddTask: (label: string) => void
  onDeleteTask: (taskId: string) => void
  onRenameTask: (taskId: string, label: string) => void
  onRemove: () => void
}

export function CommitmentPlacementCard({
  placement,
  commitment,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onRenameTask,
  onRemove,
}: CommitmentPlacementCardProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState('')

  const data: CommitmentPlacementDragData = {
    type: 'commitment-placement',
    placementId: placement.id,
    dayKey: placement.dayKey,
    title: commitment.title,
    color: commitment.color,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: commitmentPlacementDragId(placement.id),
    data,
  })

  const doneCount = placement.tasks.filter((t) => t.done).length
  const total = placement.tasks.length

  const submitAdd = () => {
    const label = draft.trim()
    if (!label) return
    onAddTask(label)
    setDraft('')
    setShowAdd(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={`group/card relative rounded-xl border px-3 py-2.5 shadow-sm transition-shadow duration-150 hover:shadow-md ${
        isDragging ? 'opacity-50 ring-2 ring-[#007AFF]/25' : ''
      }`}
      style={{
        backgroundColor: `${commitment.color}12`,
        borderColor: `${commitment.color}40`,
      }}
    >
      <div className="mb-1 flex items-start gap-1">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted opacity-60 hover:opacity-100 active:cursor-grabbing"
          aria-label="드래그하여 다른 요일로 이동"
          {...listeners}
          {...attributes}
        >
          <GripVertical size={14} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: commitment.color }}
            />
            <h3
              className="truncate text-[13px] font-semibold leading-tight"
              style={{ color: commitment.color }}
            >
              {commitment.title}
            </h3>
          </div>
          {total > 0 && (
            <p className="mt-0.5 pl-3.5 text-[10px] text-muted">
              {doneCount}/{total}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted opacity-0 transition-opacity hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] group-hover/card:opacity-100"
          aria-label="배치 제거 (풀로 반환)"
          title="배치 제거"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <ul className="mt-1 space-y-0.5">
        {placement.tasks
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((task) => (
            <li key={task.id}>
              <TaskCheckbox
                label={task.label}
                checked={task.done}
                oneOff={!task.repeatWeekly}
                onChange={() => onToggleTask(task.id)}
                onRename={(label) => onRenameTask(task.id, label)}
                onDelete={() => onDeleteTask(task.id)}
              />
            </li>
          ))}
      </ul>

      {showAdd ? (
        <div className="mt-1.5 flex gap-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === 'Enter') {
                e.preventDefault()
                submitAdd()
              }
              if (e.key === 'Escape') {
                setShowAdd(false)
                setDraft('')
              }
            }}
            placeholder="서브태스크…"
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2 py-1 text-[11px] outline-none focus:border-[#007AFF]/40"
          />
          <button
            type="button"
            onClick={submitAdd}
            className="rounded-lg bg-[#007AFF] px-2 py-1 text-[10px] font-medium text-white"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] text-muted opacity-70 transition-opacity hover:bg-white/60 hover:opacity-100"
        >
          <Plus size={12} />
          Task
        </button>
      )}
    </div>
  )
}
