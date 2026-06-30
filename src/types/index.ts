export type TextStyle = 'heading' | 'subheading' | 'body'
export type NoteBlockType = TextStyle | 'quote' | 'thought' | 'image'

export interface NoteBlock {
  id: string
  type: NoteBlockType
  content: string
  bold?: boolean
  color?: string
  imageUrl?: string
  width?: number
  height?: number
}

export interface Book {
  id: string
  title: string
  author: string
  coverUrl?: string
  startDate?: string
  endDate?: string
  currentlyReading: boolean
  favorite?: boolean
  tags: string[]
  rating?: number
  notes: NoteBlock[]
  memorableLine?: string
  addedAt: string
}

export type GenreFilter = 'All Books' | (string & {})
