import { User } from 'lucide-react'

export function RelationsView() {
  return (
    <div className="min-h-screen px-3 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-6 sm:pb-24 lg:px-5">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
          <User size={22} strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[20px] font-semibold text-[#1C1C1E]">Relations</h1>
          <p className="text-[12px] text-muted">People and connections</p>
        </div>
      </header>
      <div className="rounded-2xl border border-dashed border-hairline bg-[#FAFAFA] px-4 py-10 text-center">
        <p className="text-[13px] text-muted">This space is ready for your relations journal.</p>
      </div>
    </div>
  )
}
