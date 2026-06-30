import { useEffect, useRef, useState } from 'react'
import {
  Bold,
  ChevronDown,
  Highlighter,
  ImagePlus,
  Lightbulb,
  Quote,
  X,
} from 'lucide-react'
import type { NoteBlock, TextStyle } from '../types'

const TEXT_STYLES: { value: TextStyle; label: string }[] = [
  { value: 'heading', label: 'Heading' },
  { value: 'subheading', label: 'Subheading' },
  { value: 'body', label: 'Body' },
]

const TEXT_COLORS = [
  { value: '#000000', label: 'Black' },
  { value: '#8E8E93', label: 'Grey' },
  { value: '#34C759', label: 'Green' },
  { value: '#007AFF', label: 'Blue' },
  { value: '#FF3B30', label: 'Red' },
]

const HIGHLIGHT_COLORS = [
  { value: '#FFF3B0', label: 'Yellow' },
  { value: '#B8F5C8', label: 'Green' },
  { value: '#B8DCFF', label: 'Blue' },
  { value: '#FFC8E0', label: 'Pink' },
  { value: '#DCC8FF', label: 'Purple' },
]

export function createDefaultNotes(): NoteBlock[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'heading',
      content: '',
    },
    {
      id: crypto.randomUUID(),
      type: 'body',
      content: '',
    },
  ]
}

const sessionActiveStyleByBook = new Map<string, TextStyle>()

interface SavedSelection {
  blockId: string
  range: Range
}

function wrapSelectionWithHighlight(color: string): boolean {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false
  }

  const range = selection.getRangeAt(0)
  const mark = document.createElement('mark')
  mark.style.backgroundColor = color
  mark.style.color = 'inherit'
  mark.style.borderRadius = '2px'
  mark.style.padding = '0 1px'

  try {
    range.surroundContents(mark)
  } catch {
    const fragment = range.extractContents()
    mark.appendChild(fragment)
    range.insertNode(mark)
  }

  selection.removeAllRanges()
  return true
}

interface NoteCanvasProps {
  bookId: string
  notes: NoteBlock[]
  onChange: (notes: NoteBlock[]) => void
}

