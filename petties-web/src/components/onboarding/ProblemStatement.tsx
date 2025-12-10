import {
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  BellAlertIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline'

const problems = [
  {
    icon: MagnifyingGlassIcon,
    title: 'Khó tìm bác sĩ thú y',
    description: 'Mất nhiều thời gian tìm kiếm phòng khám uy tín, phù hợp'
  },
  {
    icon: CalendarDaysIcon,
    title: 'Quy trình đặt lịch phức tạp',
    description: 'Phải gọi điện, chờ đợi, không biết lịch trống'
  },
  {
    icon: BellAlertIcon,
    title: 'Không có thông báo nhắc nhở',
    description: 'Dễ quên lịch tiêm phòng, khám định kỳ cho thú cưng'
  },
  {
    icon: CreditCardIcon,
    title: 'Thanh toán không an toàn',
    description: 'Lo lắng về bảo mật khi thanh toán trực tuyến'
  }
]

export const ProblemStatement = () => {
  return (
    <section className="section-brutal bg-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="heading-brutal text-stone-900 mb-4">
            BẠN ĐANG GẶP KHÓ KHĂN?
          </h2>
        </div>

        {/* Problem Cards */}
        <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
          {problems.map((problem, index) => {
            const Icon = problem.icon
            return (
              <div
                key={index}
                className="card-brutal p-6 sm:p-8 bg-white cursor-pointer w-full max-w-sm sm:w-[calc(50%-1rem)] lg:w-[calc(25%-1.5rem)] hover:translate-y-1 transition-transform"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 sm:mb-6 p-3 bg-stone-100 border-2 border-stone-900 shadow-[4px_4px_0_#1c1917]">
                    <Icon className="w-10 h-10 text-stone-900" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900 mb-3 sm:mb-4 uppercase">
                    {problem.title}
                  </h3>
                  <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
                    {problem.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
