const roles = [
  {
    icon: '🐕',
    title: 'Chủ nuôi thú cưng',
    description: 'Đặt lịch khám, theo dõi sức khỏe, nhận tư vấn AI'
  },
  {
    icon: '👨‍⚕️',
    title: 'Bác sĩ thú y',
    description: 'Quản lý lịch hẹn, hồ sơ bệnh nhân, tăng thu nhập'
  },
  {
    icon: '🏥',
    title: 'Chủ phòng khám',
    description: 'Quản lý phòng khám, nhân viên, doanh thu'
  },
  {
    icon: '👔',
    title: 'Quản lý phòng khám',
    description: 'Điều phối lịch làm việc, quản lý đặt lịch'
  },
  {
    icon: '👨‍💻',
    title: 'Quản trị viên',
    description: 'Quản lý toàn bộ hệ thống, người dùng, báo cáo'
  }
]

export const TargetUsersSection = () => {
  return (
    <section className="section-brutal bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="heading-brutal text-stone-900 mb-4 sm:mb-6">
            PETTIES DÀNH CHO AI?
          </h2>
          <p className="text-lg sm:text-xl text-stone-600 max-w-2xl mx-auto">
            Nền tảng đa vai trò, phục vụ mọi đối tượng
          </p>
        </div>

        {/* Role Cards */}
        <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
          {roles.map((role, index) => (
            <div
              key={index}
              className="card-brutal p-6 sm:p-8 bg-white text-center cursor-pointer w-full max-w-xs sm:w-[calc(50%-1rem)] lg:w-[calc(20%-1.6rem)]"
            >
              <div className="flex flex-col items-center">
                <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">{role.icon}</div>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900 mb-3 sm:mb-4 w-full">
                  {role.title}
                </h3>
                <p className="text-stone-600 text-sm sm:text-base leading-relaxed w-full">
                  {role.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
