import { Quote } from 'lucide-react'
import type { Book } from '../types'

interface MemorableLineSectionProps {
  book: Book
  onChange: (line: string) => void
}

export function MemorableLineSection({
  book,
  onChange,
}: MemorableLineSectionProps) {
  return (
    <section className="shrink-0 border-b border-zinc-100 px-8 py-8">
      <div className="mb-5 flex items-center gap-2">
        <Quote size={14} strokeWidth={1.5} className="text-apple-gray-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-apple-gray-400">
          책 속의 한 줄
        </h3>
      </div>

      <label className="block">
        <span className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.15em] text-apple-gray-400">
          마음에 새겨둘 문장
        </span>
        <textarea
          value={book.memorableLine ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="이 책에서 기억하고 싶은 문장을 적어 두세요…"
          rows={4}
          className="w-full resize-none rounded-2xl border border-apple-gray-100 bg-apple-gray-50/40 px-5 py-4 text-sm leading-relaxed tracking-[-0.01em] text-black transition-colors placeholder:text-apple-gray-400 focus:border-black focus:bg-white focus:outline-none"
        />
      </label>
    </section>
  )
}
