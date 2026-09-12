import type { ItemOccurrence } from '../types/item'
import { getItemDone, isRecurringItem } from '../types/item'
import type { ItemsActions } from '../hooks/useItems'
import { getOccurrenceDatesInRange } from './itemRecurrence'
import { shiftDateKey } from './weekUtils'

/** Move a one-shot event forward one day, or skip a recurring occurrence and ensure it shows tomorrow. */
export function postponeItemOccurrence(items: ItemsActions, occurrence: ItemOccurrence): void {
  const { item, dateKey } = occurrence
  const tomorrow = shiftDateKey(dateKey, 1)

  if (!isRecurringItem(item)) {
    items.updateItem(item.id, { dueDate: tomorrow })
    return
  }

  if (!getItemDone(item, dateKey)) {
    items.toggleItemDone(item.id, dateKey)
  }

  const hasRecurringTomorrow =
    getOccurrenceDatesInRange(item, tomorrow, tomorrow).length > 0
  if (hasRecurringTomorrow) return

  items.addItem({
    title: item.title,
    categoryId: item.categoryId,
    tagIds: [...item.tagIds],
    dueDate: tomorrow,
    recurrence: null,
    showOnWeeklyView: true,
    time: item.time,
    checkable: item.checkable,
  })
}
