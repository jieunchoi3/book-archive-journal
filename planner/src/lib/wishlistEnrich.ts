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

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new WishlistEnrichError('Sign in required for AI auto-fill.')
  }
  return data.session.access_token
}

function friendlyEnrichError(message: string, status?: number): WishlistEnrichError {
  if (message.includes('GEMINI_API_KEY missing')) {
    return new WishlistEnrichError('AI auto-fill is not configured on the server yet.')
  }
  if (status === 401 || message.includes('unauthorized')) {
    return new WishlistEnrichError('Sign in required for AI auto-fill.')
  }
  if (message.includes('Failed to send a request to the Edge Function')) {
    return new WishlistEnrichError('AI auto-fill service is unavailable. Try again in a moment.')
  }
  return new WishlistEnrichError(message || 'AI auto-fill failed.')
}

async function invokeWishlistEnrichApi(
  token: string,
  body: WishlistEnrichInput,
): Promise<WishlistEnrichResult> {
  const response = await fetch('/api/wishlist-enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  let payload: { result?: WishlistEnrichResult; error?: string } = {}
  try {
    payload = (await response.json()) as { result?: WishlistEnrichResult; error?: string }
  } catch {
    /* ignore */
  }

  if (!response.ok) {
    throw friendlyEnrichError(payload?.error ?? response.statusText, response.status)
  }
  if (payload?.error) {
    throw friendlyEnrichError(String(payload.error), response.status)
  }
  if (!payload?.result) {
    throw new WishlistEnrichError('AI returned no data.')
  }
  return payload.result
}

async function invokeWishlistEnrichEdge(
  body: WishlistEnrichInput,
): Promise<WishlistEnrichResult> {
  const { data, error } = await supabase.functions.invoke('wishlist-enrich', { body })
  if (error) {
    throw friendlyEnrichError(error.message)
  }
  if (data?.error) {
    throw friendlyEnrichError(String(data.error))
  }
  const result = data?.result as WishlistEnrichResult | undefined
  if (!result) {
    throw new WishlistEnrichError('AI returned no data.')
  }
  return result
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

  const body = {
    link: link || undefined,
    name: name || undefined,
    brand: brand || undefined,
    store: store || undefined,
  }

  const token = await getAccessToken()

  try {
    return await invokeWishlistEnrichApi(token, body)
  } catch (apiError) {
    if (apiError instanceof WishlistEnrichError && !apiError.message.includes('unavailable')) {
      throw apiError
    }
    try {
      return await invokeWishlistEnrichEdge(body)
    } catch (edgeError) {
      if (apiError instanceof WishlistEnrichError) throw apiError
      if (edgeError instanceof WishlistEnrichError) throw edgeError
      throw new WishlistEnrichError('AI auto-fill failed.')
    }
  }
}
