import apiClient from '../api/client'

export interface UploadResponse {
  url: string
  fileName: string
  fileSize: number
}

/**
 * Upload business license document to Cloudinary
 * @param file - PDF, JPG, or PNG file (max 5MB)
 * @returns Upload response with file URL
 */
export async function uploadBusinessLicense(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<UploadResponse>('/files/upload/business-license', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

/**
 * Upload clinic image to Cloudinary
 * @param clinicId - Clinic ID
 * @param file - Image file
 * @returns Upload response with image URL
 */
export async function uploadClinicImage(clinicId: string, file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<UploadResponse>(`/clinics/${clinicId}/images/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}
