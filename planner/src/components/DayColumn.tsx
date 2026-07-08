import { useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { Block, DayTemplate } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import { isToday } from '../lib/weekUtils'
import { BlockCard, SortableBlockCard } from './BlockCard'
import { BlockEditModal } from './BlockEditModal'
import { DayItemsSection } from './DayItemsSection'
import { TaskCheckbox } from './TaskCheckbox'
import type { ItemsActions } from '../hooks/useItems'

interface DayColumnProps {
  day: DayTemplate
  weekStart: string
  planner: PlannerActions
  items: ItemsActions
}

const DAY_TYPE_COLORS: Record<string, string> = {
  office: '#7B8FA1',
  off: '#9B8EC4',
  wfh: '#5BAFA8',
}

function CollapsibleSection({
  label,
  count,
  expanded,
  onToggle,
  children,
}: {
  label: string
  count: number
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  if (count === 0) return null

  return (
    <div className="mt-1 border-t border-hairline pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 rounded-lg px-1 py-1.5 text-left text-[11px] font-medium text-muted transition-colors hover:bg-[#F2F2F7] hover:text-[#48484A]"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {label} ({count})
      </button>
      {expanded && <div className="mt-1 space-y-2">{children}</div>}
    </div>
  )
}

export function DayColumn({ day, weekStart, planner, items }: DayColumnProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const today = isToday(day.key, weekStart)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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

  const activeBlockIds = activeBlocks.map((b) => b.id)
  const editingBlock = sortedBlocks.find((b) => b.id === editingBlockId)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = activeBlockIds.indexOf(String(active.id))
    const newIndex = activeBlockIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const next = [...activeBlockIds]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    const completedIds = completedBlocks.map((b) => b.id)
    planner.reorderBlocks(day.key, [...next, ...completedIds])
  }

  const taskHandlersForBlock = (blockId: string) => ({
    onRenameTask: (taskId: string, kind: 'recurring' | 'one-off', label: string) => {
      if (kind === 'one-off') {
        planner.renameOneOffTask(day.key, blockId, taskId, label)
      }
    },
    onDeleteTask: (taskId: string, kind: 'recurring' | 'one-off') => {
      if (kind === 'one-off') {
        planner.deleteOneOffTask(day.key, blockId, taskId)
      }
    },
  })

  const renderBlockCard = (block: Block) => (
    <BlockCard
      key={block.id}
      block={block}
      dayKey={day.key}
      blockLog={planner.getBlockLog(day.key, block.id)}
      tasks={planner.getBlockTasks(day.key, block)}
      onEdit={() => setEditingBlockId(block.id)}
      onToggleTask={(taskId, kind) => planner.toggleTask(day.key, block.id, taskId, kind)}
      onHideTask={(taskId, kind) => planner.toggleHideTask(day.key, block.id, taskId, kind)}
      onAddTask={(label, recurring) => planner.addTask(day.key, block.id, label, recurring)}
      onFlexibleNoteChange={(note) => planner.setFlexibleNote(day.key, block.id, note)}
      {...taskHandlersForBlock(block.id)}
    />
  )

  return (
    <div
      className={`flex min-w-[168px] flex-1 flex-col rounded-xl border bg-white ${
        today ? 'border-[#007AFF]/40 ring-1 ring-[#007AFF]/15' : 'border-hairline'
      }`}
    >
      <header className="border-b border-hairline px-3 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold text-[#1C1C1E]">{day.dayName}</span>
          {today && (
            <span className="rounded-full bg-[#007AFF] px-1.5 py-0.5 text-[9px] font-semibold text-white">
              Today
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: DAY_TYPE_COLORS[day.dayType] }}
          />
          <span className="text-[11px] text-muted">{day.tag}</span>
        </div>
      </header>

      <DayItemsSection
        dayKey={day.key}
        weekStart={weekStart}
        occurrences={items.getItemsForDay(day.key)}
        items={items}
      />

      <div className="flex flex-1 flex-col gap-2 p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={activeBlockIds} strategy={verticalListSortingStrategy}>
            {activeBlocks.map((block) => (
              <SortableBlockCard
                key={block.id}
                id={block.id}
                block={block}
                dayKey={day.key}
                blockLog={planner.getBlockLog(day.key, block.id)}
                tasks={planner.getBlockTasks(day.key, block)}
                onEdit={() => setEditingBlockId(block.id)}
                onToggleTask={(taskId, kind) =>
                  planner.toggleTask(day.key, block.id, taskId, kind)
                }
                onHideTask={(taskId, kind) =>
                  planner.toggleHideTask(day.key, block.id, taskId, kind)
                }
                onAddTask={(label, recurring) =>
                  planner.addTask(day.key, block.id, label, recurring)
                }
                onFlexibleNoteChange={(note) =>
                  planner.setFlexibleNote(day.key, block.id, note)
                }
                {...taskHandlersForBlock(block.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <CollapsibleSection
          label="완료됨"
          count={completedBlocks.length}
          expanded={showCompleted}
          onToggle={() => setShowCompleted((v) => !v)}
        >
          {completedBlocks.map((block) => renderBlockCard(block))}
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
              className="rounded-lg bg-[#F2F2F7]/80 px-2 py-1"
            >
              <p className="mb-0.5 text-[10px] font-medium text-muted">{block.title}</p>
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

        <button
          type="button"
          onClick={() => {
            const id = planner.addBlock(day.key)
            setEditingBlockId(id)
          }}
          className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-hairline py-2 text-[12px] text-muted transition-colors hover:border-[#007AFF]/40 hover:bg-[#007AFF]/5 hover:text-[#007AFF]"
        >
          <Plus size={14} />
          Add Block
        </button>
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
          onAddTask={(label, recurring) =>
            planner.addTask(day.key, editingBlock.id, label, recurring)
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
