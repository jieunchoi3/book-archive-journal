import { createClient } from '@supabase/supabase-js'

const TABLE = 'diary_v2_entries'
const MAX_ENTRIES = 350
const BODY_CHAR_CAP = 1_200

const SYSTEM_PROMPT = `You are a warm, precise reflective coach for the user's private cloud diary (Diary 2).
You receive excerpts from their past diary entries (dates, titles, body text). The user may write in Korean or English — reply in the same language they use in the latest message.

Your job:
- Answer their questions using evidence from the diary corpus (cite dates like 2026-03-15 when relevant).
- Surface recurring themes, emotions, relationships, habits, and contradictions — without being preachy.
- Never invent events or quotes that are not supported by the corpus; say when the diary is silent.
- Respect privacy: do not tell them to share diary content publicly.
- Keep replies concise unless they ask for depth (use short paragraphs, optional bullet points for patterns).

You do not see photos — text only.`

export type CoachChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type DiarySnippet = {
  date_key: string
  title: string
  body: string
}

type LlmAuth =
  | { kind: 'gemini'; key: string }
  | { kind: 'gateway'; token: string }

type RequestBody = {
  messages?: CoachChatMessage[]
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

function resolveLlmAuth(): LlmAuth | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  if (geminiKey) return { kind: 'gemini', key: geminiKey }

  const gatewayToken =
    process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim()
  if (gatewayToken) return { kind: 'gateway', token: gatewayToken }

  return null
}

function trimBody(text: string): string {
  const t = text.trim()
  if (t.length <= BODY_CHAR_CAP) return t
  return `${t.slice(0, BODY_CHAR_CAP)}…`
}

function formatCorpus(rows: DiarySnippet[]): string {
  const lines: string[] = []
  for (const row of rows) {
    const title = row.title?.trim() ?? ''
    const body = trimBody(row.body ?? '')
    if (!title && !body) continue
    const date = String(row.date_key).slice(0, 10)
    lines.push(`### ${date}${title ? ` — ${title}` : ''}\n${body || '(no body)'}`)
  }
  return lines.join('\n\n')
}

async function loadDiaryCorpus(
  supabaseUrl: string,
  supabaseAnon: string,
  authHeader: string,
): Promise<{ corpus: string; entryCount: number }> {
  const client = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    db: { schema: 'planner' },
  })

  const { data, error } = await client
    .from(TABLE)
    .select('date_key, title, body')
    .order('date_key', { ascending: false })
    .limit(MAX_ENTRIES)

  if (error) throw error

  const rows = (data ?? []) as DiarySnippet[]
  const corpus = formatCorpus(rows)
  const used = corpus ? rows.filter((r) => (r.title ?? '').trim() || (r.body ?? '').trim()).length : 0
  return { corpus, entryCount: used }
}

async function callGeminiChat(
  model: string,
  systemText: string,
  messages: CoachChatMessage[],
  apiKey: string,
): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 2_048,
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

async function callGatewayChat(
  model: string,
  systemText: string,
  messages: CoachChatMessage[],
  token: string,
): Promise<string> {
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
        { role: 'system', content: systemText },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.65,
      max_tokens: 2048,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AI Gateway ${gatewayModel} ${res.status}: ${errText}`)
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return json.choices?.[0]?.message?.content?.trim() ?? ''
}

async function callCoachLlm(
  auth: LlmAuth,
  systemText: string,
  messages: CoachChatMessage[],
): Promise<{ text: string; model: string }> {
  let model = 'gemini-2.5-flash'
  try {
    const text =
      auth.kind === 'gemini'
        ? await callGeminiChat(model, systemText, messages, auth.key)
        : await callGatewayChat(model, systemText, messages, auth.token)
    if (text.trim()) return { text: text.trim(), model }
  } catch {
    model = 'gemini-2.5-pro'
  }
  const text =
    auth.kind === 'gemini'
      ? await callGeminiChat(model, systemText, messages, auth.key)
      : await callGatewayChat(model, systemText, messages, auth.token)
  return { text: text.trim(), model }
}

export async function handleCloudDiaryCoachRequest(req: Request): Promise<Response> {
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

    if (!llmAuth) {
      return jsonResponse(
        {
          error:
            'AI coach is not configured on the server. Add GEMINI_API_KEY on Vercel or enable AI Gateway (same as wishlist auto-fill).',
        },
        503,
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

    const body = (await req.json()) as RequestBody
    const messages = (body.messages ?? []).filter(
      (m): m is CoachChatMessage =>
        Boolean(m) &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    )

    if (!messages.length || messages[messages.length - 1]?.role !== 'user') {
      return jsonResponse({ error: 'messages must end with a user turn' }, 400)
    }

    const history = messages.slice(-24)

    const { corpus, entryCount } = await loadDiaryCorpus(supabaseUrl, supabaseAnon, authHeader)

    const systemWithCorpus = `${SYSTEM_PROMPT}

---
DIARY CORPUS (${entryCount} text entries, newest first; excerpts may be truncated):

${corpus || '(No diary text in cloud yet — encourage the user to write in Diary 2.)'}
---`

    const { text, model } = await callCoachLlm(llmAuth, systemWithCorpus, history)

    if (!text) {
      return jsonResponse({ error: 'empty model response' }, 502)
    }

    return jsonResponse({ reply: text, model, entryCount })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
}
