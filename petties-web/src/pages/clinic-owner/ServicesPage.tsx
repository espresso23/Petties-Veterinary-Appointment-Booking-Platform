import { ServiceGrid } from '../../components/clinic-owner'
import '../../styles/brutalist.css'

/**
 * CLINIC_OWNER Services Page - Neobrutalism Design
 * Manage clinic services, pricing, and duration
 */
export const ServicesPage = () => {
  return (
    <div className="min-h-screen bg-stone-50">
      <ServiceGrid />
    </div>
  )
}
