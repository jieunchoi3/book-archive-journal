import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { usePlannerData } from '../context/PlannerDataContext'

export function SidebarNotepad() {
  const { sidebarNote, setSidebarNote } = usePlannerData()
  const [draft, setDraft] = useState(sidebarNote)
  const [savedVisible, setSavedVisible] = useState(false)

  useEffect(() => {
    setDraft(sidebarNote)
  }, [sidebarNote])

  useEffect(() => {
    if (!savedVisible) return
    const timer = setTimeout(() => setSavedVisible(false), 1500)
    return () => clearTimeout(timer)
  }, [savedVisible])

  const handleChange = (value: string) => {
    setDraft(value)
    setSidebarNote(value)
    setSavedVisible(true)
  }

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Lock size={11} className="text-muted/70" aria-hidden />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            My Note
          </h2>
        </div>
        {savedVisible && (
          <span className="text-[10px] text-[#007AFF]/80" aria-live="polite">
            Saved
          </span>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="이번 달 목표, 메모, 생각…"
        className="min-h-[320px] w-full resize-y rounded-xl border border-[#F0E6C8] bg-[#FFFCF0] px-3 py-2.5 text-[12px] leading-relaxed text-[#3C3C43] shadow-sm placeholder:text-[#AEAEB2] focus:border-[#E8D9A8] focus:outline-none focus:ring-2 focus:ring-[#F5E6B8]/80"
        spellCheck
      />
    </div>
  )
}
