const features = [
  {
    icon: '🏠',
    title: 'Đặt lịch khám tại nhà',
    description: 'Bác sĩ đến tận nơi, tiện lợi cho thú cưng và chủ nuôi'
  },
  {
    icon: '📱',
    title: 'Quản lý đơn giản',
    description: 'Theo dõi lịch hẹn, hồ sơ sức khỏe trên một ứng dụng'
  },
  {
    icon: '🤖',
    title: 'AI Tư vấn 24/7',
    description: 'Trả lời câu hỏi về sức khỏe thú cưng bất cứ lúc nào'
  },
  {
    icon: '💳',
    title: 'Thanh toán an toàn',
    description: 'Nhiều phương thức thanh toán, bảo mật tuyệt đối'
  },
  {
    icon: '📋',
    title: 'Hồ sơ y tế điện tử',
    description: 'Lưu trữ toàn bộ lịch sử khám bệnh, tiêm phòng'
  }
]

export const FeaturesSection = () => {
  return (
    <section id="features" className="section-brutal bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="heading-brutal text-stone-900 mb-4 sm:mb-6">
            PETTIES GIẢI QUYẾT MỌI VẤN ĐỀ
          </h2>
          <p className="text-lg sm:text-xl text-stone-600 max-w-2xl mx-auto">
            Một nền tảng - Trọn vẹn trải nghiệm
          </p>
        </div>

        {/* Feature Cards */}
        <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card-brutal p-8 sm:p-10 bg-amber-50 cursor-pointer w-full max-w-sm text-center sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.5rem)]"
            >
              <div className="flex flex-col items-center">
                <div className="text-5xl sm:text-6xl mb-6 sm:mb-8">{feature.icon}</div>
                <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-4 sm:mb-5 w-full">
                  {feature.title}
                </h3>
                <p className="text-stone-600 text-base sm:text-lg leading-relaxed w-full">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
