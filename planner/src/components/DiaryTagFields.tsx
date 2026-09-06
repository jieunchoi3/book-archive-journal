import { useEffect, useRef, useState } from 'react'
import type { DiaryTagTreeNode } from '../types/diary'
import { formatDiaryTagLabel, listSubTags, normalizeDiaryTag } from '../lib/diaryTags'

interface DiaryTagFieldsProps {
  mainTag: string | null
  subTag: string | null
  tagTree: DiaryTagTreeNode[]
  onChange: (patch: { mainTag: string | null; subTag: string | null }) => void
}

export function DiaryTagFields({ mainTag, subTag, tagTree, onChange }: DiaryTagFieldsProps) {
  const [mainInput, setMainInput] = useState(mainTag ?? '')
  const [subInput, setSubInput] = useState(subTag ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMainInput(mainTag ?? '')
    setSubInput(subTag ?? '')
  }, [mainTag, subTag])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const mainOptions = tagTree.map((node) => node.mainTag)
  const subOptions = mainInput.trim() ? listSubTags(tagTree, mainInput) : []

  const queueChange = (nextMain: string, nextSub: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const normalizedMain = normalizeDiaryTag(nextMain)
      const normalizedSub = normalizeDiaryTag(nextSub)
      onChange({
        mainTag: normalizedMain || null,
        subTag: normalizedMain && normalizedSub ? normalizedSub : null,
      })
    }, 300)
  }

  const handleMainChange = (value: string) => {
    setMainInput(value)
    if (!normalizeDiaryTag(value)) {
      setSubInput('')
      queueChange('', '')
      return
    }
    if (normalizeDiaryTag(value) !== normalizeDiaryTag(mainInput)) {
      setSubInput('')
      queueChange(value, '')
      return
    }
    queueChange(value, subInput)
  }

  const handleSubChange = (value: string) => {
    setSubInput(value)
    queueChange(mainInput, value)
  }

  const clearTags = () => {
    setMainInput('')
    setSubInput('')
    onChange({ mainTag: null, subTag: null })
  }

  return (
    <section>
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted">
        Hashtags
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] text-muted">Main folder</p>
          <input
            type="text"
            value={mainInput}
            onChange={(e) => handleMainChange(e.target.value)}
            list="diary-main-tags"
            placeholder="e.g. 여행"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[#FF2D55]/40 focus:bg-white focus:ring-2 focus:ring-[#FF2D55]/10"
          />
          <datalist id="diary-main-tags">
            {mainOptions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
        <div>
          <p className="mb-1 text-[11px] text-muted">Sub folder</p>
          <input
            type="text"
            value={subInput}
            onChange={(e) => handleSubChange(e.target.value)}
            list="diary-sub-tags"
            placeholder="e.g. 포르투갈"
            disabled={!normalizeDiaryTag(mainInput)}
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:border-[#FF2D55]/40 focus:bg-white focus:ring-2 focus:ring-[#FF2D55]/10 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <datalist id="diary-sub-tags">
            {subOptions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
      </div>
      {(mainTag || subTag) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {mainTag ? (
            <span className="inline-flex items-center rounded-full bg-[#FF2D55]/10 px-2.5 py-1 text-[12px] font-medium text-[#FF2D55]">
              {formatDiaryTagLabel(mainTag)}
            </span>
          ) : null}
          {subTag ? (
            <span className="inline-flex items-center rounded-full bg-[#FF2D55]/8 px-2.5 py-1 text-[12px] font-medium text-[#C13558]">
              {formatDiaryTagLabel(subTag)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={clearTags}
            className="text-[11px] font-medium text-muted hover:text-[#FF2D55]"
          >
            Clear
          </button>
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-muted">
        Main hashtag creates a folder; sub hashtag nests inside it (e.g. 여행 → 포르투갈).
      </p>
    </section>
  )
}
