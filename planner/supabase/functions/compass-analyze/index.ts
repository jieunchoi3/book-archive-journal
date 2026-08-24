import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const PROMPT_VERSION = "v1"
const SYSTEM_PROMPT = `너는 사용자의 라이프 디자인 기록을 읽고 해석하는 분석가다.

원칙:
1. 사용자가 실제로 쓴 문장과 숫자만 근거로 삼는다. 기록에 없는 성격 규정,
   진단, MBTI류 유형화는 하지 않는다.
2. 모든 관찰에는 근거를 붙인다. "너는 창의적이다"가 아니라
   "6월과 8월 저널 모두에서 편집 작업에 몰입 +5를 줬다" 형태로 쓴다.
3. 응원하지 않는다. 칭찬 문장을 넣지 않는다. 사용자는 정확한 관찰을 원한다.
4. 모순을 발견하면 부드럽게 넘기지 말고 그대로 지적한다.
5. 모든 제안은 "이번 주에 60분 안에 시작할 수 있는 것"으로 끝낸다.
6. 확신이 없으면 확신이 없다고 쓴다. 데이터가 부족한 영역을 명시한다.
7. 한국어로, 캐주얼하고 직설적인 톤. 존댓말 쓰지 마라.
8. 진로/직업 조언이지 심리 상담이 아니다. 정신건강 판단은 하지 않는다.

출력은 아래 JSON 스키마만. 마크다운 코드펜스 없이 JSON만 반환한다.
{
  "report_type": "snapshot|compare|pathway",
  "headline": "한 문장 요약",
  "observations": [
    { "text": "관찰", "evidence": ["근거 인용/수치"], "source": "goodtime|odyssey|..." }
  ],
  "pathways": [
    { "name": "", "why_it_fits": [""], "friction": [""], "smallest_test": "", "confidence": "high|medium|low" }
  ],
  "tension": "발견된 모순 (없으면 null)",
  "unknowns": [""],
  "next_question": ""
}`

type Body = {
  reportType: "snapshot" | "compare" | "pathway"
  inputHash: string
  inputRefs: Record<string, unknown>
  payload: unknown
}

async function callGemini(model: string, userText: string, apiKey: string) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userText }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini ${model} ${res.status}: ${errText}`)
  }
  const json = await res.json()
  const text =
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
    ""
  return text
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const geminiKey = Deno.env.get("GEMINI_API_KEY")
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: "planner" },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      })
    }

    const body = (await req.json()) as Body
    if (!body?.reportType || !body?.inputHash) {
      return new Response(JSON.stringify({ error: "invalid body" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      db: { schema: "planner" },
    })

    const { data: cached } = await admin
      .from("ld_ai_report")
      .select("*")
      .eq("user_id", user.id)
      .eq("input_hash", body.inputHash)
      .maybeSingle()

    if (cached) {
      const report = {
        id: cached.id,
        userId: cached.user_id,
        reportType: cached.report_type,
        inputHash: cached.input_hash,
        inputRefs: cached.input_refs,
        output: cached.output,
        model: cached.model,
        createdAt: cached.created_at,
      }
      return new Response(JSON.stringify({ report, cached: true }), {
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      })
    }

    const userText = [
      `report_type: ${body.reportType}`,
      `prompt_version: ${PROMPT_VERSION}`,
      `input_refs: ${JSON.stringify(body.inputRefs)}`,
      `payload: ${JSON.stringify(body.payload)}`,
    ].join("\n\n")

    let model = "gemini-2.5-pro"
    let raw = ""
    try {
      raw = await callGemini(model, userText, geminiKey)
    } catch {
      model = "gemini-2.5-flash"
      raw = await callGemini(model, userText, geminiKey)
    }

    let output: unknown
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
      output = JSON.parse(cleaned)
    } catch {
      return new Response(JSON.stringify({ error: "invalid model json", raw }), {
        status: 502,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      })
    }

    const id = crypto.randomUUID()
    const row = {
      id,
      user_id: user.id,
      report_type: body.reportType,
      input_hash: body.inputHash,
      input_refs: body.inputRefs,
      output,
      model,
    }
    const { error: insertErr } = await admin.from("ld_ai_report").insert(row)
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      })
    }

    const report = {
      id,
      userId: user.id,
      reportType: body.reportType,
      inputHash: body.inputHash,
      inputRefs: body.inputRefs,
      output,
      model,
      createdAt: new Date().toISOString(),
    }

    return new Response(JSON.stringify({ report, cached: false }), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    })
  }
})
