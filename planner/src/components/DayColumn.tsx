import { useState } from 'react'
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
import { Plus } from 'lucide-react'
import type { DayTemplate } from '../types/planner'
import type { PlannerActions } from '../hooks/usePlanner'
import { isToday } from '../lib/weekUtils'
import { SortableBlockCard } from './BlockCard'
import { BlockEditModal } from './BlockEditModal'
import { DayItemsSection } from './DayItemsSection'
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

export function DayColumn({ day, weekStart, planner, items }: DayColumnProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const today = isToday(day.key, weekStart)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sortedBlocks = [...day.blocks].sort((a, b) => a.order - b.order)
  const blockIds = sortedBlocks.map((b) => b.id)
  const editingBlock = sortedBlocks.find((b) => b.id === editingBlockId)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = blockIds.indexOf(String(active.id))
    const newIndex = blockIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const next = [...blockIds]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    planner.reorderBlocks(day.key, next)
  }

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
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            {sortedBlocks.map((block) => (
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
                onAddTask={(label, recurring) =>
                  planner.addTask(day.key, block.id, label, recurring)
                }
                onFlexibleNoteChange={(note) =>
                  planner.setFlexibleNote(day.key, block.id, note)
                }
              />
            ))}
          </SortableContext>
        </DndContext>

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
        />
      )}
    </div>
  )
}
