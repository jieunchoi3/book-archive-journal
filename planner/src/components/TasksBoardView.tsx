import { useMemo, useState } from 'react'
import type { ItemsActions } from '../hooks/useItems'
import type { Category } from '../types/item'
import { NO_CATEGORY_ID } from '../types/item'
import { CategoryFilterRow } from './CategoryFilterRow'
import { TagFilterRow } from './TagFilterRow'
import { TasksColumn } from './TasksColumn'
import { QuickLaunchPanel } from './QuickLaunchPanel'
import type { LinkedAppsActions } from '../hooks/useLinkedApps'

interface TasksBoardViewProps {
  items: ItemsActions
  linkedApps: LinkedAppsActions
}

export function TasksBoardView({ items, linkedApps }: TasksBoardViewProps) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [tagFilters, setTagFilters] = useState<string[]>([])

  const toggleTagFilter = (id: string) => {
    setTagFilters((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  const columns = useMemo((): { category: Category | null; categoryId: string | null }[] => {
    if (categoryFilter === 'all') {
      const cols: { category: Category | null; categoryId: string | null }[] =
        items.categories.map((cat) => ({
          category: cat,
          categoryId: cat.id,
        }))
      cols.push({ category: null, categoryId: null })
      return cols
    }
    if (categoryFilter === NO_CATEGORY_ID) {
      return [{ category: null, categoryId: null }]
    }
    const cat = items.categories.find((c) => c.id === categoryFilter)
    return cat ? [{ category: cat, categoryId: cat.id }] : []
  }, [categoryFilter, items.categories])

  const filteredAll = useMemo(
    () => items.filterItems(items.items, categoryFilter, tagFilters),
    [items, categoryFilter, tagFilters],
  )

  return (
    <div className="flex min-h-screen flex-col pb-20">
      <QuickLaunchPanel linkedApps={linkedApps} layout="horizontal" />
      <header className="border-b border-hairline bg-white px-6 py-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-[#1C1C1E]">Tasks</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {filteredAll.length} item{filteredAll.length !== 1 ? 's' : ''}
        </p>
      </header>

      <div className="space-y-3 px-6 py-4">
        <CategoryFilterRow
          categories={items.categories}
          selected={categoryFilter}
          onSelect={setCategoryFilter}
          items={items}
        />
        <TagFilterRow
          tags={items.tags}
          selected={tagFilters}
          onToggle={toggleTagFilter}
          items={items}
        />
      </div>

      <div className="flex flex-1 gap-3 overflow-x-auto px-6 pb-6">
        {columns.map(({ category, categoryId }) => {
          const columnItems = items.getColumnItems(categoryId, categoryFilter, tagFilters)
          const stats = items.getColumnStats(columnItems)
          return (
            <TasksColumn
              key={category?.id ?? NO_CATEGORY_ID}
              category={category}
              columnItems={columnItems}
              stats={stats}
              items={items}
              allCategories={items.categories}
            />
          )
        })}
      </div>
    </div>
  )
}
