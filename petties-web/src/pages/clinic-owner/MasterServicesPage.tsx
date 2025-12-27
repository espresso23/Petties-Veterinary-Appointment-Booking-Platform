import { MasterServiceGrid } from '../../components/clinic-owner'
import '../../styles/brutalist.css'

/**
 * CLINIC_OWNER Master Services Page - Neobrutalism Design
 * Quản lý dịch vụ mẫu (Master Services) - Template cho tất cả phòng khám
 */
export const MasterServicesPage = () => {
  return (
    <div className="min-h-screen bg-stone-50">
      <MasterServiceGrid />
    </div>
  )
}
