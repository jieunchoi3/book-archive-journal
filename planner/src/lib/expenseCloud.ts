import type { ExpenseStore } from '../types/expense'
import { emptyExpenseStore } from '../types/expense'
import { supabase } from './supabase'

type ExpenseRow = {
  user_id: string
  store: ExpenseStore
  updated_at: string
}

export async function fetchExpenseStoreCloud(userId: string): Promise<{
  store: ExpenseStore
  updatedAt: string
} | null> {
  const { data, error } = await supabase
    .from('expense_stores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const row = data as ExpenseRow
  return {
    store: row.store ?? emptyExpenseStore(),
    updatedAt: row.updated_at,
  }
}

export async function upsertExpenseStoreCloud(
  userId: string,
  store: ExpenseStore,
): Promise<void> {
  const { error } = await supabase.from('expense_stores').upsert(
    {
      user_id: userId,
      store,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}
