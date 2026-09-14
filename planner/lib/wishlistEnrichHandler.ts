import { createClient } from '@supabase/supabase-js'
import { extractFromPageContent, fetchProductHtml, storeFromUrl } from './wishlistPageExtract'

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
  imageUrl?: string
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
    imageUrl: raw.imageUrl?.trim() || undefined,
    note: raw.note?.trim() || undefined,
  }
}

function hasExtractedData(extracted: EnrichResult | null): boolean {
  if (!extracted) return false
  return Boolean(
    extracted.name?.trim() ||
      extracted.brand?.trim() ||
      extracted.store?.trim() ||
      (extracted.estimatedPrice != null && extracted.estimatedPrice > 0) ||
      extracted.imageUrl?.trim(),
  )
}

async function metadataOnlyResponse(body: EnrichBody): Promise<Response | null> {
  const link = body.link?.trim()
  if (!link) return null
  try {
    const html = await fetchProductHtml(link)
    const extracted = extractFromPageContent(html, link) as EnrichResult
    if (!hasExtractedData(extracted)) return null
    const result = normalizeResult(extracted, body)
    return jsonResponse({
      result: {
        ...result,
        note: result.note || 'Filled from product page metadata.',
      },
      model: 'metadata-only',
    })
  } catch {
    return null
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
      const metadata = await metadataOnlyResponse(body)
      if (metadata) return metadata
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
        htmlSnippet = await fetchProductHtml(link)
        extracted = extractFromPageContent(htmlSnippet, link) as EnrichResult
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
      if (hasExtractedData(extracted)) {
        const result = normalizeResult(extracted!, body)
        return jsonResponse({
          result: {
            ...result,
            note: result.note || 'Filled from page metadata — AI price estimate unavailable.',
          },
          model: 'metadata-only',
        })
      }
      const metadata = await metadataOnlyResponse(body)
      if (metadata) return metadata
      return jsonResponse({ error: llmError }, 502)
    }

    let parsed: EnrichResult
    try {
      parsed = parseJsonFromModel(raw)
    } catch {
      if (hasExtractedData(extracted)) {
        const result = normalizeResult(extracted!, body)
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
        imageUrl: parsed.imageUrl || extracted?.imageUrl,
      },
      body,
    )

    return jsonResponse({ result, model })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
}
