export const isAiReadyImageUrl = (value?: string | null): boolean => {
  const normalized = value?.trim() || ''
  return normalized !== '' && !normalized.startsWith('blob:')
}

export const buildAiDiagnosisImageUrls = ({
  imageUrls = [],
  pendingImageDataUrls = [],
  croppedImageUrls = [],
}: {
  imageUrls?: string[]
  pendingImageDataUrls?: string[]
  croppedImageUrls?: string[]
}): string[] => {
  const merged = [...imageUrls, ...pendingImageDataUrls, ...croppedImageUrls]
    .map((item) => item.trim())
    .filter(isAiReadyImageUrl)

  return Array.from(new Set(merged))
}

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.trim() !== '') {
        resolve(reader.result)
        return
      }
      reject(new Error('Không thể đọc dữ liệu ảnh đã chọn cho AI.'))
    }

    reader.onerror = () => {
      reject(reader.error ?? new Error('Không thể đọc dữ liệu ảnh đã chọn cho AI.'))
    }

    reader.readAsDataURL(file)
  })
