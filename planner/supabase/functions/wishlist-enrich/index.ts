import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  corsHeaders,
  runWishlistEnrich,
  verifySupabaseUser,
  type EnrichBody,
} from '../_shared/wishlistEnrichCore.ts'

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

    await verifySupabaseUser(authHeader, supabaseUrl, supabaseAnon)
    const body = (await req.json()) as EnrichBody
    const { result, model } = await runWishlistEnrich(body, geminiKey)

    return new Response(JSON.stringify({ result, model }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = String(e)
    const status = message.includes('unauthorized')
      ? 401
      : message.includes('Provide a product')
        ? 400
        : 500
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }
})
