import type { MailboxLetter, MailboxPrompt, MailboxStore } from '../types/mailbox'
import { supabase } from './supabase'

type PromptRow = {
  id: string
  user_id: string
  body: string
  cadence_days: number
  next_due_on: string
  is_active: boolean
  envelope_color: string
  created_at: string
}

type LetterRow = {
  id: string
  user_id: string
  kind: string
  prompt_id: string | null
  body: string
  written_on: string
  deliver_on: string
  opened_at: string | null
  feeling: number | null
  created_at: string
}

function normalizeDateKey(value: string | Date): string {
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value).slice(0, 10)
}

function rowToPrompt(row: PromptRow): MailboxPrompt {
  return {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    cadenceDays: row.cadence_days,
    nextDueOn: normalizeDateKey(row.next_due_on),
    isActive: row.is_active,
    envelopeColor: row.envelope_color,
    createdAt: row.created_at,
  }
}

function rowToLetter(row: LetterRow): MailboxLetter {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind as MailboxLetter['kind'],
    promptId: row.prompt_id,
    body: row.body,
    writtenOn: normalizeDateKey(row.written_on),
    deliverOn: normalizeDateKey(row.deliver_on),
    openedAt: row.opened_at,
    feeling: row.feeling,
    createdAt: row.created_at,
  }
}

function promptToRow(p: MailboxPrompt) {
  return {
    id: p.id,
    user_id: p.userId,
    body: p.body,
    cadence_days: p.cadenceDays,
    next_due_on: p.nextDueOn,
    is_active: p.isActive,
    envelope_color: p.envelopeColor,
    created_at: p.createdAt,
  }
}

function letterToRow(l: MailboxLetter) {
  return {
    id: l.id,
    user_id: l.userId,
    kind: l.kind,
    prompt_id: l.promptId,
    body: l.body,
    written_on: l.writtenOn,
    deliver_on: l.deliverOn,
    opened_at: l.openedAt,
    feeling: l.feeling,
    created_at: l.createdAt,
  }
}

export async function fetchMailboxCloud(userId: string): Promise<MailboxStore> {
  const [promptsRes, lettersRes] = await Promise.all([
    supabase.from('mailbox_prompts').select('*').eq('user_id', userId),
    supabase.from('mailbox_letters').select('*').eq('user_id', userId),
  ])
  if (promptsRes.error) throw promptsRes.error
  if (lettersRes.error) throw lettersRes.error
  return {
    prompts: (promptsRes.data ?? []).map((r) => rowToPrompt(r as PromptRow)),
    letters: (lettersRes.data ?? []).map((r) => rowToLetter(r as LetterRow)),
  }
}

export async function upsertMailboxPromptCloud(prompt: MailboxPrompt): Promise<void> {
  const { error } = await supabase.from('mailbox_prompts').upsert(promptToRow(prompt), {
    onConflict: 'id',
  })
  if (error) throw error
}

export async function upsertMailboxLetterCloud(letter: MailboxLetter): Promise<void> {
  const { error } = await supabase.from('mailbox_letters').upsert(letterToRow(letter), {
    onConflict: 'id',
  })
  if (error) throw error
}

export async function deleteMailboxPromptCloud(promptId: string): Promise<void> {
  const { error } = await supabase.from('mailbox_prompts').delete().eq('id', promptId)
  if (error) throw error
}

export async function deleteMailboxLetterCloud(letterId: string): Promise<void> {
  const { error } = await supabase.from('mailbox_letters').delete().eq('id', letterId)
  if (error) throw error
}

/** Prompts before letters — letters reference prompt_id. */
export async function syncMailboxToCloud(store: MailboxStore): Promise<void> {
  for (const prompt of store.prompts) {
    await upsertMailboxPromptCloud(prompt)
  }
  for (const letter of store.letters) {
    await upsertMailboxLetterCloud(letter)
  }
}
