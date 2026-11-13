import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  Plus,
  Repeat,
  Trash2,
  X,
} from 'lucide-react'
import { usePlannerSidebarCollapsed } from '../hooks/usePlannerSidebarCollapsed'
import { useWeekCommitments } from '../context/WeekCommitmentContext'
import {
  COMMITMENT_COLORS,
  type CommitmentDefaultTask,
  type WeekCommitment,
} from '../types/weekCommitment'
import {
  commitmentSlotDragId,
  type CommitmentSlotDragData,
} from '../lib/taskDnd'
import { generateId } from '../lib/weekUtils'
import type { ReactNode } from 'react'

interface CommitmentsPanelProps {
  renderQuickLaunch?: (collapsed: boolean) => ReactNode
}

function PoolChip({
  commitment,
  slotIndex,
}: {
  commitment: WeekCommitment
  slotIndex: number
}) {
  const data: CommitmentSlotDragData = {
    type: 'commitment-slot',
    commitmentId: commitment.id,
    slotIndex,
    title: commitment.title,
    color: commitment.color,
  }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: commitmentSlotDragId(commitment.id, slotIndex),
    data,
  })

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[11px] font-medium shadow-sm transition-opacity ${
        isDragging ? 'opacity-40' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{
        borderColor: `${commitment.color}55`,
        backgroundColor: `${commitment.color}14`,
        color: commitment.color,
      }}
      title={`${commitment.title} — 요일로 드래그`}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: commitment.color }}
      />
      <span className="truncate">{commitment.title}</span>
    </button>
  )
}

function CommitmentEditor({
  commitment,
  remaining,
  onUpdate,
  onDelete,
}: {
  commitment: WeekCommitment
  remaining: number
  onUpdate: (
    updates: Partial<
      Pick<WeekCommitment, 'title' | 'color' | 'targetPerWeek' | 'defaultTasks'>
    >,
  ) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [draftTask, setDraftTask] = useState('')

  const addDefaultTask = (repeatWeekly: boolean) => {
    const label = draftTask.trim()
    if (!label) return
    const task: CommitmentDefaultTask = {
      id: generateId(),
      label,
      repeatWeekly,
    }
    onUpdate({ defaultTasks: [...commitment.defaultTasks, task] })
    setDraftTask('')
  }

  return (
    <li className="rounded-xl border border-hairline bg-white/80 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 rounded p-0.5 text-muted hover:bg-[#F2F2F7]"
          aria-expanded={open}
          aria-label="커밋먼트 세부 편집"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={commitment.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full truncate bg-transparent text-[13px] font-semibold text-[#1C1C1E] outline-none"
            aria-label="커밋먼트 제목"
          />
          <p className="mt-0.5 text-[10px] text-muted">
            {commitment.targetPerWeek - remaining}/{commitment.targetPerWeek} 이번 주 · 남은{' '}
            {remaining}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-muted hover:bg-[#FF3B30]/10 hover:text-[#FF3B30]"
          aria-label="커밋먼트 삭제"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2 border-t border-hairline pt-2">
          <label className="flex items-center justify-between gap-2 text-[11px] text-muted">
            <span>주당 목표</span>
            <input
              type="number"
              min={0}
              max={21}
              value={commitment.targetPerWeek}
              onChange={(e) =>
                onUpdate({ targetPerWeek: Number(e.target.value) || 0 })
              }
              className="w-14 rounded-lg border border-hairline bg-white px-2 py-1 text-right text-[12px] text-[#1C1C1E]"
            />
          </label>

          <div className="flex flex-wrap gap-1">
            {COMMITMENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onUpdate({ color })}
                className={`h-5 w-5 rounded-full border-2 ${
                  commitment.color === color ? 'border-[#1C1C1E]' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`색상 ${color}`}
              />
            ))}
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              기본 서브태스크
            </p>
            <ul className="space-y-1">
              {commitment.defaultTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-1.5 rounded-lg bg-[#F2F2F7]/80 px-2 py-1 text-[11px]"
                >
                  <span className="min-w-0 flex-1 truncate text-[#3C3C43]">{t.label}</span>
                  {t.repeatWeekly && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9px] font-medium text-[#007AFF]"
                      title="매주 반복"
                    >
                      <Repeat size={10} />
                      매주
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({
                        defaultTasks: commitment.defaultTasks.filter((x) => x.id !== t.id),
                      })
                    }
                    className="rounded p-0.5 text-muted hover:text-[#FF3B30]"
                    aria-label="서브태스크 삭제"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex gap-1">
              <input
                value={draftTask}
                onChange={(e) => setDraftTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addDefaultTask(true)
                  }
                }}
                placeholder="서브태스크 추가…"
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2 py-1 text-[11px] outline-none focus:border-[#007AFF]/40"
              />
              <button
                type="button"
                onClick={() => addDefaultTask(true)}
                className="rounded-lg bg-[#007AFF]/10 px-2 py-1 text-[10px] font-medium text-[#007AFF]"
                title="매주 반복 기본값"
              >
                매주
              </button>
              <button
                type="button"
                onClick={() => addDefaultTask(false)}
                className="rounded-lg bg-[#F2F2F7] px-2 py-1 text-[10px] font-medium text-muted"
                title="한 번만 복사"
              >
                1회
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

export function CommitmentsPanel({ renderQuickLaunch }: CommitmentsPanelProps) {
  const { setCollapsed } = usePlannerSidebarCollapsed()
  const {
    commitments,
    remainingSlots,
    poolSlots,
    addCommitment,
    updateCommitment,
    deleteCommitment,
    getCommitment,
  } = useWeekCommitments()

  return (
    <aside className="w-56 shrink-0">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Weekly commitments
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white hover:text-[#1C1C1E] hover:shadow-sm"
          aria-label="Hide sidebar"
          title="Hide sidebar"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <ul className="space-y-2">
        {commitments.map((c) => (
          <CommitmentEditor
            key={c.id}
            commitment={c}
            remaining={remainingSlots(c.id)}
            onUpdate={(updates) => updateCommitment(c.id, updates)}
            onDelete={() => deleteCommitment(c.id)}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={() => addCommitment()}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-hairline py-2 text-[12px] text-muted transition-colors hover:border-[#007AFF]/40 hover:bg-[#007AFF]/5 hover:text-[#007AFF]"
      >
        <Plus size={14} />
        Add commitment
      </button>

      <div className="mt-4 border-t border-hairline pt-3">
        <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Blocks to distribute
        </h3>
        {poolSlots.length === 0 ? (
          <p className="px-1 text-[11px] leading-relaxed text-muted">
            {commitments.length === 0
              ? '커밋먼트를 추가하면 이번 주 슬롯이 여기에 나타납니다.'
              : '이번 주 슬롯을 모두 배치했습니다. 다음 월요일에 다시 채워집니다.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {poolSlots.map(({ commitmentId, slotIndex }) => {
              const c = getCommitment(commitmentId)
              if (!c) return null
              return (
                <PoolChip
                  key={`${commitmentId}:${slotIndex}`}
                  commitment={c}
                  slotIndex={slotIndex}
                />
              )
            })}
          </div>
        )}
      </div>

      {renderQuickLaunch?.(false)}
    </aside>
  )
}
