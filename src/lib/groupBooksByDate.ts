import type { Book } from '../types'

export function getBookArchiveDate(book: Book): string {
  return book.endDate ?? book.startDate ?? book.addedAt
}

export interface YearMonthGroup {
  year: number
  months: MonthGroup[]
}

export interface MonthGroup {
  month: number
  books: Book[]
}

export function groupBooksByYearMonth(books: Book[]): YearMonthGroup[] {
  const byYear = new Map<number, Map<number, Book[]>>()

  for (const book of books) {
    const date = getBookArchiveDate(book)
    const parsed = new Date(`${date}T00:00:00`)
    const year = parsed.getFullYear()
    const month = parsed.getMonth() + 1

    if (!byYear.has(year)) byYear.set(year, new Map())
    const byMonth = byYear.get(year)!
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month)!.push(book)
  }

  const sortBooks = (items: Book[]) =>
    [...items].sort(
      (a, b) =>
        new Date(getBookArchiveDate(b)).getTime() -
        new Date(getBookArchiveDate(a)).getTime(),
    )

  return [...byYear.entries()]
    .sort(([yearA], [yearB]) => yearB - yearA)
    .map(([year, monthsMap]) => ({
      year,
      months: [...monthsMap.entries()]
        .sort(([monthA], [monthB]) => monthB - monthA)
        .map(([month, monthBooks]) => ({
          month,
          books: sortBooks(monthBooks),
        })),
    }))
}

export function formatYearLabel(year: number): string {
  return `${year}년`
}

export function formatMonthLabel(month: number): string {
  return `${month}월`
}

export function getBookYear(book: Book): number {
  return new Date(`${getBookArchiveDate(book)}T00:00:00`).getFullYear()
}

export function getBookMonth(book: Book): number {
  return new Date(`${getBookArchiveDate(book)}T00:00:00`).getMonth() + 1
}

export function getAvailableYears(books: Book[]): number[] {
  const years = new Set(books.map(getBookYear))
  return [...years].sort((a, b) => b - a)
}

export function getAvailableMonths(books: Book[], year: number): number[] {
  const months = new Set(
    books.filter((book) => getBookYear(book) === year).map(getBookMonth),
  )
  return [...months].sort((a, b) => b - a)
}

export function sortBooksByArchiveDate(books: Book[]): Book[] {
  return [...books].sort(
    (a, b) =>
      new Date(getBookArchiveDate(b)).getTime() -
      new Date(getBookArchiveDate(a)).getTime(),
  )
}

export function filterBooksByDate(
  books: Book[],
  year: number | null,
  month: number | null,
): Book[] {
  return books.filter((book) => {
    if (year !== null && getBookYear(book) !== year) return false
    if (month !== null && getBookMonth(book) !== month) return false
    return true
  })
}
