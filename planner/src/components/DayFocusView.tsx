import { useMemo, useState } from 'react'
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Plus } from 'lucide-react'
import type { Block, DayKey, DayTemplate } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import { blockDragId } from '../lib/taskDnd'
import { formatShortDateForDay, isToday } from '../lib/weekUtils'
import { BlockCard, SortableBlockCard } from './BlockCard'
import { BlockEditModal } from './BlockEditModal'
import { DayItemsSection } from './DayItemsSection'
import { TaskCheckbox } from './TaskCheckbox'
import type { ItemsActions } from '../hooks/useItems'

const DAY_TYPE_COLORS: Record<string, string> = {
  office: '#7B8FA1',
  off: '#9B8EC4',
  wfh: '#5BAFA8',
}

interface DayFocusViewProps {
  day: DayTemplate
  weekStart: string
  allDays: DayTemplate[]
  planner: PlannerActions
  items: ItemsActions
  onClose: () => void
  onNavigateDay: (dayKey: DayKey) => void
}

function CollapsibleSection({
  label,
  count,
  expanded,
  onToggle,
  children,
  horizontal = false,
}: {
  label: string
  count: number
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  horizontal?: boolean
}) {
  if (count === 0) return null

  return (
    <div className="mt-4 border-t border-hairline pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 rounded-lg px-1 py-1.5 text-left text-[12px] font-medium text-muted transition-colors hover:bg-[#F2F2F7] hover:text-[#48484A]"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
        {label} ({count})
      </button>
      {expanded && (
        <div
          className={`mt-2 ${horizontal ? 'flex gap-3 overflow-x-auto pb-2' : 'space-y-2'}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DayFocusView({
  day,
  weekStart,
  allDays,
  planner,
  items,
  onClose,
  onNavigateDay,
}: DayFocusViewProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const today = isToday(day.key, weekStart)
  const dayIndex = allDays.findIndex((d) => d.key === day.key)
  const stats = planner.dayCompletion[day.key]

  const sortedBlocks = useMemo(
    () => [...day.blocks].sort((a, b) => a.order - b.order),
    [day.blocks],
  )

  const { activeBlocks, completedBlocks, hiddenEntries } = useMemo(() => {
    const active: Block[] = []
    const completed: Block[] = []
    const hidden: { block: Block; taskId: string; kind: 'recurring' | 'one-off'; label: string }[] =
      []

    for (const block of sortedBlocks) {
      if (planner.isBlockCompleteForDay(day.key, block)) {
        completed.push(block)
      } else {
        active.push(block)
      }

      for (const task of planner.getHiddenBlockTasks(day.key, block)) {
        hidden.push({
          block,
          taskId: task.id,
          kind: task.kind,
          label: task.label,
        })
      }
    }

    return { activeBlocks: active, completedBlocks: completed, hiddenEntries: hidden }
  }, [sortedBlocks, day.key, planner])

  const activeBlockSortableIds = activeBlocks.map((b) => blockDragId(day.key, b.id))
  const editingBlock = sortedBlocks.find((b) => b.id === editingBlockId)

  const taskHandlersForBlock = (blockId: string) => ({
    onRenameTask: (taskId: string, kind: 'recurring' | 'one-off', label: string) => {
      if (kind === 'one-off') {
        planner.renameOneOffTask(day.key, blockId, taskId, label)
      } else {
        planner.renameRecurringTask(day.key, blockId, taskId, label)
      }
    },
    onDeleteTask: (taskId: string, kind: 'recurring' | 'one-off') => {
      if (kind === 'one-off') {
        planner.deleteOneOffTask(day.key, blockId, taskId)
      } else {
        planner.deleteRecurringTask(day.key, blockId, taskId, 'template')
      }
    },
  })

  const renderBlockCard = (block: Block, className?: string) => (
    <div key={block.id} className={className}>
      <BlockCard
        block={block}
        dayKey={day.key}
        blockLog={planner.getBlockLog(day.key, block.id)}
        tasks={planner.getBlockTasks(day.key, block)}
        onEdit={() => setEditingBlockId(block.id)}
        onToggleTask={(taskId, kind) => planner.toggleTask(day.key, block.id, taskId, kind)}
        onHideTask={(taskId, kind) => planner.toggleHideTask(day.key, block.id, taskId, kind)}
        onAddTask={(label, recurrence) => planner.addTask(day.key, block.id, label, recurrence)}
        onFlexibleNoteChange={(note) => planner.setFlexibleNote(day.key, block.id, note)}
        {...taskHandlersForBlock(block.id)}
      />
    </div>
  )

  const blockCardProps = (block: Block) => ({
    block,
    dayKey: day.key,
    blockLog: planner.getBlockLog(day.key, block.id),
    tasks: planner.getBlockTasks(day.key, block),
    onEdit: () => setEditingBlockId(block.id),
    onToggleTask: (taskId: string, kind: 'recurring' | 'one-off') =>
      planner.toggleTask(day.key, block.id, taskId, kind),
    onHideTask: (taskId: string, kind: 'recurring' | 'one-off') =>
      planner.toggleHideTask(day.key, block.id, taskId, kind),
    onAddTask: (label: string, recurrence: import('../types/item').Recurrence | null) =>
      planner.addTask(day.key, block.id, label, recurrence),
    onFlexibleNoteChange: (note: string) => planner.setFlexibleNote(day.key, block.id, note),
    ...taskHandlersForBlock(block.id),
  })

  return (
    <div className="rounded-xl border border-hairline bg-white shadow-sm">
      <header
        className={`border-b px-4 py-4 ${today ? 'border-[#007AFF]/25 bg-gradient-to-r from-[#007AFF]/10 to-white' : 'border-hairline'}`}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-[#007AFF] hover:bg-[#007AFF]/10"
          >
            <ArrowLeft size={16} />
            Week
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={dayIndex <= 0}
              onClick={() => onNavigateDay(allDays[dayIndex - 1]!.key)}
              className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7] disabled:opacity-30"
              aria-label="Previous day"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={dayIndex >= allDays.length - 1}
              onClick={() => onNavigateDay(allDays[dayIndex + 1]!.key)}
              className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7] disabled:opacity-30"
              aria-label="Next day"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <h2
                className={`text-[22px] font-semibold ${today ? 'text-[#007AFF]' : 'text-[#1C1C1E]'}`}
              >
                {day.dayName}
                <span
                  className={`ml-2 text-[16px] font-normal ${today ? 'text-[#007AFF]/75' : 'text-muted'}`}
                >
                  {formatShortDateForDay(weekStart, day.key)}
                </span>
              </h2>
              {today && (
                <span className="rounded-full bg-[#007AFF] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md shadow-[#007AFF]/30">
                  Today
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: DAY_TYPE_COLORS[day.dayType] }}
              />
              <span className="text-[13px] text-muted">{day.tag}</span>
            </div>
          </div>
          {stats.total > 0 && (
            <div className="text-right">
              <p className="text-[20px] font-semibold tabular-nums text-[#1C1C1E]">
                {stats.done}/{stats.total}
              </p>
              <p className="text-[11px] text-muted">tasks done</p>
            </div>
          )}
        </div>
      </header>

      <div className="border-b border-hairline">
        <DayItemsSection
          dayKey={day.key}
          weekStart={weekStart}
          occurrences={items.getItemsForDay(day.key)}
          items={items}
        />
      </div>

      <div className="p-4">
        <SortableContext
          items={activeBlockSortableIds}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {activeBlocks.map((block) => (
              <div key={block.id} className="w-[min(300px,85vw)] shrink-0">
                <SortableBlockCard
                  sortableId={blockDragId(day.key, block.id)}
                  {...blockCardProps(block)}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const id = planner.addBlock(day.key)
                setEditingBlockId(id)
              }}
              className="flex w-[min(160px,40vw)] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline py-8 text-[12px] text-muted transition-colors hover:border-[#007AFF]/40 hover:bg-[#007AFF]/5 hover:text-[#007AFF]"
            >
              <Plus size={18} />
              Add Block
            </button>
          </div>
        </SortableContext>

        <CollapsibleSection
          label="완료됨"
          count={completedBlocks.length}
          expanded={showCompleted}
          onToggle={() => setShowCompleted((v) => !v)}
          horizontal
        >
          {completedBlocks.map((block) =>
            renderBlockCard(block, 'w-[min(280px,80vw)] shrink-0'),
          )}
        </CollapsibleSection>

        <CollapsibleSection
          label="숨김"
          count={hiddenEntries.length}
          expanded={showHidden}
          onToggle={() => setShowHidden((v) => !v)}
        >
          {hiddenEntries.map(({ block, taskId, kind, label }) => (
            <div
              key={`${block.id}-${taskId}`}
              className="rounded-lg bg-[#F2F2F7]/80 px-3 py-2"
            >
              <p className="mb-0.5 text-[11px] font-medium text-muted">{block.title}</p>
              <TaskCheckbox
                label={label}
                checked={false}
                oneOff={kind === 'one-off'}
                hidden
                onChange={() => {}}
                onHide={() => planner.toggleHideTask(day.key, block.id, taskId, kind)}
              />
            </div>
          ))}
        </CollapsibleSection>
      </div>

      {editingBlock && (
        <BlockEditModal
          block={editingBlock}
          oneOffTasks={planner.getOneOffTasks(day.key, editingBlock.id)}
          onSave={(updated) => planner.updateBlock(day.key, updated)}
          onDelete={() => {
            planner.deleteBlock(day.key, editingBlock.id)
            setEditingBlockId(null)
          }}
          onClose={() => setEditingBlockId(null)}
          onAddTask={(label, recurrence) =>
            planner.addTask(day.key, editingBlock.id, label, recurrence)
          }
          onDeleteRecurringTask={(taskId, scope) =>
            planner.deleteRecurringTask(day.key, editingBlock.id, taskId, scope)
          }
          onDeleteOneOffTask={(taskId) =>
            planner.deleteOneOffTask(day.key, editingBlock.id, taskId)
          }
          onRenameOneOffTask={(taskId, label) =>
            planner.renameOneOffTask(day.key, editingBlock.id, taskId, label)
          }
        />
      )}
    </div>
  )
}
