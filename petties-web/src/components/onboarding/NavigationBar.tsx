import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export const NavigationBar = () => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300 w-full
        ${scrolled
          ? 'bg-white border-b-4 border-stone-900 shadow-brutal-sm'
          : 'bg-white/90 backdrop-blur-sm border-b-4 border-stone-900 shadow-brutal-sm'
        }
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80">
            <span className="text-2xl sm:text-3xl font-bold text-amber-600">
              PETTIES
            </span>
          </Link>

          {/* CTA Button */}
          <Link
            to="/auth/login"
            className="btn-brutal-outline text-xs sm:text-sm cursor-pointer"
          >
            Đăng Nhập
          </Link>
        </div>
      </div>
    </nav>
  )
}
