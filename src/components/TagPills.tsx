import { useState } from 'react'
import { X } from 'lucide-react'

interface TagPillsProps {
  tags: string[]
  availableTags?: string[]
  onChange: (tags: string[]) => void
}

export function TagPills({ tags, availableTags = [], onChange }: TagPillsProps) {
  const [input, setInput] = useState('')

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
  }

  const handleInputAdd = () => {
    if (input.trim()) {
      addTag(input)
      setInput('')
    }
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  const selectableTags = availableTags.filter((tag) => !tags.includes(tag))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full border border-apple-gray-100 bg-apple-gray-50 px-3 py-1 text-xs font-medium tracking-wide text-black"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-apple-gray-400 transition-colors hover:text-black"
              aria-label={`Remove ${tag}`}
            >
              <X size={12} strokeWidth={2} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => {
            document.getElementById('tag-input')?.focus()
          }}
          className="inline-flex items-center rounded-full border border-dashed border-apple-gray-100 px-3 py-1 text-xs font-medium text-apple-gray-400 transition-colors hover:border-apple-gray-400 hover:text-black"
        >
          + Add
        </button>
      </div>

      {selectableTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-apple-gray-400">
            Saved Tags
          </p>
          <div className="flex flex-wrap gap-2">
            {selectableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="rounded-full border border-apple-gray-100 bg-white px-3 py-1 text-xs font-medium tracking-wide text-apple-gray-400 transition-colors hover:border-black hover:text-black"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        id="tag-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleInputAdd()
          }
        }}
        onBlur={handleInputAdd}
        placeholder="Type a new tag and press Enter"
        className="w-full border-0 border-b border-apple-gray-100 bg-transparent py-1.5 text-sm text-black placeholder:text-apple-gray-400 focus:border-black focus:outline-none"
      />
    </div>
  )
}
