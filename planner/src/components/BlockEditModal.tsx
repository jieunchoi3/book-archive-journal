import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react'
import { CATEGORY_OPTIONS, CATEGORY_STYLES } from '../lib/categories'
import type { Block, BlockCategory, OneOffTask } from '../types/planner'
import { createTask } from '../context/PlannerDataContext'

interface BlockEditModalProps {
  block: Block
  oneOffTasks: OneOffTask[]
  onSave: (block: Block) => void
  onDelete: () => void
  onClose: () => void
  onAddTask: (label: string, recurring: boolean) => void
  onDeleteRecurringTask: (taskId: string, scope: 'week' | 'template') => void
  onDeleteOneOffTask: (taskId: string) => void
  onRenameOneOffTask: (taskId: string, label: string) => void
}

export function BlockEditModal({
  block,
  oneOffTasks,
  onSave,
  onDelete,
  onClose,
  onAddTask,
  onDeleteRecurringTask,
  onDeleteOneOffTask,
  onRenameOneOffTask,
}: BlockEditModalProps) {
  const [draft, setDraft] = useState<Block>({ ...block })
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [repeatWeekly, setRepeatWeekly] = useState(true)
  const [newBadge, setNewBadge] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)

  useEffect(() => {
    setDraft({ ...block })
  }, [block])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const style = CATEGORY_STYLES[draft.category]

  const moveTask = (index: number, dir: -1 | 1) => {
    const next = [...draft.tasks]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setDraft({ ...draft, tasks: next })
  }

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  const handleAddTask = () => {
    const label = newTaskLabel.trim()
    if (!label) return
    if (repeatWeekly) {
      setDraft({ ...draft, tasks: [...draft.tasks, createTask(label)] })
    } else {
      onAddTask(label, false)
    }
    setNewTaskLabel('')
    setRepeatWeekly(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-hairline bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-hairline bg-white/95 px-5 py-4 backdrop-blur-sm">
          <h2 className="text-[15px] font-semibold">Edit Block</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div
            className="rounded-xl border px-3 py-2"
            style={{ backgroundColor: style.bg, borderColor: style.border }}
          >
            <label className="mb-1 block text-[11px] font-medium text-muted">Title</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full bg-transparent text-[15px] font-semibold focus:outline-none"
              style={{ color: style.text }}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((opt) => {
                const s = CATEGORY_STYLES[opt.value]
                const selected = draft.category === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraft({ ...draft, category: opt.value as BlockCategory })}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-all ${
                      selected ? 'ring-2 ring-[#007AFF]/30' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: s.bg,
                      borderColor: s.border,
                      color: s.text,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.dot }}
                    />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted">Time Range</label>
            <input
              type="text"
              value={draft.timeRangeLabel}
              onChange={(e) => setDraft({ ...draft, timeRangeLabel: e.target.value })}
              placeholder="e.g. ~19–21시"
              className="w-full rounded-lg border border-hairline px-3 py-2 text-[13px] focus:border-[#007AFF]/40 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted">Description</label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-lg border border-hairline px-3 py-2 text-[13px] focus:border-[#007AFF]/40 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20"
            />
          </div>

          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={!!draft.isFlexible}
              onChange={(e) => setDraft({ ...draft, isFlexible: e.target.checked })}
              className="rounded"
            />
            Flexible Deep Work (daily log)
          </label>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted">Badges</label>
            <div className="mb-2 flex flex-wrap gap-1">
              {draft.badges.map((badge, i) => (
                <span
                  key={badge}
                  className="flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[12px]"
                >
                  {badge}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        badges: draft.badges.filter((_, j) => j !== i),
                      })
                    }
                    className="text-muted hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value)}
                placeholder="Add badge…"
                className="flex-1 rounded-lg border border-hairline px-3 py-1.5 text-[13px] focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newBadge.trim()) {
                    setDraft({ ...draft, badges: [...draft.badges, newBadge.trim()] })
                    setNewBadge('')
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newBadge.trim()) return
                  setDraft({ ...draft, badges: [...draft.badges, newBadge.trim()] })
                  setNewBadge('')
                }}
                className="rounded-lg bg-surface px-3 py-1.5 text-[13px] hover:bg-hairline"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted">
              Recurring Tasks (매주 반복)
            </label>
            <div className="space-y-1">
              {draft.tasks.map((task, i) => (
                <div key={task.id}>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={task.label}
                      onChange={(e) => {
                        const tasks = [...draft.tasks]
                        tasks[i] = { ...task, label: e.target.value }
                        setDraft({ ...draft, tasks })
                      }}
                      className="flex-1 rounded-lg border border-hairline px-3 py-1.5 text-[13px] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => moveTask(i, -1)}
                      disabled={i === 0}
                      className="rounded p-1 text-muted hover:bg-surface disabled:opacity-30"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTask(i, 1)}
                      disabled={i === draft.tasks.length - 1}
                      className="rounded p-1 text-muted hover:bg-surface disabled:opacity-30"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTaskId(deleteTaskId === task.id ? null : task.id)
                      }
                      className="rounded p-1 text-muted hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {deleteTaskId === task.id && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-2 py-1.5">
                      <span className="text-[11px] text-red-700">삭제 범위:</span>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteRecurringTask(task.id, 'template')
                          setDraft({
                            ...draft,
                            tasks: draft.tasks.filter((t) => t.id !== task.id),
                          })
                          setDeleteTaskId(null)
                        }}
                        className="rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white"
                      >
                        매주에서 삭제
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteRecurringTask(task.id, 'week')
                          setDeleteTaskId(null)
                        }}
                        className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-red-200"
                      >
                        이번 주만
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTaskId(null)}
                        className="text-[10px] text-muted"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {oneOffTasks.length > 0 && (
              <div className="mt-3">
                <label className="mb-1.5 block text-[11px] font-medium text-muted">
                  One-off Tasks (오늘만)
                </label>
                <div className="space-y-1">
                  {oneOffTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-1">
                      <input
                        type="text"
                        defaultValue={task.label}
                        onBlur={(e) => {
                          const trimmed = e.target.value.trim()
                          if (trimmed && trimmed !== task.label) {
                            onRenameOneOffTask(task.id, trimmed)
                          }
                        }}
                        className="flex-1 rounded-lg border border-dashed border-hairline px-3 py-1.5 text-[13px] text-[#636366] focus:border-[#007AFF]/40 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20"
                      />
                      <span className="shrink-0 text-[9px] text-muted">오늘만</span>
                      <button
                        type="button"
                        onClick={() => onDeleteOneOffTask(task.id)}
                        className="rounded p-1 text-muted hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-2 space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskLabel}
                  onChange={(e) => setNewTaskLabel(e.target.value)}
                  placeholder="New task…"
                  className="flex-1 rounded-lg border border-hairline px-3 py-1.5 text-[13px] focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTask()
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTask}
                  className="flex items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-[13px] hover:bg-hairline"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#636366]">
                <input
                  type="checkbox"
                  checked={repeatWeekly}
                  onChange={(e) => setRepeatWeekly(e.target.checked)}
                  className="rounded"
                />
                매주 반복
              </label>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-hairline bg-white/95 px-5 py-4 backdrop-blur-sm">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-red-600">Delete this block?</span>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-medium text-white"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-[12px] text-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-[13px] text-red-500 hover:text-red-600"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-[#007AFF] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#0066DD]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
