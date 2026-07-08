import { useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'

type AuthMode = 'password' | 'magic'

export function LoginScreen({
  onSignIn,
  onSignUp,
  onMagicLink,
}: {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  onMagicLink: (email: string) => Promise<void>
}) {
  const [mode, setMode] = useState<AuthMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'magic') {
        await onMagicLink(email)
        setMessage('Check your email for a magic link.')
      } else if (isSignUp) {
        await onSignUp(email, password)
        setMessage('Account created. You can sign in now.')
        setIsSignUp(false)
      } else {
        await onSignIn(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-[20px] font-semibold">Weekly Planner</h1>
          <p className="mt-3 text-[13px] text-muted">
            Add <code className="text-[12px]">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-[12px]">VITE_SUPABASE_ANON_KEY</code> to{' '}
            <code className="text-[12px]">planner/.env</code>, then run the SQL schema in your
            Supabase project.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-hairline bg-white p-8 shadow-sm">
        <h1 className="text-[22px] font-semibold tracking-tight">Weekly Planner</h1>
        <p className="mt-1 text-[13px] text-muted">Sign in to sync across devices</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-hairline px-4 py-2.5 text-[14px] focus:border-[#007AFF]/40 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20"
          />

          {mode === 'password' && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="w-full rounded-xl border border-hairline px-4 py-2.5 text-[14px] focus:border-[#007AFF]/40 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/20"
            />
          )}

          {error && <p className="text-[12px] text-red-600">{error}</p>}
          {message && <p className="text-[12px] text-[#3D8B40]">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#007AFF] py-2.5 text-[14px] font-medium text-white hover:bg-[#0066DD] disabled:opacity-50"
          >
            {loading
              ? 'Please wait…'
              : mode === 'magic'
                ? 'Send magic link'
                : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-center text-[12px]">
          {mode === 'password' && (
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[#007AFF]"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}
            className="text-muted hover:text-[#48484A]"
          >
            {mode === 'password' ? 'Use magic link instead' : 'Use password instead'}
          </button>
        </div>
      </div>
    </div>
  )
}
