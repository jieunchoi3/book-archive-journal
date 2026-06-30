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
