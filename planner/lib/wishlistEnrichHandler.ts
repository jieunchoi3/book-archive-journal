import { createClient } from '@supabase/supabase-js'

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

export type EnrichBody = {
  link?: string
  name?: string
  brand?: string
  store?: string
}

export type EnrichResult = {
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

async function proxyToSupabaseEdge(
  supabaseUrl: string,
  supabaseAnon: string,
  authHeader: string,
  body: EnrichBody,
): Promise<Response | null> {
  for (const fn of ['wishlist-enrich', 'compass-analyze'] as const) {
    const payload =
      fn === 'compass-analyze' ? { action: 'wishlist-enrich' as const, ...body } : body
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          apikey: supabaseAnon,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const text = await res.text()
      if (res.status === 404) continue
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        continue
      }
      if (res.ok) {
        return jsonResponse(parsed, res.status)
      }
      if (res.status >= 500) continue
      return jsonResponse(parsed, res.status)
    } catch {
      continue
    }
  }
  return null
}

function parseJsonFromModel(raw: string): EnrichResult {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  return JSON.parse(cleaned) as EnrichResult
}

type LlmAuth =
  | { kind: 'gemini'; key: string }
  | { kind: 'gateway'; token: string }

function resolveLlmAuth(): LlmAuth | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (geminiKey) return { kind: 'gemini', key: geminiKey }

  const gatewayToken =
    process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim()
  if (gatewayToken) return { kind: 'gateway', token: gatewayToken }

  return null
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

async function callViaAiGateway(model: string, userText: string, token: string): Promise<string> {
  const gatewayModel = model.includes('/') ? model : `google/${model}`
  const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: gatewayModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AI Gateway ${gatewayModel} ${res.status}: ${errText}`)
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return json.choices?.[0]?.message?.content ?? ''
}

async function callLlm(model: string, userText: string, auth: LlmAuth): Promise<string> {
  if (auth.kind === 'gemini') {
    return callGemini(model, userText, auth.key)
  }
  return callViaAiGateway(model, userText, auth.token)
}

function storeFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const base = host.split('.')[0] ?? host
    if (!base) return ''
    return base.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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

export async function handleWishlistEnrichRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
    const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
    const llmAuth = resolveLlmAuth()

    if (!supabaseUrl || !supabaseAnon) {
      return jsonResponse({ error: 'Supabase env missing on server' }, 500)
    }

    const body = (await req.json()) as EnrichBody

    if (!llmAuth) {
      const proxied = await proxyToSupabaseEdge(supabaseUrl, supabaseAnon, authHeader, body)
      if (proxied) return proxied
      return jsonResponse(
        {
          error:
            'AI auto-fill is not configured on the server yet. Add GEMINI_API_KEY to Vercel, enable AI Gateway, or deploy Supabase functions.',
        },
        500,
      )
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
      return jsonResponse({ error: 'unauthorized' }, 401)
    }
    const link = body.link?.trim()
    const name = body.name?.trim() ?? ''
    const brand = body.brand?.trim() ?? ''

    if (!link && !(name && brand)) {
      return jsonResponse({ error: 'Provide a product link, or both name and brand' }, 400)
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
    let llmError: string | null = null
    try {
      raw = await callLlm(model, userText, llmAuth)
    } catch (e) {
      llmError = String(e)
      try {
        model = 'gemini-2.5-pro'
        raw = await callLlm(model, userText, llmAuth)
        llmError = null
      } catch (e2) {
        llmError = String(e2)
      }
    }

    if (llmError) {
      if (extracted && (extracted.name || extracted.store || extracted.brand)) {
        const result = normalizeResult(extracted, body)
        return jsonResponse({
          result: {
            ...result,
            note: result.note || 'Filled from page metadata — AI price estimate unavailable.',
          },
          model: 'metadata-only',
        })
      }
      return jsonResponse({ error: llmError }, 502)
    }

    let parsed: EnrichResult
    try {
      parsed = parseJsonFromModel(raw)
    } catch {
      if (extracted && (extracted.name || extracted.store || extracted.brand)) {
        const result = normalizeResult(extracted, body)
        return jsonResponse({ result, model: 'metadata-only' })
      }
      return jsonResponse({ error: 'invalid model json', raw }, 502)
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

    return jsonResponse({ result, model })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
}
