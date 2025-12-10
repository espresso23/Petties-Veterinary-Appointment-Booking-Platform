import {
  HeartIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  BriefcaseIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline'

const roles = [
  {
    icon: HeartIcon,
    title: 'Chủ nuôi thú cưng',
    description: 'Đặt lịch khám, theo dõi sức khỏe, nhận tư vấn AI'
  },
  {
    icon: UserGroupIcon,
    title: 'Bác sĩ thú y',
    description: 'Quản lý lịch hẹn, hồ sơ bệnh nhân, tăng thu nhập'
  },
  {
    icon: BuildingOffice2Icon,
    title: 'Chủ phòng khám',
    description: 'Quản lý phòng khám, nhân viên, doanh thu'
  },
  {
    icon: BriefcaseIcon,
    title: 'Quản lý phòng khám',
    description: 'Điều phối lịch làm việc, quản lý đặt lịch'
  },
  {
    icon: ComputerDesktopIcon,
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
          {roles.map((role, index) => {
            const Icon = role.icon
            return (
              <div
                key={index}
                className="card-brutal p-6 sm:p-8 bg-white text-center cursor-pointer w-full max-w-xs sm:w-[calc(50%-1rem)] lg:w-[calc(20%-1.6rem)] hover:bg-stone-50 transition-colors"
              >
                <div className="flex flex-col items-center">
                  <div className="mb-4 sm:mb-6">
                    <Icon className="w-12 h-12 text-amber-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900 mb-3 sm:mb-4 w-full uppercase">
                    {role.title}
                  </h3>
                  <p className="text-stone-600 text-sm sm:text-base leading-relaxed w-full">
                    {role.description}
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
