export type MailboxLetterKind = 'scheduled_letter' | 'prompt_answer'

export interface MailboxPrompt {
  id: string
  userId: string
  body: string
  cadenceDays: number
  nextDueOn: string
  isActive: boolean
  envelopeColor: string
  createdAt: string
}

export interface MailboxLetter {
  id: string
  userId: string
  kind: MailboxLetterKind
  promptId: string | null
  body: string
  writtenOn: string
  deliverOn: string
  openedAt: string | null
  feeling: number | null
  createdAt: string
}

export interface MailboxStore {
  prompts: MailboxPrompt[]
  letters: MailboxLetter[]
}

export const MAILBOX_ENVELOPE_COLORS = [
  '#E8D5C4',
  '#F5C6D6',
  '#C9E4DE',
  '#D4E4F7',
  '#E8E8ED',
  '#FFF8D6',
] as const

export const MAILBOX_DELIVER_PRESETS = [7, 30, 90] as const

export function emptyMailboxStore(): MailboxStore {
  return { prompts: [], letters: [] }
}
