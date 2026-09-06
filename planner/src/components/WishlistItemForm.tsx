import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import type { WishlistCategory, WishlistItem, WishlistPriority } from '../types/expense'
import { handleClipboardImagePaste } from '../lib/clipboardImage'
import { compressImageSource } from '../lib/diaryImage'
import {
  categoryPath,
  categoryPathLabel,
  childrenOf,
  defaultWishlistCategoryId,
} from '../lib/wishlistCategories'
import {
  canEnrichWishlistFromLink,
  canEnrichWishlistFromNameBrand,
  enrichWishlistItem,
  WishlistEnrichError,
} from '../lib/wishlistEnrich'

export type WishlistItemFormValues = {
  name: string
  brand: string
  store: string
  categoryId: string
  estimatedPrice: string
  priority: WishlistPriority
  link: string
  note: string
  imageDataUrl: string
}

interface WishlistItemFormProps {
  categories: WishlistCategory[]
  initial?: Partial<WishlistItem>
  submitLabel?: string
  onSubmit: (values: WishlistItemFormValues) => void
  onCancel?: () => void
}

export function WishlistItemForm({
  categories,
  initial,
  submitLabel = 'Add item',
  onSubmit,
  onCancel,
}: WishlistItemFormProps) {
  const defaultCategoryId = initial?.categoryId ?? defaultWishlistCategoryId(categories)
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [store, setStore] = useState(initial?.store ?? '')
  const [categoryId, setCategoryId] = useState(defaultCategoryId)
  const [estimatedPrice, setEstimatedPrice] = useState(
    initial?.estimatedPrice != null ? String(initial.estimatedPrice) : '',
  )
  const [priority, setPriority] = useState<WishlistPriority>(initial?.priority ?? 'medium')
  const [link, setLink] = useState(initial?.link ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [imageDataUrl, setImageDataUrl] = useState(initial?.imageDataUrl ?? '')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichError, setEnrichError] = useState<string | null>(null)
  const lastAutoKey = useRef('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(initial?.name ?? '')
    setBrand(initial?.brand ?? '')
    setStore(initial?.store ?? '')
    setCategoryId(initial?.categoryId ?? defaultWishlistCategoryId(categories))
    setEstimatedPrice(initial?.estimatedPrice != null ? String(initial.estimatedPrice) : '')
    setPriority(initial?.priority ?? 'medium')
    setLink(initial?.link ?? '')
    setNote(initial?.note ?? '')
    setImageDataUrl(initial?.imageDataUrl ?? '')
    setPhotoError(null)
    setEnrichError(null)
    lastAutoKey.current = ''
  }, [initial, categories])

  const path = useMemo(() => categoryPath(categories, categoryId), [categories, categoryId])
  const rootId = path[0]?.id ?? categoryId
  const level2Id = path[1]?.id ?? ''
  const level3Id = path[2]?.id ?? ''

  const rootOptions = childrenOf(categories, null)
  const level2Options = rootId ? childrenOf(categories, rootId) : []
  const level3Options = level2Id ? childrenOf(categories, level2Id) : []

  const setFromLevels = (root: string, mid: string, leaf: string) => {
    if (leaf && categories.some((c) => c.id === leaf)) {
      setCategoryId(leaf)
      return
    }
    if (mid && categories.some((c) => c.id === mid)) {
      setCategoryId(mid)
      return
    }
    if (root && categories.some((c) => c.id === root)) {
      setCategoryId(root)
    }
  }

  const applyEnrichResult = useCallback(
    (result: Awaited<ReturnType<typeof enrichWishlistItem>>, mode: 'link' | 'price') => {
      if (mode === 'link') {
        if (result.name?.trim()) setName(result.name.trim())
        if (result.brand?.trim()) setBrand(result.brand.trim())
        if (result.store?.trim()) setStore(result.store.trim())
      }
      if (result.estimatedPrice != null && result.estimatedPrice > 0) {
        setEstimatedPrice(String(result.estimatedPrice))
      }
      if (result.note?.trim()) {
        setNote((prev) => {
          const next = result.note!.trim()
          if (!prev.trim()) return next
          if (prev.includes(next)) return prev
          return `${prev}\n${next}`
        })
      }
      if (result.currency && result.currency !== 'GBP' && result.estimatedPrice) {
        setNote((prev) => {
          const tag = `Price in ${result.currency}`
          return prev.includes(tag) ? prev : prev.trim() ? `${prev}\n${tag}` : tag
        })
      }
    },
    [],
  )

  const runEnrich = useCallback(
    async (mode: 'link' | 'price', force = false) => {
      const trimmedLink = link.trim()
      const trimmedName = name.trim()
      const trimmedBrand = brand.trim()
      const trimmedStore = store.trim()

      const key =
        mode === 'link'
          ? `link:${trimmedLink}`
          : `price:${trimmedBrand}|${trimmedName}|${trimmedStore}`

      if (!force && lastAutoKey.current === key) return
      if (mode === 'link' && !canEnrichWishlistFromLink(trimmedLink)) return
      if (mode === 'price' && !canEnrichWishlistFromNameBrand(trimmedName, trimmedBrand)) return

      setEnriching(true)
      setEnrichError(null)
      try {
        const result = await enrichWishlistItem({
          link: mode === 'link' ? trimmedLink : undefined,
          name: trimmedName || undefined,
          brand: trimmedBrand || undefined,
          store: trimmedStore || undefined,
        })
        applyEnrichResult(result, mode)
        lastAutoKey.current = key
      } catch (e) {
        const message =
          e instanceof WishlistEnrichError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'AI auto-fill failed'
        setEnrichError(message)
      } finally {
        setEnriching(false)
      }
    },
    [applyEnrichResult, brand, link, name, store],
  )

  useEffect(() => {
    const trimmedLink = link.trim()
    if (!canEnrichWishlistFromLink(trimmedLink)) return
    const timer = window.setTimeout(() => {
      void runEnrich('link')
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [link, runEnrich])

  useEffect(() => {
    if (link.trim()) return
    if (!canEnrichWishlistFromNameBrand(name, brand)) return
    if (estimatedPrice.trim()) return
    const timer = window.setTimeout(() => {
      void runEnrich('price')
    }, 1600)
    return () => window.clearTimeout(timer)
  }, [brand, name, link, estimatedPrice, runEnrich])

  const applyPhoto = useCallback(async (source: File | string) => {
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const compressed = await compressImageSource(source, 1200, 0.86)
      setImageDataUrl(compressed)
    } catch {
      setPhotoError('Couldn’t read that photo. Try another file or paste again.')
    } finally {
      setPhotoBusy(false)
    }
  }, [])

  const onPickFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      if (!file.type.startsWith('image/') && !/\.(png|jpe?g|gif|webp|heic|heif)$/i.test(file.name)) {
        setPhotoError('Please choose an image file.')
        return
      }
      await applyPhoto(file)
    },
    [applyPhoto],
  )

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!photoFocusRef.current) return
      handleClipboardImagePaste(e, (source) => void applyPhoto(source))
    }
    document.addEventListener('paste', onPaste, true)
    return () => document.removeEventListener('paste', onPaste, true)
  }, [applyPhoto])

  const canSubmit = name.trim().length > 0 && Boolean(categoryId)
  const canAutoFillLink = canEnrichWishlistFromLink(link)
  const canAutoFillPrice = !link.trim() && canEnrichWishlistFromNameBrand(name, brand)

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      name,
      brand,
      store,
      categoryId,
      estimatedPrice,
      priority,
      link,
      note,
      imageDataUrl,
    })
  }

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-[#1C1C1E]">
          {initial?.id ? 'Edit wishlist item' : 'Add to wishlist'}
        </h3>
        {(canAutoFillLink || canAutoFillPrice) && (
          <button
            type="button"
            disabled={enriching}
            onClick={() => void runEnrich(canAutoFillLink ? 'link' : 'price', true)}
            className="inline-flex items-center gap-1 rounded-full bg-[#8B5A2B]/10 px-2.5 py-1 text-[11px] font-medium text-[#8B5A2B] hover:bg-[#8B5A2B]/15 disabled:opacity-50"
          >
            {enriching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {enriching ? 'Filling…' : 'Auto-fill'}
          </button>
        )}
      </div>

      {enrichError && (
        <p className="mb-3 rounded-xl bg-[#FF3B30]/8 px-3 py-2 text-[12px] text-[#FF3B30]">
          {enrichError}
        </p>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Link
          </span>
          <input
            value={link}
            onChange={(e) => {
              setLink(e.target.value)
              setEnrichError(null)
              if (lastAutoKey.current.startsWith('link:')) {
                lastAutoKey.current = ''
              }
            }}
            placeholder="Paste a product link — AI fills the rest"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
          />
          <p className="mt-1 text-[11px] text-muted">
            Paste a link only, or add name + brand to estimate price.
          </p>
        </label>

        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Photo
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onFocus={() => {
              photoFocusRef.current = true
            }}
            onBlur={() => {
              photoFocusRef.current = false
            }}
            onPaste={(e) => {
              handleClipboardImagePaste(e.nativeEvent, (source) => void applyPhoto(source))
            }}
            disabled={photoBusy}
            className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#C4A484] bg-[#FAFAFA] disabled:opacity-60"
          >
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 text-muted">
                <ImagePlus size={26} className="text-[#C4A484]" />
                <span className="text-[12px] font-medium">Upload from gallery</span>
                <span className="text-[10px]">or click here and paste (⌘V)</span>
              </div>
            )}
            {imageDataUrl && (
              <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
                Change
              </span>
            )}
            {photoBusy && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 size={22} className="animate-spin text-[#8B5A2B]" />
              </span>
            )}
          </button>
          {photoError && (
            <p className="mt-1 text-[11px] text-[#FF3B30]">{photoError}</p>
          )}
          {imageDataUrl && (
            <button
              type="button"
              onClick={() => setImageDataUrl('')}
              className="mt-1.5 text-[11px] font-medium text-muted hover:text-[#FF3B30]"
            >
              Remove photo
            </button>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Item name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Air Max 90"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Brand
          </span>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Nike"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Store / shop
          </span>
          <input
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="e.g. TK Maxx, Olive Young"
            className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
          />
        </label>

        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Category
          </span>
          <div className="space-y-2">
            <select
              value={rootId}
              onChange={(e) => setFromLevels(e.target.value, '', '')}
              className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
            >
              {rootOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {level2Options.length > 0 && (
              <select
                value={level2Id || rootId}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === rootId) setFromLevels(rootId, '', '')
                  else setFromLevels(rootId, val, '')
                }}
                className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
              >
                <option value={rootId}>All {path[0]?.name}</option>
                {level2Options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {level3Options.length > 0 && (
              <select
                value={level3Id || level2Id || rootId}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === level2Id) setFromLevels(rootId, level2Id, '')
                  else setFromLevels(rootId, level2Id, val)
                }}
                className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
              >
                <option value={level2Id}>All {path[1]?.name ?? path[0]?.name}</option>
                {level3Options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted">{categoryPathLabel(categories, categoryId)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
              Est. price
            </span>
            <input
              value={estimatedPrice}
              onChange={(e) => setEstimatedPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px] tabular-nums"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
              Priority
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as WishlistPriority)}
              className="w-full rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[13px]"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Note
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-hairline bg-[#FAFAFA] px-3 py-2 text-[14px]"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!canSubmit || enriching}
          onClick={handleSubmit}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8B5A2B] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          <Check size={16} />
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-hairline px-3 py-2.5 text-[13px] text-muted"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
