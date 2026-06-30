interface OpenLibraryDoc {
  cover_i?: number
  title?: string
  author_name?: string[]
}

interface OpenLibraryResponse {
  docs?: OpenLibraryDoc[]
}

interface GoogleBooksVolume {
  volumeInfo?: {
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
  }
}

interface GoogleBooksResponse {
  items?: GoogleBooksVolume[]
}

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

async function fetchFromOpenLibrary(
  title: string,
  author: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    title: title.trim(),
    author: author.trim(),
    limit: '5',
  })

  const response = await fetch(
    `https://openlibrary.org/search.json?${params.toString()}`,
  )

  if (!response.ok) return null

  const data = (await response.json()) as OpenLibraryResponse
  const match = data.docs?.find((doc) => doc.cover_i)

  if (!match?.cover_i) return null

  return `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg`
}

async function fetchFromGoogleBooks(
  title: string,
  author: string,
): Promise<string | null> {
  const query = `intitle:${title.trim()} inauthor:${author.trim()}`
  const params = new URLSearchParams({
    q: query,
    maxResults: '5',
  })

  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
  )

  if (!response.ok) return null

  const data = (await response.json()) as GoogleBooksResponse
  const thumbnail = data.items?.find(
    (item) =>
      item.volumeInfo?.imageLinks?.thumbnail ||
      item.volumeInfo?.imageLinks?.smallThumbnail,
  )?.volumeInfo?.imageLinks

  const url = thumbnail?.thumbnail ?? thumbnail?.smallThumbnail
  if (!url) return null

  return url.replace(/^http:/, 'https:')
}

export async function fetchBookCover(
  title: string,
  author: string,
): Promise<string | null> {
  const trimmedTitle = title.trim()
  const trimmedAuthor = author.trim()

  if (!trimmedTitle || !trimmedAuthor) return null

  try {
    const openLibraryCover = await fetchFromOpenLibrary(
      trimmedTitle,
      trimmedAuthor,
    )
    if (openLibraryCover) return openLibraryCover
  } catch {
    // Fall through to Google Books
  }

  try {
    return await fetchFromGoogleBooks(trimmedTitle, trimmedAuthor)
  } catch {
    return null
  }
}

export function canFetchBookCover(title: string, author: string): boolean {
  return normalize(title).length > 0 && normalize(author).length > 0
}