export function NoteCanvas({ bookId, notes, onChange }: NoteCanvasProps) {
  const [activeStyle, setActiveStyle] = useState<TextStyle>(
    () => sessionActiveStyleByBook.get(bookId) ?? 'heading',
  )
  const [bold, setBold] = useState(false)
  const [color, setColor] = useState('#000000')
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value)
  const [styleOpen, setStyleOpen] = useState(false)
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const editorRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const savedSelectionRef = useRef<SavedSelection | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    const saveSelection = () => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

      const range = selection.getRangeAt(0)
      for (const [blockId, editor] of editorRefs.current.entries()) {
        if (editor.contains(range.commonAncestorContainer)) {
          savedSelectionRef.current = { blockId, range: range.cloneRange() }
          setActiveBlockId(blockId)
          return
        }
      }
    }

    document.addEventListener('selectionchange', saveSelection)
    return () => document.removeEventListener('selectionchange', saveSelection)
  }, [])

  useEffect(() => {
    setActiveStyle(sessionActiveStyleByBook.get(bookId) ?? 'heading')
  }, [bookId])

  useEffect(() => {
    if (!initialized.current && notes.length === 0) {
      initialized.current = true
      onChange(createDefaultNotes())
    }
  }, [notes.length, onChange])

  const updateBlock = (id: string, updates: Partial<NoteBlock>) => {
    onChange(notes.map((n) => (n.id === id ? { ...n, ...updates } : n)))
  }

  const deleteBlock = (id: string) => {
    if (notes.length <= 1) {
      onChange(createDefaultNotes())
      return
    }
    onChange(notes.filter((n) => n.id !== id))
    editorRefs.current.delete(id)
  }

  const addTextBlock = (type: NoteBlock['type']) => {
    const block: NoteBlock = {
      id: crypto.randomUUID(),
      type,
      content: '',
      bold,
      color,
    }
    onChange([...notes, block])
  }

  const addImageBlock = (url: string) => {
    const block: NoteBlock = {
      id: crypto.randomUUID(),
      type: 'image',
      content: '',
      imageUrl: url,
      width: 280,
      height: 180,
    }
    onChange([...notes, block])
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) addImageBlock(URL.createObjectURL(file))
    e.target.value = ''
  }

  const focusBlock = (blockId: string) => {
    setActiveBlockId(blockId)
    editorRefs.current.get(blockId)?.focus()
  }

  const restoreSelection = (): string | null => {
    const saved = savedSelectionRef.current
    if (!saved) return activeBlockId

    const editor = editorRefs.current.get(saved.blockId)
    if (!editor) return activeBlockId

    editor.focus()
    const selection = window.getSelection()
    if (!selection) return saved.blockId

    selection.removeAllRanges()
    selection.addRange(saved.range)
    setActiveBlockId(saved.blockId)
    return saved.blockId
  }

  const persistEditorContent = (blockId: string) => {
    const editor = editorRefs.current.get(blockId)
    if (editor) {
      updateBlock(blockId, { content: editor.innerHTML })
    }
  }

  const applyTextColor = (nextColor: string) => {
    setColor(nextColor)
    const blockId = restoreSelection()
    if (!blockId) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('foreColor', false, nextColor)
    persistEditorContent(blockId)
    savedSelectionRef.current = null
  }

  const applyHighlight = (nextColor: string) => {
    setHighlightColor(nextColor)
    const blockId = restoreSelection()
    if (!blockId) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    document.execCommand('styleWithCSS', false, 'true')

    let applied =
      document.execCommand('hiliteColor', false, nextColor) ||
      document.execCommand('backColor', false, nextColor)

    if (!applied) {
      applied = wrapSelectionWithHighlight(nextColor)
    }

    if (applied) {
      persistEditorContent(blockId)
      savedSelectionRef.current = null
    }
  }

  const toggleBold = () => {
    const next = !bold
    setBold(next)
    if (activeBlockId) {
      focusBlock(activeBlockId)
      document.execCommand('bold', false)
      const editor = editorRefs.current.get(activeBlockId)
      if (editor) {
        updateBlock(activeBlockId, { content: editor.innerHTML })
      }
    }
  }

  return (
    <section className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-b border-zinc-100 px-8 py-3 md:pl-6 md:pr-8">
        <div className="flex flex-[1_1_420px] flex-wrap items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setStyleOpen(!styleOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-apple-gray-100 bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-apple-gray-50"
            >
              {TEXT_STYLES.find((s) => s.value === activeStyle)?.label}
              <ChevronDown size={14} className="text-apple-gray-400" />
            </button>
            {styleOpen && (
              <div className="absolute top-full left-0 z-10 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-apple-gray-100 bg-white py-1 shadow-lg">
                {TEXT_STYLES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                  onClick={() => {
                    setActiveStyle(s.value)
                    sessionActiveStyleByBook.set(bookId, s.value)
                    setStyleOpen(false)
                  }}
                    className="block w-full px-4 py-2 text-left text-xs font-medium text-black transition-colors hover:bg-apple-gray-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleBold}
            className={`rounded-lg border px-2.5 py-1.5 transition-colors ${
              bold
                ? 'border-black bg-black text-white'
                : 'border-apple-gray-100 bg-white text-black hover:bg-apple-gray-50'
            }`}
            aria-label="Toggle bold"
          >
            <Bold size={14} strokeWidth={2} />
          </button>

          <div className="flex items-center gap-1.5 rounded-lg border border-apple-gray-100 bg-white px-2 py-1">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTextColor(c.value)}
                className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
                  color === c.value
                    ? 'border-black ring-2 ring-black/20'
                    : 'border-apple-gray-100'
                }`}
                style={{ backgroundColor: c.value }}
                aria-label={c.label}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-apple-gray-100 bg-white px-2 py-1">
            <Highlighter size={14} strokeWidth={1.5} className="text-apple-gray-400" />
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyHighlight(c.value)}
                className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
                  highlightColor === c.value
                    ? 'border-black ring-2 ring-black/20'
                    : 'border-apple-gray-100'
                }`}
                style={{ backgroundColor: c.value }}
                aria-label={`Highlight ${c.label}`}
                title={`Highlight ${c.label}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-[0_0_auto] flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addTextBlock('quote')}
            className="flex items-center gap-1 rounded-lg border border-apple-gray-100 px-2.5 py-1.5 text-xs font-medium text-apple-gray-400 transition-colors hover:border-black hover:text-black"
          >
            <Quote size={13} />
            Quote
          </button>
          <button
            type="button"
            onClick={() => addTextBlock('thought')}
            className="flex items-center gap-1 rounded-lg border border-apple-gray-100 px-2.5 py-1.5 text-xs font-medium text-apple-gray-400 transition-colors hover:border-black hover:text-black"
          >
            <Lightbulb size={13} />
            Thought
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border border-apple-gray-100 px-2.5 py-1.5 text-xs font-medium text-apple-gray-400 transition-colors hover:border-black hover:text-black"
          >
            <ImagePlus size={13} />
            Add Image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-8 pl-8 pr-8 md:pl-6 md:pr-8">
        <div className="w-full max-w-3xl space-y-6">
          {notes.map((block) => (
            <NoteBlockRenderer
              key={block.id}
              block={block}
              editorRefs={editorRefs}
              onUpdate={(updates) => updateBlock(block.id, updates)}
              onDelete={() => deleteBlock(block.id)}
              onFocus={() => setActiveBlockId(block.id)}
            />
          ))}

          <button
            type="button"
            onClick={() => addTextBlock(activeStyle)}
            className="w-full rounded-xl border border-dashed border-apple-gray-100 py-4 text-xs font-medium text-apple-gray-400 transition-colors hover:border-apple-gray-400 hover:text-black"
          >
            + New block ({activeStyle})
          </button>
        </div>
      </div>
    </section>
  )
}

interface NoteBlockRendererProps {
  block: NoteBlock
  editorRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  onUpdate: (updates: Partial<NoteBlock>) => void
  onDelete: () => void
  onFocus: () => void
}

function NoteBlockRenderer({
  block,
  editorRefs,
  onUpdate,
  onDelete,
  onFocus,
}: NoteBlockRendererProps) {
  const [resizing, setResizing] = useState(false)

  const deleteButton = (
    <button
      type="button"
      onClick={onDelete}
      className="absolute top-0 -right-8 rounded-md p-1 text-apple-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-apple-gray-50 hover:text-black"
      aria-label="Delete block"
    >
      <X size={14} strokeWidth={1.5} />
    </button>
  )

  if (block.type === 'quote') {
    return (
      <div className="group relative">
        {deleteButton}
        <blockquote className="border-l-2 border-black pl-6">
          <RichTextEditor
            block={block}
            editorRefs={editorRefs}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onFocus={onFocus}
            placeholder="[Quote placeholder]"
            className="text-base leading-relaxed font-light italic"
          />
        </blockquote>
      </div>
    )
  }

  if (block.type === 'thought') {
    return (
      <div className="group relative">
        {deleteButton}
        <div className="rounded-xl bg-apple-gray-50 p-5">
          <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.15em] text-apple-gray-400">
            Thought
          </span>
          <RichTextEditor
            block={block}
            editorRefs={editorRefs}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onFocus={onFocus}
            placeholder="[Thought placeholder]"
            className="text-sm leading-relaxed"
          />
        </div>
      </div>
    )
  }

  if (block.type === 'image') {
    return (
      <div className="group relative inline-block">
        {deleteButton}
        <ResizableImage
          block={block}
          resizing={resizing}
          setResizing={setResizing}
          onUpdate={onUpdate}
        />
      </div>
    )
  }

  const styleMap = {
    heading: 'text-2xl font-semibold tracking-[-0.03em]',
    subheading: 'text-lg font-medium tracking-[-0.02em]',
    body: 'text-sm leading-relaxed',
  }

  return (
    <div className="group relative">
      {deleteButton}
      <RichTextEditor
        block={block}
        editorRefs={editorRefs}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onFocus={onFocus}
        placeholder={`[${block.type} placeholder]`}
        className={styleMap[block.type]}
      />
    </div>
  )
}

interface RichTextEditorProps {
  block: NoteBlock
  editorRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  onUpdate: (updates: Partial<NoteBlock>) => void
  onDelete: () => void
  onFocus: () => void
  placeholder: string
  className?: string
}

function RichTextEditor({
  block,
  editorRefs,
  onUpdate,
  onDelete,
  onFocus,
  placeholder,
  className = '',
}: RichTextEditorProps) {
  const localRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = localRef.current
    if (el) {
      el.innerHTML = block.content
    }
  }, [block.id])

  const setRef = (el: HTMLDivElement | null) => {
    localRef.current = el
    if (el) {
      editorRefs.current.set(block.id, el)
    } else {
      editorRefs.current.delete(block.id)
    }
  }

  const handleInput = () => {
    if (localRef.current) {
      onUpdate({ content: localRef.current.innerHTML })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const text = localRef.current?.textContent ?? ''
    if (
      (e.key === 'Backspace' || e.key === 'Delete') &&
      text.trim() === '' &&
      !e.metaKey &&
      !e.ctrlKey
    ) {
      e.preventDefault()
      onDelete()
    }
  }

  return (
    <div
      ref={setRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      data-placeholder={placeholder}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      className={`min-h-[1.5em] w-full text-black ${className}`}
      style={{
        color: block.color ?? '#000000',
        fontWeight: block.bold ? 600 : undefined,
      }}
    />
  )
}

function ResizableImage({
  block,
  resizing,
  setResizing,
  onUpdate,
}: {
  block: NoteBlock
  resizing: boolean
  setResizing: (v: boolean) => void
  onUpdate: (updates: Partial<NoteBlock>) => void
}) {
  const w = block.width ?? 280
  const h = block.height ?? 180

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(true)
    const startX = e.clientX
    const startY = e.clientY
    const startW = w
    const startH = h

    const onMove = (ev: MouseEvent) => {
      onUpdate({
        width: Math.max(120, startW + (ev.clientX - startX)),
        height: Math.max(80, startH + (ev.clientY - startY)),
      })
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="relative inline-block" style={{ width: w, height: h }}>
      {block.imageUrl ? (
        <img
          src={block.imageUrl}
          alt="Note attachment"
          className="h-full w-full rounded-xl object-cover shadow-sm ring-1 ring-black/5"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed border-apple-gray-100 bg-apple-gray-50">
          <ImagePlus size={24} className="text-apple-gray-400" />
          <span className="mt-2 text-[10px] uppercase tracking-[0.12em] text-apple-gray-400">
            Smart Screenshot
          </span>
        </div>
      )}
      <span className="absolute top-0 left-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-apple-gray-400 bg-white" />
      <span className="absolute top-0 right-0 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-sm border border-apple-gray-400 bg-white" />
      <span className="absolute bottom-0 left-0 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-sm border border-apple-gray-400 bg-white" />
      <span
        className={`absolute right-0 bottom-0 h-3 w-3 translate-x-1/2 translate-y-1/2 rounded-sm border bg-white ${
          resizing ? 'border-black' : 'border-apple-gray-400 cursor-se-resize'
        }`}
        onMouseDown={onMouseDown}
      />
    </div>
  )
}
