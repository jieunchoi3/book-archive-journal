import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const PROMPT_VERSION = 'v1'
const SYSTEM_PROMPT = `You extract shopping wishlist fields from product pages or product descriptions.

Return JSON only (no markdown):
{
  "name": "product name without brand prefix when possible",
  "brand": "manufacturer/brand, empty string if unknown",
  "store": "retailer/shop (e.g. TK Maxx, Nike.com, Olive Young), empty if unknown",
  "estimatedPrice": number or null,
  "currency": "GBP|KRW|USD|EUR|...",
  "note": "short note about price confidence or sale info, or empty string"
}

Rules:
- store is where you BUY it (retailer), brand is the product maker.
- estimatedPrice must be a plain number without currency symbols.
- Prefer prices from the page/metadata when available.
- If only estimating, say so briefly in note.
- Do not invent exact prices when uncertain; use null and explain in note.`

type EnrichBody = {
  link?: string
  name?: string
  brand?: string
  store?: string
}

type EnrichResult = {
  name?: string
  brand?: string
  store?: string
  estimatedPrice?: number | null
  currency?: string
  note?: string
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function parseJsonFromModel(raw: string): EnrichResult {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  return JSON.parse(cleaned) as EnrichResult
}

async function callGemini(model: string, userText: string, apiKey: string): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini ${model} ${res.status}: ${errText}`)
  }
  const json = await res.json()
  return (
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
    ''
  )
}

function storeFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const base = host.split('.')[0] ?? host
    if (!base) return ''
    return base
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return ''
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
    if (match?.[1]) return match[1].trim()
  }
  return undefined
}

function parsePrice(raw: string | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/,/g, '')
  const value = Number(cleaned)
  return Number.isFinite(value) && value > 0 ? value : null
}

function extractFromHtml(html: string, url: string): EnrichResult {
  const title =
    metaContent(html, 'og:title') ??
    metaContent(html, 'twitter:title') ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  const site =
    metaContent(html, 'og:site_name') ??
    metaContent(html, 'application-name') ??
    storeFromUrl(url)
  const priceRaw =
    metaContent(html, 'product:price:amount') ??
    metaContent(html, 'og:price:amount') ??
    metaContent(html, 'twitter:data1')

  let jsonLd: Record<string, unknown> | null = null
  const ldMatch = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (ldMatch?.[1]) {
    try {
      const parsed = JSON.parse(ldMatch[1].trim())
      jsonLd = Array.isArray(parsed)
        ? (parsed.find((x) => x?.['@type'] === 'Product') as Record<string, unknown>) ?? parsed[0]
        : parsed
    } catch {
      /* ignore */
    }
  }

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
    const offer = Array.isArray(offers) ? offers[0] : offers
    if (offer && typeof offer === 'object' && 'price' in offer) {
      ldPrice = parsePrice(String((offer as { price?: string | number }).price ?? ''))
    }
  }

  return {
    name: ldName ?? title ?? '',
    brand: ldBrand ?? '',
    store: site ?? storeFromUrl(url),
    estimatedPrice: ldPrice ?? parsePrice(priceRaw),
    currency: metaContent(html, 'product:price:currency') ?? undefined,
    note: '',
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`Could not fetch link (${res.status})`)
  const text = await res.text()
  return text.slice(0, 120_000)
}

function buildUserPrompt(body: EnrichBody, extracted: EnrichResult | null, htmlSnippet?: string) {
  const parts = [`prompt_version: ${PROMPT_VERSION}`]
  if (body.link) parts.push(`url: ${body.link}`)
  if (body.name) parts.push(`known_name: ${body.name}`)
  if (body.brand) parts.push(`known_brand: ${body.brand}`)
  if (body.store) parts.push(`known_store: ${body.store}`)
  if (extracted) parts.push(`extracted_metadata: ${JSON.stringify(extracted)}`)
  if (htmlSnippet) parts.push(`html_snippet: ${htmlSnippet.slice(0, 24_000)}`)

  if (body.link) {
    parts.push(
      'Task: Fill name, brand, store, estimatedPrice from the product page. Use extracted_metadata when trustworthy.',
    )
  } else {
    parts.push(
      'Task: Estimate typical retail estimatedPrice for this product. Keep name/brand/store as provided unless empty.',
    )
  }
  return parts.join('\n\n')
}

function normalizeResult(raw: EnrichResult, body: EnrichBody): EnrichResult {
  const price =
    raw.estimatedPrice != null && Number(raw.estimatedPrice) > 0
      ? Number(raw.estimatedPrice)
      : null
  return {
    name: (raw.name ?? body.name ?? '').trim(),
    brand: (raw.brand ?? body.brand ?? '').trim(),
    store: (raw.store ?? body.store ?? '').trim(),
    estimatedPrice: price,
    currency: raw.currency?.trim() || undefined,
    note: raw.note?.trim() || undefined,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing' }), {
        status: 500,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: 'planner' },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as EnrichBody
    const link = body.link?.trim()
    const name = body.name?.trim() ?? ''
    const brand = body.brand?.trim() ?? ''

    if (!link && !(name && brand)) {
      return new Response(
        JSON.stringify({ error: 'Provide a product link, or both name and brand' }),
        {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        },
      )
    }

    let extracted: EnrichResult | null = null
    let htmlSnippet: string | undefined
    if (link) {
      try {
        htmlSnippet = await fetchHtml(link)
        extracted = extractFromHtml(htmlSnippet, link)
      } catch (e) {
        extracted = { store: storeFromUrl(link), note: String(e) }
      }
    }

    const userText = buildUserPrompt(body, extracted, htmlSnippet)
    let model = 'gemini-2.5-flash'
    let raw = ''
    try {
      raw = await callGemini(model, userText, geminiKey)
    } catch {
      model = 'gemini-2.0-flash'
      raw = await callGemini(model, userText, geminiKey)
    }

    let parsed: EnrichResult
    try {
      parsed = parseJsonFromModel(raw)
    } catch {
      return new Response(JSON.stringify({ error: 'invalid model json', raw }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const result = normalizeResult(
      {
        ...extracted,
        ...parsed,
        name: parsed.name || extracted?.name,
        brand: parsed.brand || extracted?.brand,
        store: parsed.store || extracted?.store,
        estimatedPrice: parsed.estimatedPrice ?? extracted?.estimatedPrice ?? null,
      },
      body,
    )

    return new Response(JSON.stringify({ result, model }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }
})
