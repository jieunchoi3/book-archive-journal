import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus } from 'lucide-react'
import { CATEGORY_STYLES } from '../lib/categories'
import type { Block, BlockDayLog, DayKey, RenderTask } from '../types/planner'
import { FLEXIBLE_TAGS } from '../types/planner'
import { TaskCheckbox } from './TaskCheckbox'

interface BlockCardProps {
  block: Block
  dayKey: DayKey
  blockLog: BlockDayLog
  tasks: RenderTask[]
  onEdit: () => void
  onToggleTask: (taskId: string, kind: 'recurring' | 'one-off') => void
  onHideTask?: (taskId: string, kind: 'recurring' | 'one-off') => void
  onAddTask: (label: string, recurring: boolean) => void
  onRenameTask?: (taskId: string, kind: 'recurring' | 'one-off', label: string) => void
  onDeleteTask?: (taskId: string, kind: 'recurring' | 'one-off') => void
  onFlexibleNoteChange: (note: string) => void
  isDragging?: boolean
}

export function BlockCard({
  block,
  blockLog,
  tasks,
  onEdit,
  onToggleTask,
  onHideTask,
  onAddTask,
  onRenameTask,
  onDeleteTask,
  onFlexibleNoteChange,
  isDragging,
}: BlockCardProps) {
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [repeatWeekly, setRepeatWeekly] = useState(false)

  const style = CATEGORY_STYLES[block.category]
  const doneCount = tasks.filter((t) => t.done).length
  const totalTasks = tasks.length

  const handleAddTask = () => {
    const label = newTaskLabel.trim()
    if (!label) return
    onAddTask(label, repeatWeekly)
    setNewTaskLabel('')
    setShowAddTask(false)
    setRepeatWeekly(false)
  }

  return (
    <div
      className={`group/card relative rounded-xl border px-3 py-2.5 transition-shadow duration-150 ${
        isDragging ? 'shadow-lg ring-2 ring-[#007AFF]/20' : 'shadow-sm hover:shadow-md'
      }`}
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
      }}
    >
      <button type="button" onClick={onEdit} className="w-full text-left">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: style.dot }}
              />
              <h3
                className="truncate text-[13px] font-semibold leading-tight"
                style={{ color: style.text }}
              >
                {block.title}
              </h3>
            </div>
            {block.timeRangeLabel && (
              <p className="mt-0.5 pl-3.5 text-[11px] text-muted">{block.timeRangeLabel}</p>
            )}
          </div>
          {totalTasks > 0 && (
            <span className="shrink-0 rounded-md bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-muted">
              {doneCount}/{totalTasks}
            </span>
          )}
        </div>

        {block.description && (
          <p className="mb-1.5 pl-3.5 text-[11px] leading-relaxed text-[#636366]">
            {block.description}
          </p>
        )}

        {block.badges.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1 pl-3.5">
            {block.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-[#636366]"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </button>

      {block.isFlexible && (
        <div className="mt-2 pl-3.5" onClick={(e) => e.stopPropagation()}>
          <div className="mb-1.5 flex flex-wrap gap-1">
            {FLEXIBLE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onFlexibleNoteChange(tag)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  blockLog.flexibleNote === tag
                    ? 'bg-[#5856D6] text-white'
                    : 'bg-white/70 text-[#636366] hover:bg-white'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={blockLog.flexibleNote ?? ''}
            onChange={(e) => onFlexibleNoteChange(e.target.value)}
            placeholder="오늘 뭐 했는지 기록…"
            className="w-full rounded-lg border border-white/80 bg-white/60 px-2 py-1 text-[11px] text-[#1C1C1E] placeholder:text-muted focus:border-[#5856D6]/40 focus:outline-none focus:ring-1 focus:ring-[#5856D6]/20"
          />
        </div>
      )}

      {tasks.length > 0 && (
        <div className="mt-2 space-y-0.5 border-t border-white/50 pt-2 pl-0.5">
          {tasks.map((task) => (
            <TaskCheckbox
              key={task.id}
              label={task.label}
              checked={task.done}
              oneOff={task.kind === 'one-off'}
              onChange={() => onToggleTask(task.id, task.kind)}
              onHide={
                onHideTask ? () => onHideTask(task.id, task.kind) : undefined
              }
              onRename={
                task.kind === 'one-off' && onRenameTask
                  ? (label) => onRenameTask(task.id, task.kind, label)
                  : undefined
              }
              onDelete={
                task.kind === 'one-off' && onDeleteTask
                  ? () => onDeleteTask(task.id, task.kind)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <div className="mt-1.5 pl-0.5" onClick={(e) => e.stopPropagation()}>
        {showAddTask ? (
          <div className="space-y-1.5 rounded-lg border border-white/60 bg-white/40 p-2">
            <input
              type="text"
              value={newTaskLabel}
              onChange={(e) => setNewTaskLabel(e.target.value)}
              placeholder="할 일 추가…"
              autoFocus
              className="w-full rounded-md border border-hairline bg-white px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#007AFF]/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask()
                if (e.key === 'Escape') {
                  setShowAddTask(false)
                  setNewTaskLabel('')
                }
              }}
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#636366]">
              <input
                type="checkbox"
                checked={repeatWeekly}
                onChange={(e) => setRepeatWeekly(e.target.checked)}
                className="rounded"
              />
              매주 반복
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleAddTask}
                className="rounded-md bg-[#007AFF] px-2 py-0.5 text-[10px] font-medium text-white"
              >
                추가
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddTask(false)
                  setNewTaskLabel('')
                }}
                className="rounded-md px-2 py-0.5 text-[10px] text-muted"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] text-muted opacity-0 transition-opacity hover:text-[#007AFF] group-hover/card:opacity-100"
          >
            <Plus size={12} />
            할 일 추가
          </button>
        )}
      </div>
    </div>
  )
}

interface SortableBlockCardProps extends BlockCardProps {
  id: string
}

export function SortableBlockCard(props: SortableBlockCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.id })

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={dragStyle} className="relative">
      <button
        type="button"
        className="absolute -left-1 top-3 z-10 cursor-grab touch-none rounded p-0.5 text-muted opacity-0 transition-opacity group-hover/card:opacity-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Reorder block"
      >
        <GripVertical size={14} />
      </button>
      <BlockCard {...props} isDragging={isDragging} />
    </div>
  )
}
