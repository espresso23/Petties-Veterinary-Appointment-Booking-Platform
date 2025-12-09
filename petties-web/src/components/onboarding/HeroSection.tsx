import { Link } from 'react-router-dom'

export const HeroSection = () => {
  return (
    <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-16 bg-gradient-to-b from-amber-100 to-stone-50">
      <div className="max-w-5xl mx-auto w-full text-center">
        {/* Logo */}
        <div className="mb-10 sm:mb-12">
          <span className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-amber-600 tracking-tight">
            PETTIES
          </span>
        </div>

        {/* Headline */}
        <h1 className="heading-brutal text-stone-900 mb-8 sm:mb-10 max-w-4xl mx-auto">
          CHĂM SÓC THÚ CƯNG DỄ DÀNG HƠN
        </h1>

        {/* Subheadline Box */}
        <div className="flex justify-center mb-12 sm:mb-16">
          <div className="border-brutal bg-white p-6 sm:p-8 shadow-brutal max-w-3xl w-full text-center">
            <p className="text-base sm:text-lg md:text-xl text-stone-700 font-medium leading-relaxed">
              Nền tảng kết nối chủ nuôi thú cưng với bác sĩ thú y chuyên nghiệp.
              <br className="hidden sm:block" />
              Đặt lịch khám, tư vấn 24/7, quản lý hồ sơ sức khỏe.
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-20 sm:mb-24">
          <Link to="/auth/login" className="btn-brutal text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 cursor-pointer">
            ĐĂNG NHẬP NGAY
          </Link>
          <a href="#features" className="btn-brutal-outline text-base sm:text-lg px-8 sm:px-10 py-4 sm:py-5 cursor-pointer">
            TÌM HIỂU THÊM
          </a>
        </div>

        {/* Scroll indicator */}
        <div className="animate-bounce">
          <svg
            className="w-8 h-8 mx-auto text-stone-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </div>
    </section>
  )
}
