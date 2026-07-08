import { usePlannerData, type ItemsActions } from '../context/PlannerDataContext'

export type { ItemsActions }

export function useItems(_weekStart?: string): ItemsActions {
  const data = usePlannerData()
  return {
    categories: data.categories,
    tags: data.tags,
    items: data.items,
    itemsByDay: data.itemsByDay,
    getItemsForDay: data.getItemsForDay,
    getCategory: data.getCategory,
    getTag: data.getTag,
    addCategory: data.addCategory,
    updateCategory: data.updateCategory,
    deleteCategory: data.deleteCategory,
    addTag: data.addTag,
    updateTag: data.updateTag,
    deleteTag: data.deleteTag,
    addItem: data.addItem,
    updateItem: data.updateItem,
    deleteItem: data.deleteItem,
    toggleItemDone: data.toggleItemDone,
    filterItems: data.filterItems,
    getColumnItems: data.getColumnItems,
    getColumnStats: data.getColumnStats,
  }
}
