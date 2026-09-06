import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Heart,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
} from 'lucide-react'
import type { WishlistCategory } from '../types/expense'
import {
  WISHLIST_MAX_DEPTH,
  canAddChildCategory,
  type WishlistFilter,
  type WishlistTreeNode,
} from '../lib/wishlistCategories'

const STORAGE_KEY = 'planner:wishlistSidebarCollapsed'

interface WishlistSidebarProps {
  tree: WishlistTreeNode[]
  categories: WishlistCategory[]
  filter: WishlistFilter
  purchasedCount: number
  onFilterChange: (filter: WishlistFilter) => void
  onAddCategory: (input: { name: string; parentId: string | null }) => void
  onRenameCategory: (categoryId: string, name: string) => void
  onDeleteCategory: (categoryId: string, mode: 'move' | 'delete') => void
}

function TreeNodeRow({
  node,
  depth,
  filter,
  expanded,
  onToggle,
  onSelect,
  onRename,
  onDelete,
  onAddChild,
}: {
  node: WishlistTreeNode
  depth: number
  filter: WishlistFilter
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  onSelect: (categoryId: string) => void
  onRename: (categoryId: string, name: string) => void
  onDelete: (categoryId: string) => void
  onAddChild: (parentId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.name)
  const hasChildren = node.children.length > 0
  const isOpen = expanded[node.id] ?? depth === 0
  const isActive = filter.type === 'category' && filter.categoryId === node.id
  const canAddChild = depth < WISHLIST_MAX_DEPTH - 1

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== node.name) onRename(node.id, trimmed)
    setEditing(false)
  }

  return (
    <div>
      <div
        className="group flex items-center gap-0.5 rounded-lg pr-1 hover:bg-white/80"
        style={{ paddingLeft: `${depth * 10 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => (hasChildren ? onToggle(node.id) : onSelect(node.id))}
          className="flex h-7 w-5 shrink-0 items-center justify-center text-muted"
          aria-label={hasChildren ? 'Toggle folder' : 'Select folder'}
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-[#C7C7CC]" />
          )}
        </button>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setDraft(node.name)
                setEditing(false)
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-hairline bg-white px-2 py-1 text-[12px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1.5 pl-0.5 pr-1 text-left text-[12px] ${
              isActive ? 'font-semibold text-[#8B5A2B]' : 'text-[#1C1C1E]'
            }`}
          >
            <Folder size={13} className="shrink-0 text-[#C4A484]" />
            <span className="truncate">{node.name}</span>
            {node.itemCount > 0 && (
              <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted">
                {node.itemCount}
              </span>
            )}
          </button>
        )}
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          {canAddChild && (
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              className="rounded p-1 text-muted hover:text-[#8B5A2B]"
              aria-label="Add subcategory"
            >
              <Plus size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDraft(node.name)
              setEditing(true)
            }}
            className="rounded p-1 text-[10px] text-muted hover:text-[#8B5A2B]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="rounded p-1 text-muted hover:text-[#FF3B30]"
            aria-label="Delete category"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {hasChildren && isOpen && (
        <div className="border-l border-hairline/80" style={{ marginLeft: `${depth * 10 + 14}px` }}>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              filter={filter}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function WishlistSidebar({
  tree,
  categories,
  filter,
  purchasedCount,
  onFilterChange,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}: WishlistSidebarProps) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  )
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [addingRoot, setAddingRoot] = useState(false)
  const [addingUnder, setAddingUnder] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const totalWant = useMemo(
    () => tree.reduce((sum, node) => sum + node.itemCount, 0),
    [tree],
  )

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const submitNewCategory = (parentId: string | null) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    if (!canAddChildCategory(categories, parentId)) return
    onAddCategory({ name: trimmed, parentId })
    if (parentId) setExpanded((prev) => ({ ...prev, [parentId]: true }))
    setNewName('')
    setAddingRoot(false)
    setAddingUnder(null)
  }

  const handleDelete = (categoryId: string) => {
    const node = tree
      .flatMap(function flatten(n): WishlistTreeNode[] {
        return [n, ...n.children.flatMap(flatten)]
      })
      .find((n) => n.id === categoryId)
    const count = node?.itemCount ?? 0
    if (count > 0) {
      const move = window.confirm(
        `This folder has ${count} item(s). Move them to the parent folder? Click Cancel to delete items too.`,
      )
      onDeleteCategory(categoryId, move ? 'move' : 'delete')
      return
    }
    onDeleteCategory(categoryId, 'move')
  }

  if (collapsed) {
    return (
      <aside className="hidden w-10 shrink-0 flex-col items-center pt-1 lg:flex">
        <button
          type="button"
          onClick={() => {
            setCollapsed(false)
            localStorage.setItem(STORAGE_KEY, 'false')
          }}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-white hover:text-[#1C1C1E] hover:shadow-sm"
          aria-label="Show wishlist folders"
        >
          <PanelLeftOpen size={18} />
        </button>
        <Heart size={16} className="mt-3 text-[#8B5A2B]/70" />
      </aside>
    )
  }

  return (
    <aside className="hidden w-44 shrink-0 lg:block xl:w-48">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Categories
        </h2>
        <button
          type="button"
          onClick={() => {
            setCollapsed(true)
            localStorage.setItem(STORAGE_KEY, 'true')
          }}
          className="rounded-lg p-1.5 text-muted hover:bg-white hover:shadow-sm"
          aria-label="Hide sidebar"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="space-y-0.5 rounded-2xl border border-hairline bg-white/70 p-2 shadow-sm">
        <button
          type="button"
          onClick={() => onFilterChange({ type: 'all' })}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] ${
            filter.type === 'all'
              ? 'bg-[#8B5A2B]/10 font-semibold text-[#8B5A2B]'
              : 'text-[#1C1C1E] hover:bg-white'
          }`}
        >
          <span>All items</span>
          <span className="text-[10px] tabular-nums text-muted">{totalWant}</span>
        </button>
        <button
          type="button"
          onClick={() => onFilterChange({ type: 'purchased' })}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] ${
            filter.type === 'purchased'
              ? 'bg-[#3D7A5A]/10 font-semibold text-[#3D7A5A]'
              : 'text-[#1C1C1E] hover:bg-white'
          }`}
        >
          <span>Purchased</span>
          <span className="text-[10px] tabular-nums text-muted">{purchasedCount}</span>
        </button>

        <div className="my-2 border-t border-hairline" />

        {tree.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            filter={filter}
            expanded={expanded}
            onToggle={toggleExpanded}
            onSelect={(id) => onFilterChange({ type: 'category', categoryId: id })}
            onRename={onRenameCategory}
            onDelete={handleDelete}
            onAddChild={(parentId) => {
              setAddingUnder(parentId)
              setAddingRoot(false)
              setNewName('')
            }}
          />
        ))}

        {(addingRoot || addingUnder) && (
          <div className="mt-2 space-y-1.5 rounded-lg bg-[#F9F6F2] p-2">
            <p className="text-[10px] font-medium text-muted">
              {addingUnder ? 'New subcategory' : 'New category'}
            </p>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-[12px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewCategory(addingUnder)
                if (e.key === 'Escape') {
                  setAddingRoot(false)
                  setAddingUnder(null)
                  setNewName('')
                }
              }}
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => submitNewCategory(addingUnder)}
                className="flex-1 rounded-lg bg-[#8B5A2B] px-2 py-1 text-[11px] font-medium text-white"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingRoot(false)
                  setAddingUnder(null)
                  setNewName('')
                }}
                className="rounded-lg px-2 py-1 text-[11px] text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!addingRoot && !addingUnder && (
          <button
            type="button"
            onClick={() => {
              setAddingRoot(true)
              setAddingUnder(null)
              setNewName('')
            }}
            className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#8B5A2B] hover:bg-[#8B5A2B]/5"
          >
            <Plus size={13} />
            New category
          </button>
        )}
      </div>
    </aside>
  )
}
