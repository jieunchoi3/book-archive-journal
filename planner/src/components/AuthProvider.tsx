import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { AuthContext, type AuthContextValue } from '../hooks/useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const signingIn = useRef(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in planner/.env')
      setLoading(false)
      return
    }

    let cancelled = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (cancelled) return

      if (nextSession) {
        setSession(nextSession)
        setError(null)
        setLoading(false)
        return
      }

      if (event !== 'INITIAL_SESSION' || signingIn.current) return

      const email = import.meta.env.VITE_APP_EMAIL
      const password = import.meta.env.VITE_APP_PASSWORD
      if (!email || !password) {
        setError('Missing VITE_APP_EMAIL or VITE_APP_PASSWORD in planner/.env')
        setLoading(false)
        return
      }

      signingIn.current = true
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (cancelled) return

      if (signInError) {
        signingIn.current = false
        setError(signInError.message)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      signingIn.current = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    (): AuthContextValue | null =>
      session ? { session, user: session.user } : null,
    [session],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    )
  }

  if (error || !value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
        <p className="max-w-sm text-center text-[13px] text-red-600">
          {error ?? 'Could not start the planner.'}
        </p>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
