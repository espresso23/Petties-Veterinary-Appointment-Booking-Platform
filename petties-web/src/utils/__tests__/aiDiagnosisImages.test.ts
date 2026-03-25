import { describe, expect, it } from 'vitest'
import {
  buildAiDiagnosisImageUrls,
  isAiReadyImageUrl,
} from '../aiDiagnosisImages'

describe('aiDiagnosisImages', () => {
  it('filters out blob preview urls and keeps AI-ready image urls', () => {
    expect(
      buildAiDiagnosisImageUrls({
        imageUrls: ['https://example.com/emr-eye.jpg', ''],
        pendingImageDataUrls: [
          'blob:http://localhost:5173/preview-1',
          'data:image/jpeg;base64,abc123',
        ],
        croppedImageUrls: ['data:image/png;base64,xyz789'],
      })
    ).toEqual([
      'https://example.com/emr-eye.jpg',
      'data:image/jpeg;base64,abc123',
      'data:image/png;base64,xyz789',
    ])
  })

  it('deduplicates repeated urls before sending them to AI', () => {
    expect(
      buildAiDiagnosisImageUrls({
        imageUrls: ['https://example.com/emr-eye.jpg'],
        pendingImageDataUrls: ['https://example.com/emr-eye.jpg'],
        croppedImageUrls: ['data:image/png;base64,xyz789', 'data:image/png;base64,xyz789'],
      })
    ).toEqual([
      'https://example.com/emr-eye.jpg',
      'data:image/png;base64,xyz789',
    ])
  })

  it('recognizes AI-ready urls correctly', () => {
    expect(isAiReadyImageUrl('https://example.com/emr-eye.jpg')).toBe(true)
    expect(isAiReadyImageUrl('data:image/jpeg;base64,abc123')).toBe(true)
    expect(isAiReadyImageUrl('blob:http://localhost:5173/preview-1')).toBe(false)
    expect(isAiReadyImageUrl('   ')).toBe(false)
  })
})
