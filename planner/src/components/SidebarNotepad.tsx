import { MyNoteColumns } from './MyNoteColumns'

export function SidebarNotepad() {
  return (
    <MyNoteColumns
      variant="sidebar"
      minHeightClass="min-h-[200px]"
      maxHeightClass="max-h-[50vh]"
    />
  )
}
