import logoDefault from '../../assets/images/logo/logo.png'

interface ClinicLogoDisplayProps {
  logoUrl?: string
  alt?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
}

export function ClinicLogoDisplay({ logoUrl, alt = 'Clinic Logo', className = '', size = 'md' }: ClinicLogoDisplayProps) {
  const displayLogo = logoUrl || logoDefault

  return (
    <img
      src={displayLogo}
      alt={alt}
      className={`${sizeClasses[size]} object-contain border-4 border-stone-900 bg-white ${className}`}
      onError={(e) => {
        const target = e.target as HTMLImageElement
        // Fallback to default logo if image fails to load
        if (target.src !== logoDefault) {
          target.src = logoDefault
        }
      }}
    />
  )
}

