const noteKey = (userId: string) => `planner:sidebarNote:${userId}`

export function loadSidebarNoteLocal(userId: string): string {
  try {
    return localStorage.getItem(noteKey(userId)) ?? ''
  } catch {
    return ''
  }
}

export function saveSidebarNoteLocal(userId: string, content: string): void {
  try {
    localStorage.setItem(noteKey(userId), content)
  } catch {
    // ignore quota / private mode
  }
}
