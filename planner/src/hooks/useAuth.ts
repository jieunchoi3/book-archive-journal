import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in planner/.env')
      setLoading(false)
      return
    }

    let cancelled = false

    async function ensureSession() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return

      if (sessionError) {
        setError(sessionError.message)
        setLoading(false)
        return
      }

      if (sessionData.session) {
        setSession(sessionData.session)
        setLoading(false)
        return
      }

      const email = import.meta.env.VITE_APP_EMAIL
      const password = import.meta.env.VITE_APP_PASSWORD
      if (!email || !password) {
        setError('Missing VITE_APP_EMAIL or VITE_APP_PASSWORD in planner/.env')
        setLoading(false)
        return
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (cancelled) return

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      setSession(data.session)
      setLoading(false)
    }

    void ensureSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    user: session?.user ?? null,
    loading,
    error,
  }
}

export type { User }
