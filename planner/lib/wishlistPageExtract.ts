export type PageExtractResult = {
  name?: string
  brand?: string
  store?: string
  estimatedPrice?: number | null
  currency?: string
  imageUrl?: string
  note?: string
}

export function storeFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const known: Record<string, string> = {
      'spacenk.com': 'Space NK',
      'refybeauty.com': 'Refy',
      'tkmaxx.com': 'TK Maxx',
      'oliveyoung.co.kr': 'Olive Young',
      'uniqlo.com': 'Uniqlo',
      'lancome.co.uk': 'Lancome',
      'lancome.com': 'Lancome',
    }
    if (known[host]) return known[host]
    const base = host.split('.')[0] ?? host
    if (!base) return ''
    return base.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return ''
  }
}

export function brandFromUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    if (host.includes('lancome')) return 'Lancôme'
    if (host.includes('spacenk')) return undefined
    if (host.includes('refybeauty')) return 'Refy'
    return undefined
  } catch {
    return undefined
  }
}

function metaContent(html: string, key: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, 'i'),
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match?.[1]) return decodeHtmlEntities(match[1].trim())
  }
  return undefined
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/,/g, '')
  const value = Number(cleaned)
  return Number.isFinite(value) && value > 0 ? value : null
}

function cleanProductTitle(title: string): string {
  return title
    .replace(/\s*[|\u2013\u2014-]\s*(shop|buy|official).+$/i, '')
    .replace(/\s*[|\u2013\u2014-]\s*.+$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSkippablePathSegment(part: string): boolean {
  const decoded = decodeURIComponent(part)
  const base = decoded.replace(/\.[a-z0-9]+$/i, '')
  if (base.length <= 2) return true
  if (/^\d{5,}$/.test(base)) return true
  if (/^[a-f0-9-]{16,}$/i.test(base)) return true
  if (/^(uk|us|eu|gb|en|products|product|p|shop|buy|sale|collections?)$/i.test(base)) {
    return true
  }
  return false
}

export function nameFromUrlPath(url: string): string | undefined {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    const slug = [...segments].reverse().find((part) => !isSkippablePathSegment(part))
    if (!slug) return undefined
    const name = slug
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim()
    return name.length > 1 ? name : undefined
  } catch {
    return undefined
  }
}

function offerPrice(offer: unknown): number | null {
  if (!offer || typeof offer !== 'object') return null
  const o = offer as Record<string, unknown>
  const direct = parsePrice(String(o.price ?? ''))
  if (direct != null) return direct
  const low = parsePrice(String(o.lowPrice ?? ''))
  if (low != null) return low
  return parsePrice(String(o.highPrice ?? ''))
}

function collectJsonLdProducts(html: string): Record<string, unknown>[] {
  const products: Record<string, unknown>[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    try {
      const parsed = JSON.parse(match[1]!.trim())
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed]
      while (queue.length) {
        const item = queue.shift()
        if (!item || typeof item !== 'object') continue
        const rec = item as Record<string, unknown>
        const type = rec['@type']
        if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
          products.push(rec)
        }
        if (Array.isArray(rec['@graph'])) {
          queue.push(...(rec['@graph'] as unknown[]))
        }
      }
    } catch {
      /* ignore malformed blocks */
    }
  }
  return products
}

function resolveImageUrl(raw: string | undefined, pageUrl: string): string | undefined {
  if (!raw?.trim()) return undefined
  try {
    return new URL(raw.trim(), pageUrl).href
  } catch {
    return raw.trim()
  }
}

function productImage(jsonLd: Record<string, unknown>, pageUrl: string): string | undefined {
  const image = jsonLd.image
  if (typeof image === 'string') return resolveImageUrl(image, pageUrl)
  if (Array.isArray(image)) {
    for (const entry of image) {
      if (typeof entry === 'string') return resolveImageUrl(entry, pageUrl)
      if (entry && typeof entry === 'object' && 'url' in entry) {
        return resolveImageUrl(String((entry as { url?: string }).url ?? ''), pageUrl)
      }
    }
  }
  if (image && typeof image === 'object' && 'url' in image) {
    return resolveImageUrl(String((image as { url?: string }).url ?? ''), pageUrl)
  }
  return undefined
}

export function extractFromHtml(html: string, url: string): PageExtractResult {
  const products = collectJsonLdProducts(html)
  const jsonLd = products[0] ?? null

  const ogTitle = metaContent(html, 'og:title')
  const title =
    ogTitle ??
    metaContent(html, 'twitter:title') ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()

  const ldName = typeof jsonLd?.name === 'string' ? jsonLd.name : undefined
  const ldBrand =
    typeof jsonLd?.brand === 'string'
      ? jsonLd.brand
      : typeof (jsonLd?.brand as { name?: string } | undefined)?.name === 'string'
        ? (jsonLd!.brand as { name: string }).name
        : undefined

  let ldPrice: number | null = null
  const offers = jsonLd?.offers
  if (offers) {
    if (Array.isArray(offers)) {
      for (const offer of offers) {
        ldPrice = offerPrice(offer)
        if (ldPrice != null) break
      }
    } else {
      ldPrice = offerPrice(offers)
    }
  }

  const priceRaw =
    metaContent(html, 'product:price:amount') ??
    metaContent(html, 'og:price:amount') ??
    metaContent(html, 'twitter:data1')

  const imageUrl =
    productImage(jsonLd ?? {}, url) ??
    resolveImageUrl(metaContent(html, 'og:image'), url) ??
    resolveImageUrl(metaContent(html, 'twitter:image'), url)

  const rawName = ldName ?? ogTitle ?? title ?? nameFromUrlPath(url) ?? ''
  const name = cleanProductTitle(rawName)

  return {
    name: name || undefined,
    brand: ldBrand ?? brandFromUrl(url) ?? '',
    store:
      metaContent(html, 'og:site_name') ??
      metaContent(html, 'application-name') ??
      storeFromUrl(url),
    estimatedPrice: ldPrice ?? parsePrice(priceRaw),
    currency: metaContent(html, 'product:price:currency') ?? undefined,
    imageUrl,
    note: '',
  }
}

export async function fetchProductHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`Could not fetch link (${res.status})`)
  const text = await res.text()
  return text.slice(0, 120_000)
}
