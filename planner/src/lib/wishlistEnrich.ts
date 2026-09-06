import { isSupabaseConfigured, supabase } from './supabase'

export type WishlistEnrichInput = {
  link?: string
  name?: string
  brand?: string
  store?: string
}

export type WishlistEnrichResult = {
  name?: string
  brand?: string
  store?: string
  estimatedPrice?: number | null
  currency?: string
  note?: string
}

export class WishlistEnrichError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WishlistEnrichError'
  }
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function canEnrichWishlistFromLink(link: string): boolean {
  return isValidHttpUrl(link)
}

export function canEnrichWishlistFromNameBrand(name: string, brand: string): boolean {
  return Boolean(name.trim() && brand.trim())
}

export async function enrichWishlistItem(
  input: WishlistEnrichInput,
): Promise<WishlistEnrichResult> {
  if (!isSupabaseConfigured) {
    throw new WishlistEnrichError('Connect Supabase to use AI auto-fill.')
  }

  const link = input.link?.trim()
  const name = input.name?.trim()
  const brand = input.brand?.trim()
  const store = input.store?.trim()

  if (link && !canEnrichWishlistFromLink(link)) {
    throw new WishlistEnrichError('Enter a valid http(s) link.')
  }
  if (!link && !(name && brand)) {
    throw new WishlistEnrichError('Add a link, or both name and brand.')
  }

  const { data, error } = await supabase.functions.invoke('wishlist-enrich', {
    body: {
      link: link || undefined,
      name: name || undefined,
      brand: brand || undefined,
      store: store || undefined,
    },
  })

  if (error) {
    throw new WishlistEnrichError(error.message || 'AI auto-fill failed.')
  }

  if (data?.error) {
    throw new WishlistEnrichError(String(data.error))
  }

  const result = data?.result as WishlistEnrichResult | undefined
  if (!result) {
    throw new WishlistEnrichError('AI returned no data.')
  }

  return result
}
