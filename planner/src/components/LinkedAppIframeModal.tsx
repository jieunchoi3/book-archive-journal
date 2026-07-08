import { useEffect, useRef, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { LinkedApp } from '../types/linkedApp'

const LOAD_TIMEOUT_MS = 3000

interface LinkedAppIframeModalProps {
  app: LinkedApp
  onClose: () => void
}

export function LinkedAppIframeModal({ app, onClose }: LinkedAppIframeModalProps) {
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    timeoutRef.current = window.setTimeout(() => {
      setLoadTimedOut(true)
    }, LOAD_TIMEOUT_MS)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [app.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleLoad = () => {
    setLoaded(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const openInNewTab = () => {
    window.open(app.url, '_blank', 'noopener,noreferrer')
  }

  const showFallback = loadTimedOut && !loaded

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/30 backdrop-blur-[2px]">
      <div className="flex h-full flex-col bg-[#FDFCF9] shadow-2xl md:mx-auto md:my-4 md:h-[calc(100%-2rem)] md:max-w-5xl md:rounded-2xl md:border md:border-hairline">
        <header className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {app.icon && <span className="text-[16px]">{app.icon}</span>}
            <h2 className="truncate text-[15px] font-semibold text-[#1C1C1E]">{app.name}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={openInNewTab}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#007AFF] hover:bg-[#007AFF]/10"
            >
              Open in new tab
              <ExternalLink size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-[#F2F2F7]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          {!loaded && !showFallback && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#FDFCF9]">
              <p className="text-[13px] text-muted">Loading…</p>
            </div>
          )}

          {showFallback && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#FDFCF9]/95 px-6 text-center">
              <p className="text-[14px] font-medium text-[#1C1C1E]">
                This site may not allow embedding
              </p>
              <p className="max-w-sm text-[12px] leading-relaxed text-muted">
                Many apps block iframe loading for security. If you see a blank panel or login
                issues, open it in a new tab instead.
              </p>
              <button
                type="button"
                onClick={openInNewTab}
                className="flex items-center gap-1.5 rounded-lg bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0066DD]"
              >
                Open in new tab
                <ExternalLink size={14} />
              </button>
            </div>
          )}

          <iframe
            key={app.id}
            src={app.url}
            title={app.name}
            onLoad={handleLoad}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  )
}
