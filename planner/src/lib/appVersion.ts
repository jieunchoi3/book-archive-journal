const STORAGE_KEY = 'planner:last-app-version'

export function readAppVersionMeta(): string | null {
  return document.querySelector('meta[name="app-version"]')?.getAttribute('content') ?? null
}

/**
 * Hard-refresh when Vercel ships a new build so PWAs do not stay on an old JS bundle.
 * Delay briefly so in-flight React pagehide flushes can start before navigation.
 */
export function ensureAppVersionFresh(): void {
  const meta = readAppVersionMeta()
  if (!meta) return

  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    return
  }

  if (stored && stored !== meta) {
    try {
      localStorage.setItem(STORAGE_KEY, meta)
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href)
    url.searchParams.set('v', meta)
    // Give pagehide / visibility handlers a beat to flush local→cloud before replace.
    window.setTimeout(() => {
      window.location.replace(url.toString())
    }, 400)
    return
  }

  if (!stored) {
    try {
      localStorage.setItem(STORAGE_KEY, meta)
    } catch {
      /* ignore */
    }
  }
}
