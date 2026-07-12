import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { taskDragId, type TaskDragData } from '../lib/taskDnd'
import type { DayKey, TaskKind } from '../types/planner'
import { TaskCheckbox } from './TaskCheckbox'

interface DraggableTaskCheckboxProps {
  dayKey: DayKey
  blockId: string
  taskId: string
  kind: TaskKind
  label: string
  checked: boolean
  onChange: () => void
  onHide?: () => void
  hidden?: boolean
  onRename?: (label: string) => void
  onDelete?: () => void
}

export function DraggableTaskCheckbox({
  dayKey,
  blockId,
  taskId,
  kind,
  label,
  checked,
  onChange,
  onHide,
  hidden,
  onRename,
  onDelete,
}: DraggableTaskCheckboxProps) {
  const dragData: TaskDragData = {
    type: 'task',
    dayKey,
    blockId,
    taskId,
    kind,
    label,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: taskDragId(dayKey, blockId, kind, taskId),
    data: dragData,
  })

  return (
    <div
      ref={setNodeRef}
      className={`group/task flex items-start gap-0.5 ${isDragging ? 'opacity-40' : ''}`}
    >
      <button
        type="button"
        className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-[#48484A] group/task:opacity-100 active:cursor-grabbing"
        aria-label="Move task"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </button>
      <div className="min-w-0 flex-1">
        <TaskCheckbox
          label={label}
          checked={checked}
          oneOff={kind === 'one-off'}
          onChange={onChange}
          onHide={onHide}
          hidden={hidden}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}