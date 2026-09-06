import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, Hash, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import type { DiaryTagFilter, DiaryTagFolder, DiaryTagTreeNode } from '../types/diary'
import { formatDiaryTagLabel } from '../lib/diaryTags'

const STORAGE_KEY = 'planner:diaryTagSidebarCollapsed'

interface DiaryTagSidebarProps {
  tree: DiaryTagTreeNode[]
  filter: DiaryTagFilter
  onFilterChange: (filter: DiaryTagFilter) => void
  onCreateFolder: (folder: DiaryTagFolder) => void
}

export function DiaryTagSidebar({
  tree,
  filter,
  onFilterChange,
  onCreateFolder,
}: DiaryTagSidebarProps) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  )
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)
  const [newMain, setNewMain] = useState('')
  const [newSub, setNewSub] = useState('')

  const totalTagged = useMemo(
    () => tree.reduce((sum, node) => sum + node.entryCount, 0),
    [tree],
  )

  const toggleExpanded = (mainTag: string) => {
    setExpanded((prev) => ({ ...prev, [mainTag]: !prev[mainTag] }))
  }

  const submitFolder = () => {
    const mainTag = newMain.trim()
    if (!mainTag) return
    onCreateFolder({ mainTag, subTag: newSub.trim() })
    setExpanded((prev) => ({ ...prev, [mainTag]: true }))
    setNewMain('')
    setNewSub('')
    setAdding(false)
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
          aria-label="Show tag folders"
        >
          <PanelLeftOpen size={18} />
        </button>
        <Hash size={16} className="mt-3 text-[#FF2D55]/70" />
      </aside>
    )
  }

  return (
    <aside className="hidden w-52 shrink-0 lg:block">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Hashtag folders
        </h2>
        <button
          type="button"
          onClick={() => {
            setCollapsed(true)
            localStorage.setItem(STORAGE_KEY, 'true')
          }}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white hover:text-[#1C1C1E] hover:shadow-sm"
          aria-label="Hide tag folders"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onFilterChange({ type: 'all' })}
        className={`mb-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
          filter.type === 'all'
            ? 'bg-[#FF2D55]/10 font-semibold text-[#FF2D55]'
            : 'text-[#3C3C43] hover:bg-[#FAFAFA]'
        }`}
      >
        <Folder size={14} className="shrink-0 opacity-70" />
        <span className="min-w-0 flex-1 truncate">All notes</span>
        <span className="text-[11px] text-muted">{totalTagged}</span>
      </button>

      <ul className="space-y-0.5">
        {tree.map((node) => {
          const isMainActive =
            filter.type === 'main' && filter.mainTag === node.mainTag
          const isExpanded = expanded[node.mainTag] ?? isMainActive
          const hasSubs = node.subTags.length > 0

          return (
            <li key={node.mainTag}>
              <div className="flex items-center gap-0.5">
                {hasSubs ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(node.mainTag)}
                    className="rounded p-1 text-muted hover:bg-[#FAFAFA]"
                    aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : (
                  <span className="w-6" />
                )}
                <button
                  type="button"
                  onClick={() => onFilterChange({ type: 'main', mainTag: node.mainTag })}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
                    isMainActive
                      ? 'bg-[#FF2D55]/10 font-semibold text-[#FF2D55]'
                      : 'text-[#3C3C43] hover:bg-[#FAFAFA]'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{formatDiaryTagLabel(node.mainTag)}</span>
                  <span className="text-[11px] text-muted">{node.entryCount}</span>
                </button>
              </div>

              {hasSubs && isExpanded && (
                <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-hairline pl-2">
                  {node.subTags.map((sub) => {
                    const isSubActive =
                      filter.type === 'sub' &&
                      filter.mainTag === node.mainTag &&
                      filter.subTag === sub.name
                    return (
                      <li key={`${node.mainTag}:${sub.name}`}>
                        <button
                          type="button"
                          onClick={() =>
                            onFilterChange({
                              type: 'sub',
                              mainTag: node.mainTag,
                              subTag: sub.name,
                            })
                          }
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors ${
                            isSubActive
                              ? 'bg-[#FF2D55]/10 font-semibold text-[#FF2D55]'
                              : 'text-[#636366] hover:bg-[#FAFAFA]'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {formatDiaryTagLabel(sub.name)}
                          </span>
                          <span className="text-[10px] text-muted">{sub.count}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {adding ? (
        <div className="mt-3 space-y-2 rounded-xl border border-hairline bg-[#FAFAFA] p-3">
          <input
            type="text"
            value={newMain}
            onChange={(e) => setNewMain(e.target.value)}
            placeholder="Main hashtag (e.g. 여행)"
            className="w-full rounded-lg border border-hairline bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#FF2D55]/40"
          />
          <input
            type="text"
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            placeholder="Sub hashtag (optional, e.g. 포르투갈)"
            className="w-full rounded-lg border border-hairline bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#FF2D55]/40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitFolder}
              className="flex-1 rounded-lg bg-[#FF2D55] px-3 py-1.5 text-[12px] font-medium text-white"
            >
              Create folder
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-[12px] text-muted hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-[#FF2D55] hover:bg-[#FF2D55]/8"
        >
          <Plus size={14} />
          New folder
        </button>
      )}
    </aside>
  )
}
