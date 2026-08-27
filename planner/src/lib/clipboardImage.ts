function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  if (!file.type || file.type === 'application/octet-stream') {
    return /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)$/i.test(file.name)
  }
  return false
}

function readClipboardImageFile(e: ClipboardEvent): File | null {
  const dt = e.clipboardData
  if (!dt) return null

  if (dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const file = dt.files[i]
      if (file && isImageFile(file)) return file
    }
  }

  const items = dt.items
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item || item.kind !== 'file') continue
      const file = item.getAsFile()
      if (file && isImageFile(file)) return file
    }
  }

  return null
}

function readClipboardImageDataUrl(e: ClipboardEvent): string | null {
  const dt = e.clipboardData
  if (!dt) return null

  const html = dt.getData('text/html')
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const src = doc.querySelector('img')?.getAttribute('src')
    if (src?.startsWith('data:image/')) return src
  }

  const text = dt.getData('text/plain')?.trim()
  if (text?.startsWith('data:image/')) return text

  return null
}

/** Returns a pasted image as a File or data URL, or null if the clipboard has no image. */
export function readClipboardImage(e: ClipboardEvent): File | string | null {
  return readClipboardImageFile(e) ?? readClipboardImageDataUrl(e)
}

/** If the clipboard contains an image, prevent default paste and invoke `onImage`. */
export function handleClipboardImagePaste(
  e: ClipboardEvent,
  onImage: (source: File | string) => void,
): boolean {
  const image = readClipboardImage(e)
  if (!image) return false
  e.preventDefault()
  e.stopPropagation()
  onImage(image)
  return true
}
