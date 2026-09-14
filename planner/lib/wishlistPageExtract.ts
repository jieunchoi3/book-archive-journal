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

function isJinaReaderText(text: string): boolean {
  return /^Title:\s/m.test(text) || /Markdown Content:/i.test(text)
}

function currencyFromPriceContext(text: string, symbol?: string): string | undefined {
  if (symbol === '£') return 'GBP'
  if (symbol === '$') return 'USD'
  if (symbol === '€') return 'EUR'
  if (symbol === '₩') return 'KRW'
  const shown = text.match(/shown in\s*\*\*([A-Z]{3})\*\*/i)?.[1]
  return shown?.toUpperCase()
}

/** Parse product fields from Jina Reader plain-text / markdown output. */
export function extractFromReaderMarkdown(text: string, url: string): PageExtractResult {
  const titleLine = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim()
  const h1 = text.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const rawName =
    h1 ??
    titleLine?.split(/\s*[|\u2013\u2014-]\s*/)[0]?.trim() ??
    nameFromUrlPath(url) ??
    ''
  const name = cleanProductTitle(rawName)

  const mainSection =
    text.split(/You may also like|Receive a complimentary|Related products|Customers also bought/i)[0] ??
    text

  let estimatedPrice: number | null = null
  let currency: string | undefined

  const oldNew = mainSection.match(
    /Old price\s*([£$€₩])?\s*([\d.,]+)\s*New price\s*([£$€₩])?\s*([\d.,]+)/i,
  )
  if (oldNew) {
    estimatedPrice = parsePrice(oldNew[4])
    currency = currencyFromPriceContext(text, oldNew[3] ?? oldNew[1])
  } else {
    const newOnly = mainSection.match(/New price\s*([£$€₩])?\s*([\d.,]+)/i)
    if (newOnly) {
      estimatedPrice = parsePrice(newOnly[2])
      currency = currencyFromPriceContext(text, newOnly[1])
    }
  }

  if (estimatedPrice == null) {
    const generic = mainSection.match(/([£$€₩])\s*([\d]{1,4}(?:[.,]\d{2})?)\b/)
    if (generic) {
      const candidate = parsePrice(generic[2])
      if (candidate != null && candidate < 5000) {
        estimatedPrice = candidate
        currency = currencyFromPriceContext(text, generic[1])
      }
    }
  }

  const skipImage = (lower: string) =>
    lower.includes('logo') ||
    lower.includes('/navigation/') ||
    lower.includes('flyout-nav') ||
    lower.includes('/loyalty/') ||
    lower.includes('nav_loyalty') ||
    lower.includes('/sites-lancome-emea-west-ng-library/')

  const scoreImage = (lower: string) => {
    if (skipImage(lower)) return -1
    if (lower.includes('packshot')) return 4
    if (lower.includes('master-catalog')) return 3
    if (lower.includes('/images/packshots/')) return 3
    if (lower.includes('sw=320') || lower.includes('sw=400')) return 2
    if (lower.includes('/images/')) return 1
    return 0
  }

  let imageUrl: string | undefined
  let bestScore = -1
  const imgRe = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g
  let imgMatch: RegExpExecArray | null
  while ((imgMatch = imgRe.exec(mainSection))) {
    const candidate = imgMatch[1]!
    const lower = candidate.toLowerCase()
    const score = scoreImage(lower)
    if (score > bestScore) {
      bestScore = score
      imageUrl = candidate
    }
  }

  return {
    name: name || undefined,
    brand: brandFromUrl(url) ?? '',
    store: storeFromUrl(url),
    estimatedPrice,
    currency,
    imageUrl,
    note: '',
  }
}

/** HTML or Jina Reader text → product metadata. */
export function extractFromPageContent(content: string, url: string): PageExtractResult {
  if (isJinaReaderText(content)) {
    return extractFromReaderMarkdown(content, url)
  }
  const htmlResult = extractFromHtml(content, url)
  if (htmlResult.estimatedPrice != null && htmlResult.estimatedPrice > 0) {
    return htmlResult
  }
  const md = extractFromReaderMarkdown(content, url)
  return {
    ...htmlResult,
    name: htmlResult.name || md.name,
    brand: htmlResult.brand || md.brand,
    store: htmlResult.store || md.store,
    estimatedPrice: htmlResult.estimatedPrice ?? md.estimatedPrice,
    currency: htmlResult.currency || md.currency,
    imageUrl: htmlResult.imageUrl || md.imageUrl,
  }
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

async function fetchViaJinaReader(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`
  const res = await fetch(jinaUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'WeeklyPlanner-WishlistEnrich/1.0',
    },
  })
  if (!res.ok) throw new Error(`Could not fetch link via reader (${res.status})`)
  const text = await res.text()
  if (!text.trim()) throw new Error('Could not fetch link (empty reader response)')
  return text.slice(0, 120_000)
}

export async function fetchProductHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    })
    if (res.ok) {
      const text = await res.text()
      if (text.length > 400 && /<html|<meta|application\/ld\+json/i.test(text)) {
        return text.slice(0, 120_000)
      }
    }
  } catch {
    /* try reader fallback */
  }
  return fetchViaJinaReader(url)
}
