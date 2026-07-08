import { usePlannerData, type PlannerActions, createTask } from '../context/PlannerDataContext'

export { createTask, type PlannerActions }

export function usePlanner(): PlannerActions {
  const data = usePlannerData()
  return {
    template: data.template,
    weekStart: data.weekStart,
    weeklyLog: data.weeklyLog,
    getBlockLog: data.getBlockLog,
    getBlockTasks: data.getBlockTasks,
    getOneOffTasks: data.getOneOffTasks,
    toggleTask: data.toggleTask,
    toggleHideTask: data.toggleHideTask,
    isBlockCompleteForDay: data.isBlockCompleteForDay,
    getHiddenBlockTasks: data.getHiddenBlockTasks,
    setFlexibleNote: data.setFlexibleNote,
    addTask: data.addTask,
    deleteRecurringTask: data.deleteRecurringTask,
    deleteOneOffTask: data.deleteOneOffTask,
    renameOneOffTask: data.renameOneOffTask,
    renameRecurringTask: data.renameRecurringTask,
    updateBlock: data.updateBlock,
    deleteBlock: data.deleteBlock,
    addBlock: data.addBlock,
    reorderBlocks: data.reorderBlocks,
    goToWeek: data.goToWeek,
    dayCompletion: data.dayCompletion,
    weekCompletionPercent: data.weekCompletionPercent,
  }
}
