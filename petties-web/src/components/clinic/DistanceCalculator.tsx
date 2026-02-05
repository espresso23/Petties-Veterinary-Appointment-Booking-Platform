import { useState, useEffect } from 'react'
import { clinicService } from '../../services/api/clinicService'
import type { DistanceResponse } from '../../types/clinic'

interface DistanceCalculatorProps {
  clinicId: string
  userLatitude?: number
  userLongitude?: number
  onDistanceCalculated?: (distance: DistanceResponse) => void
}

/**
 * DistanceCalculator component - Calculates distance from user location to clinic
 */
export function DistanceCalculator({
  clinicId,
  userLatitude,
  userLongitude,
  onDistanceCalculated,
}: DistanceCalculatorProps) {
  const [distance, setDistance] = useState<DistanceResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userLatitude || !userLongitude) {
      // Try to get user location from browser
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            calculateDistance(position.coords.latitude, position.coords.longitude)
          },
          () => {
            setError('Không thể lấy vị trí hiện tại của bạn')
          },
        )
      } else {
        setError('Trình duyệt không hỗ trợ Geolocation')
      }
      return
    }

    calculateDistance(userLatitude, userLongitude)
  }, [clinicId, userLatitude, userLongitude])

  const calculateDistance = async (lat: number, lng: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await clinicService.calculateDistance(clinicId, lat, lng)
      setDistance(result)
      if (onDistanceCalculated) {
        onDistanceCalculated(result)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Không thể tính khoảng cách')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="card-brutal p-4">
        <div className="text-stone-600 font-bold uppercase text-sm">Đang tính khoảng cách...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card-brutal p-4 bg-red-50 border-red-600">
        <div className="text-red-800 font-bold uppercase text-sm mb-1">Lỗi</div>
        <div className="text-red-700 text-xs">{error}</div>
      </div>
    )
  }

  if (!distance) {
    return null
  }

  return (
    <div className="card-brutal p-4">
      <div className="text-sm font-bold uppercase text-stone-600 mb-2">QUÃNG ĐƯỜNG</div>
      <div className="space-y-1">
        <div className="text-lg font-bold text-stone-900">{distance.distanceText}</div>
        <div className="text-sm text-stone-600">Thời gian dự kiến: {distance.durationText}</div>
      </div>
    </div>
  )
}

