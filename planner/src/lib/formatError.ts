export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.error_description === 'string') return record.error_description
    if (typeof record.details === 'string') return record.details
    if (typeof record.hint === 'string' && typeof record.message === 'string') {
      return `${record.message} (${record.hint})`
    }
  }
  try {
    return JSON.stringify(error)
  } catch {
    return 'Something went wrong'
  }
}

export function logError(context: string, error: unknown): void {
  console.error(`[planner] ${context}:`, formatError(error), error)
}
