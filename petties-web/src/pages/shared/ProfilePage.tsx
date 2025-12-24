import { useEffect, useState } from 'react'
import { useUserStore } from '../../store/userStore'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/Toast'
import { AvatarUpload } from '../../components/profile/AvatarUpload'
import { ChangePasswordModal } from '../../components/profile/ChangePasswordModal'
import { EmailChangeModal } from '../../components/profile/EmailChangeModal'
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  KeyIcon,
  ShieldCheckIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

// Roles that can edit their profile on web
const EDITABLE_ROLES = ['VET', 'CLINIC_OWNER', 'CLINIC_MANAGER']

export function ProfilePage() {
  const { user } = useAuthStore()
  const {
    profile,
    isLoading,
    error,
    fetchProfile,
    updateUserProfile,
    uploadUserAvatar,
    deleteUserAvatar,
    changeUserPassword,
    clearError,
  } = useUserStore()
  const { showToast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isEmailChangeModalOpen, setIsEmailChangeModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
  })

  // Check if current user can edit profile
  const canEdit = user?.role && EDITABLE_ROLES.includes(user.role)

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    if (profile) {
      setEditForm({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
      })
    }
  }, [profile])

  useEffect(() => {
    if (error) {
      showToast('error', error)
      clearError()
    }
  }, [error, showToast, clearError])

  const handleSaveProfile = async () => {
    try {
      await updateUserProfile(editForm)
      setIsEditing(false)
      showToast('success', 'Cập nhật profile thành công')
    } catch {
      // Error handled by store
    }
  }

  const handleCancelEdit = () => {
    if (profile) {
      setEditForm({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
      })
    }
    setIsEditing(false)
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '--'
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getRoleLabel = (role: string | undefined) => {
    switch (role) {
      case 'ADMIN':
        return 'Quản Trị Viên'
      case 'VET':
        return 'Bác Sĩ Thú Y'
      case 'CLINIC_OWNER':
        return 'Chủ Phòng Khám'
      case 'CLINIC_MANAGER':
        return 'Quản Lý Phòng Khám'
      default:
        return role || '--'
    }
  }

  if (isLoading && !profile) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="heading-brutal text-stone-900 mb-2">THÔNG TIN CÁ NHÂN</h1>
        <p className="text-stone-600 text-lg">
          Quản lý thông tin tài khoản của bạn
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Avatar Section */}
        <div className="lg:col-span-1">
          <div className="border-brutal bg-white p-6 shadow-brutal">
            <h2 className="text-lg font-bold text-stone-900 uppercase mb-6 text-center">
              ẢNH ĐẠI DIỆN
            </h2>
            <AvatarUpload
              currentAvatar={profile?.avatar || null}
              onUpload={uploadUserAvatar}
              onDelete={deleteUserAvatar}
              isLoading={isLoading}
              disabled={!canEdit}
            />

            {/* Change Password Button */}
            <div className="mt-6 pt-6 border-t-2 border-stone-200">
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-stone-100 transition-colors shadow-brutal active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <KeyIcon className="w-5 h-5" />
                ĐỔI MẬT KHẨU
              </button>
            </div>
          </div>
        </div>

        {/* Profile Info Section */}
        <div className="lg:col-span-2">
          <div className="border-brutal bg-white p-6 shadow-brutal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-stone-900 uppercase">
                THÔNG TIN TÀI KHOẢN
              </h2>
              {canEdit && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-[#f59e0b] border-4 border-stone-900 font-bold text-stone-900 uppercase text-sm hover:bg-amber-400 transition-colors shadow-brutal active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  CHỈNH SỬA
                </button>
              )}
            </div>

            <div className="space-y-6">
              {/* Username - Read Only */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-stone-100 border-2 border-stone-900 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-stone-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    TÊN ĐĂNG NHẬP
                  </label>
                  <p className="text-lg font-semibold text-stone-900">
                    {profile?.username || '--'}
                  </p>
                </div>
              </div>

              {/* Email - With Change Button */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-stone-100 border-2 border-stone-900 flex items-center justify-center flex-shrink-0">
                  <EnvelopeIcon className="w-5 h-5 text-stone-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    EMAIL
                  </label>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-stone-900">
                      {profile?.email || '--'}
                    </p>
                    {canEdit && (
                      <button
                        onClick={() => setIsEmailChangeModalOpen(true)}
                        className="px-3 py-1 bg-amber-500 border-2 border-stone-900 font-bold text-stone-900 uppercase text-xs hover:bg-amber-400 transition-colors shadow-[2px_2px_0_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                      >
                        ĐỔI EMAIL
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Name - Editable for VET */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-stone-100 border-2 border-stone-900 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-stone-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    HỌ VÀ TÊN
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) =>
                        setEditForm({ ...editForm, fullName: e.target.value })
                      }
                      className="w-full px-4 py-2 border-4 border-stone-900 bg-white text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Nhập họ và tên"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-stone-900">
                      {profile?.fullName || '--'}
                    </p>
                  )}
                </div>
              </div>

              {/* Phone - Editable for VET */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-stone-100 border-2 border-stone-900 flex items-center justify-center flex-shrink-0">
                  <PhoneIcon className="w-5 h-5 text-stone-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    SỐ ĐIỆN THOẠI
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm({ ...editForm, phone: e.target.value })
                      }
                      className="w-full px-4 py-2 border-4 border-stone-900 bg-white text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Nhập số điện thoại"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-stone-900">
                      {profile?.phone || '--'}
                    </p>
                  )}
                </div>
              </div>

              {/* Role - Read Only */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-stone-100 border-2 border-stone-900 flex items-center justify-center flex-shrink-0">
                  <ShieldCheckIcon className="w-5 h-5 text-stone-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    VAI TRÒ
                  </label>
                  <span className="inline-block px-3 py-1 bg-amber-100 border-2 border-amber-500 font-bold text-amber-800 text-sm">
                    {getRoleLabel(profile?.role)}
                  </span>
                </div>
              </div>

              {/* Created Date - Read Only */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-stone-100 border-2 border-stone-900 flex items-center justify-center flex-shrink-0">
                  <CalendarDaysIcon className="w-5 h-5 text-stone-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-500 uppercase mb-1">
                    NGÀY TẠO TÀI KHOẢN
                  </label>
                  <p className="text-lg font-semibold text-stone-900">
                    {formatDate(profile?.createdAt)}
                  </p>
                </div>
              </div>

              {/* Edit Actions */}
              {isEditing && (
                <div className="flex gap-3 pt-4 border-t-2 border-stone-200">
                  <button
                    onClick={handleCancelEdit}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-white border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-stone-100 transition-colors shadow-brutal active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
                  >
                    HỦY
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-[#f59e0b] border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-amber-400 transition-colors shadow-brutal active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
                  >
                    {isLoading ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
                  </button>
                </div>
              )}

              {/* Notice for non-editable roles */}
              {!canEdit && (
                <div className="mt-4 p-4 bg-stone-100 border-2 border-stone-300">
                  <p className="text-sm text-stone-600">
                    Thông tin cá nhân của bạn được quản lý bởi hệ thống. Vui lòng
                    liên hệ quản trị viên nếu cần thay đổi.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSubmit={changeUserPassword}
        isLoading={isLoading}
      />

      {/* Email Change Modal */}
      <EmailChangeModal
        isOpen={isEmailChangeModalOpen}
        onClose={() => setIsEmailChangeModalOpen(false)}
        onSuccess={() => {
          setIsEmailChangeModalOpen(false)
          fetchProfile()
          showToast('success', 'Đổi email thành công')
        }}
        isLoading={isLoading}
      />
    </div>
  )
}

export default ProfilePage
