import { Link } from 'react-router-dom'

export const CTAFooter = () => {
  return (
    <footer className="bg-stone-900 text-white">
      {/* CTA Section */}
      <section className="section-brutal border-b border-stone-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="heading-brutal text-white mb-6 sm:mb-8">
            SẴN SÀNG BẮT ĐẦU?
          </h2>
          <p className="text-lg sm:text-xl text-stone-400 mb-10 sm:mb-12 max-w-2xl mx-auto">
            Tham gia cùng hàng nghìn chủ nuôi thú cưng đã tin tưởng Petties
          </p>
          <Link to="/auth/login" className="btn-brutal text-lg sm:text-xl px-10 sm:px-12 py-4 sm:py-5 cursor-pointer">
            ĐĂNG NHẬP NGAY
          </Link>
        </div>
      </section>

      {/* Footer Info */}
      <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-center md:justify-between gap-6 sm:gap-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-amber-500">
              PETTIES
            </span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-4 sm:gap-6 text-sm sm:text-base text-stone-400 justify-center">
            <a href="#" className="hover:text-white transition-colors cursor-pointer">
              Về chúng tôi
            </a>
            <a href="#" className="hover:text-white transition-colors cursor-pointer">
              Điều khoản
            </a>
            <a href="#" className="hover:text-white transition-colors cursor-pointer">
              Bảo mật
            </a>
            <a href="#" className="hover:text-white transition-colors cursor-pointer">
              Liên hệ
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-sm sm:text-base text-stone-500 text-center">
            © 2025 Petties. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
