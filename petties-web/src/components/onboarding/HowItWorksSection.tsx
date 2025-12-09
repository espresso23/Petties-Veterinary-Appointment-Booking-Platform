const steps = [
  {
    number: '01',
    title: 'Tạo tài khoản & Thêm thú cưng',
    description: 'Đăng ký miễn phí, thêm thông tin thú cưng của bạn vào hệ thống'
  },
  {
    number: '02',
    title: 'Tìm bác sĩ & Đặt lịch',
    description: 'Chọn bác sĩ phù hợp, đặt lịch khám tại phòng khám hoặc tại nhà'
  },
  {
    number: '03',
    title: 'Thanh toán & Nhận dịch vụ',
    description: 'Thanh toán trực tuyến an toàn, nhận dịch vụ chăm sóc chuyên nghiệp'
  }
]

export const HowItWorksSection = () => {
  return (
    <section className="section-brutal bg-stone-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="heading-brutal text-white">
            CÁCH SỬ DỤNG PETTIES
          </h2>
        </div>

        {/* Steps Timeline */}
        <div className="flex flex-wrap justify-center gap-12 md:gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <div key={index} className="relative w-full max-w-sm md:w-[calc(33.333%-2rem)]">
              {/* Connector Line (hidden on mobile) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[calc(50%+8rem)] w-[calc(100%-16rem)] h-1 bg-amber-500 z-0" />
              )}

              {/* Step Card */}
              <div className="relative z-10 text-center flex flex-col items-center">
                {/* Number Circle */}
                <div className="inline-flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 border-4 border-amber-500 bg-stone-900 mb-6 sm:mb-8">
                  <span className="text-3xl sm:text-4xl font-bold text-amber-500">
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-5 w-full">
                  {step.title}
                </h3>
                <p className="text-stone-400 text-base sm:text-lg w-full leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
