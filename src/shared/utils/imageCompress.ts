/**
 * Compress an image file using Canvas API.
 * Returns a base64 data URL (JPEG).
 */
export async function compressImage(
  file: File,
  maxWidth: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      URL.revokeObjectURL(img.src)
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Compress a base64 data URL string (for re-compressing existing photos).
 */
export async function compressDataUrl(
  dataUrl: string,
  maxWidth: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

/** Compress for storage: long edge ≤ 1200px, JPEG quality 0.8 */
export function compressFull(file: File): Promise<string> {
  return compressImage(file, 1200, 0.8)
}

/** Generate thumbnail: long edge ≤ 300px, JPEG quality 0.6 */
export function compressThumb(file: File): Promise<string> {
  return compressImage(file, 300, 0.6)
}
