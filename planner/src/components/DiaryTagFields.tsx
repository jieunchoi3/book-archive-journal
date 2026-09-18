import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DiaryTagFolder, DiaryTagTreeNode } from '../types/diary'
import {
  applyTagFoldersToEntry,
  formatDiaryTagLabel,
  listSubTags,
  normalizeDiaryTag,
  normalizeTagFolders,
} from '../lib/diaryTags'

interface DiaryTagFieldsProps {
  tagFolders: DiaryTagFolder[]
  mainTag: string | null
  subTag: string | null
  tagTree: DiaryTagTreeNode[]
  onChange: (patch: {
    tagFolders: DiaryTagFolder[]
    mainTag: string | null
    subTag: string | null
  }) => void
}

type RowState = { main: string; sub: string }

function rowsFromFolders(
  folders: DiaryTagFolder[],
  mainTag: string | null,
  subTag: string | null,
): RowState[] {
  const normalized = normalizeTagFolders(
    folders.length
      ? folders
      : mainTag
        ? [{ mainTag, subTag: subTag ?? '' }]
        : [],
  )
  if (!normalized.length) return [{ main: '', sub: '' }]
  return normalized.map((folder) => ({
    main: folder.mainTag,
    sub: folder.subTag,
  }))
}

function foldersFromRows(rows: RowState[]): DiaryTagFolder[] {
  return normalizeTagFolders(
    rows.map((row) => ({ mainTag: row.main, subTag: row.sub })),
  )
}

export function DiaryTagFields({
  tagFolders,
  mainTag,
  subTag,
  tagTree,
  onChange,
}: DiaryTagFieldsProps) {
  const [rows, setRows] = useState<RowState[]>(() =>
    rowsFromFolders(tagFolders, mainTag, subTag),
  )
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  useEffect(() => {
    setRows(rowsFromFolders(tagFolders, mainTag, subTag))
  }, [tagFolders, mainTag, subTag])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const mainOptions = tagTree.map((node) => node.mainTag)

  const emitChange = (nextRows: RowState[]) => {
    const tagFoldersNext = foldersFromRows(nextRows)
    const patch = applyTagFoldersToEntry(tagFoldersNext)
    onChange({
      tagFolders: patch.tagFolders,
      mainTag: patch.mainTag,
      subTag: patch.subTag,
    })
  }

  const queueEmit = (nextRows: RowState[]) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => emitChange(nextRows), 300)
  }

  const updateRow = (index: number, patch: Partial<RowState>) => {
    setRows((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
      if (patch.main !== undefined && normalizeDiaryTag(patch.main) !== normalizeDiaryTag(prev[index]?.main ?? '')) {
        next[index] = { ...next[index]!, sub: '' }
      }
      queueEmit(next)
      return next
    })
  }

  const addRow = () => {
    setRows((prev) => {
      const next = [...prev, { main: '', sub: '' }]
      return next
    })
  }

  const removeRow = (index: number) => {
    setRows((prev) => {
      const next = prev.length <= 1 ? [{ main: '', sub: '' }] : prev.filter((_, i) => i !== index)
      emitChange(next)
      return next
    })
  }

  const clearAll = () => {
    const next = [{ main: '', sub: '' }]
    setRows(next)
    emitChange(next)
  }

  const activeFolders = foldersFromRows(rows)

  return (
    <section>
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted">
        Hashtags
      </label>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const subOptions = row.main.trim() ? listSubTags(tagTree, row.main) : []
          const listMainId = `diary-main-tags-${index}`
          const listSubId = `diary-sub-tags-${index}`
          return (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <div>
                {index === 0 ? (
                  <p className="mb-1 text-[11px] text-muted">Main folder</p>
                ) : (
                  <p className="mb-1 text-[11px] text-muted">Main folder {index + 1}</p>
                )}
                <input
                  type="text"
                  value={row.main}
                  onChange={(e) => updateRow(index, { main: e.target.value })}
                  list={listMainId}
                  placeholder="e.g. 여행"
                  className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[#FF2D55]/40 focus:bg-white focus:ring-2 focus:ring-[#FF2D55]/10"
                />
                <datalist id={listMainId}>
                  {mainOptions.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </div>
              <div>
                {index === 0 ? (
                  <p className="mb-1 text-[11px] text-muted">Sub folder</p>
                ) : (
                  <p className="mb-1 text-[11px] text-muted">Sub folder {index + 1}</p>
                )}
                <input
                  type="text"
                  value={row.sub}
                  onChange={(e) => updateRow(index, { sub: e.target.value })}
                  list={listSubId}
                  placeholder="e.g. 포르투갈"
                  disabled={!normalizeDiaryTag(row.main)}
                  className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[#FF2D55]/40 focus:bg-white focus:ring-2 focus:ring-[#FF2D55]/10 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <datalist id={listSubId}>
                  {subOptions.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={rows.length <= 1 && !normalizeDiaryTag(row.main) && !normalizeDiaryTag(row.sub)}
                className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline text-muted hover:border-[#FF2D55]/30 hover:text-[#FF2D55] disabled:opacity-40 sm:mb-0"
                aria-label="Remove hashtag row"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-[#FF2D55] hover:bg-[#FF2D55]/8"
      >
        <Plus size={14} />
        Add another folder
      </button>
      {activeFolders.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {activeFolders.map((folder) => (
            <span
              key={`${folder.mainTag}:${folder.subTag}`}
              className="inline-flex items-center gap-1 rounded-full bg-[#FF2D55]/10 px-2.5 py-1 text-[12px] font-medium text-[#FF2D55]"
            >
              {formatDiaryTagLabel(folder.mainTag)}
              {folder.subTag ? (
                <span className="text-[#C13558]">/ {formatDiaryTagLabel(folder.subTag)}</span>
              ) : null}
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] font-medium text-muted hover:text-[#FF2D55]"
          >
            Clear all
          </button>
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-muted">
        Add multiple rows to file one note under several folders (e.g. #진로 / #느낀점 and #일상).
      </p>
    </section>
  )
}
