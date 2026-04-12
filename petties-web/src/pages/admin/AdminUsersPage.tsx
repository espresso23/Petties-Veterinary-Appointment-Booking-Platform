import { useCallback, useEffect, useState } from 'react'
import { ConfirmModal } from '../../components/ConfirmModal'
import { useToast } from '../../components/Toast'
import { adminUserService } from '../../services/api/adminUserService'
import type { AdminStrikeStatus, AdminUserSummaryResponse } from '../../types/adminUser'
import { XMarkIcon } from '@heroicons/react/24/outline'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  CLINIC_OWNER: 'Chủ phòng khám',
  CLINIC_MANAGER: 'Quản lý phòng khám',
  STAFF: 'Nhân viên',
  PET_OWNER: 'Khách hàng',
}

function isPermanentStrike(d: string | null | undefined): boolean {
  return Boolean(d && d.startsWith('9999'))
}

function getStrikeLabel(d: string | null | undefined): string {
  if (!d) return 'Không hạn chế'
  if (isPermanentStrike(d)) return 'Vĩnh viễn'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return 'Đang hạn chế'
  return `Đến ${dt.toLocaleString('vi-VN')}`
}

const AdminUsersPage = () => {
  const { showToast } = useToast()
  const [users, setUsers] = useState<AdminUserSummaryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [role, setRole] = useState<string>('ALL')
  const [strikeStatus, setStrikeStatus] = useState<AdminStrikeStatus>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')

  const [restrictTarget, setRestrictTarget] = useState<AdminUserSummaryResponse | null>(null)
  const [restrictReason, setRestrictReason] = useState('')
  const [restrictPermanent, setRestrictPermanent] = useState(false)
  const [restrictDays, setRestrictDays] = useState('7')
  const [liftTarget, setLiftTarget] = useState<AdminUserSummaryResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminUserService.getUsers({
        role: role === 'ALL' ? undefined : role,
        strikeStatus,
        search: searchQuery || undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        page,
        size: 15,
      })
      setUsers(data.content ?? [])
      setTotalPages(data.totalPages ?? 0)
    } catch {
      showToast('error', 'Không thể tải danh sách người dùng')
    } finally {
      setLoading(false)
    }
  }, [createdFrom, createdTo, page, role, searchQuery, showToast, strikeStatus])

  useEffect(() => {
    void load()
  }, [load])

  const applyFilters = () => {
    setPage(0)
    setSearchQuery(searchInput.trim())
  }

  const resetFilters = () => {
    setRole('ALL')
    setStrikeStatus('ALL')
    setSearchInput('')
    setSearchQuery('')
    setCreatedFrom('')
    setCreatedTo('')
    setPage(0)
  }

  const handleConfirmRestrict = async () => {
    if (!restrictTarget || submitting) return
    const reason = restrictReason.trim()
    if (reason.length < 10) {
      showToast('error', 'Lý do phải ít nhất 10 ký tự')
      return
    }
    const days = Number.parseInt(restrictDays, 10)
    if (!restrictPermanent && (!Number.isFinite(days) || days < 1 || days > 3650)) {
      showToast('error', 'Số ngày hạn chế phải từ 1 đến 3650')
      return
    }

    setSubmitting(true)
    try {
      await adminUserService.restrictUser(restrictTarget.userId, {
        reason,
        isPermanent: restrictPermanent,
        days: restrictPermanent ? undefined : days,
      })
      showToast('success', 'Đã áp dụng hạn chế cho người dùng')
      setRestrictTarget(null)
      setRestrictReason('')
      setRestrictPermanent(false)
      setRestrictDays('7')
      await load()
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      showToast('error', msg ? String(msg) : 'Không thể hạn chế người dùng')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmLift = async () => {
    if (!liftTarget || submitting) return
    setSubmitting(true)
    try {
      await adminUserService.liftUserStrike(liftTarget.userId)
      showToast('success', 'Đã gỡ hạn chế người dùng')
      setLiftTarget(null)
      await load()
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      showToast('error', msg ? String(msg) : 'Không thể gỡ hạn chế')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">Quản lý người dùng</h1>
        <p className="text-stone-600 mt-1 max-w-2xl">
          Quản lý danh sách người dùng toàn hệ thống, lọc theo vai trò và trạng thái hạn chế, đồng thời áp dụng hoặc gỡ hạn chế thủ công khi cần.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
        <div className="xl:col-span-2">
          <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Vai trò</label>
          <select
            value={role}
            onChange={(e) => {
              setPage(0)
              setRole(e.target.value)
            }}
            className="w-full border-2 border-stone-900 px-3 py-2 font-bold text-sm bg-white"
          >
            <option value="ALL">Tất cả</option>
            <option value="ADMIN">Quản trị viên</option>
            <option value="CLINIC_OWNER">Chủ phòng khám</option>
            <option value="CLINIC_MANAGER">Quản lý phòng khám</option>
            <option value="STAFF">Nhân viên</option>
            <option value="PET_OWNER">Khách hàng</option>
          </select>
        </div>
        <div className="xl:col-span-2">
          <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Trạng thái hạn chế</label>
          <select
            value={strikeStatus}
            onChange={(e) => {
              setPage(0)
              setStrikeStatus(e.target.value as AdminStrikeStatus)
            }}
            className="w-full border-2 border-stone-900 px-3 py-2 font-bold text-sm bg-white"
          >
            <option value="ALL">Tất cả</option>
            <option value="ACTIVE">Đang hạn chế</option>
            <option value="NONE">Không hạn chế</option>
            <option value="PERMANENT">Vĩnh viễn</option>
          </select>
        </div>
        <div className="xl:col-span-2">
          <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Từ ngày tạo</label>
          <input
            type="date"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
            className="w-full border-2 border-stone-900 px-3 py-2 font-medium bg-white"
          />
        </div>
        <div className="xl:col-span-2">
          <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Đến ngày tạo</label>
          <input
            type="date"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
            className="w-full border-2 border-stone-900 px-3 py-2 font-medium bg-white"
          />
        </div>
        <div className="xl:col-span-4">
          <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Tìm kiếm</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="Tên đăng nhập, họ tên, email..."
              className="flex-1 border-2 border-stone-900 px-3 py-2 font-medium bg-white"
            />
            <button
              type="button"
              onClick={applyFilters}
              className="px-4 py-2 font-bold uppercase text-sm bg-amber-400 border-2 border-stone-900 shadow-[3px_3px_0_#1c1917]"
            >
              Lọc
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 font-bold uppercase text-sm bg-white border-2 border-stone-900"
            >
              Xóa
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
        <table className="w-full">
          <thead className="border-b-4 border-stone-900 bg-stone-100">
            <tr className="text-left font-bold uppercase text-xs tracking-wider">
              <th className="p-3">Người dùng</th>
              <th className="p-3">Email</th>
              <th className="p-3">Vai trò</th>
              <th className="p-3">Ngày tạo</th>
              <th className="p-3">Hạn chế</th>
              <th className="p-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-600">
                  Đang tải...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-600">
                  Không có người dùng nào
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const hasActiveStrike = Boolean(u.strikeUntil && new Date(u.strikeUntil).getTime() > Date.now())
                return (
                  <tr key={u.userId} className="border-b-2 border-stone-200 hover:bg-amber-50">
                    <td className="p-3">
                      <div className="font-bold">{u.fullName?.trim() || u.username}</div>
                      <div className="text-xs text-stone-600">@{u.username}</div>
                      <div className="text-[10px] text-stone-500 font-mono truncate max-w-[200px]">{u.userId}</div>
                    </td>
                    <td className="p-3 text-sm">{u.email || '—'}</td>
                    <td className="p-3 text-sm font-bold">{ROLE_LABEL[u.role] || u.role}</td>
                    <td className="p-3 text-sm">{new Date(u.createdAt).toLocaleString('vi-VN')}</td>
                    <td className="p-3 text-sm">{getStrikeLabel(u.strikeUntil)}</td>
                    <td className="p-3 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {!hasActiveStrike && (
                          <button
                            type="button"
                            onClick={() => {
                              setRestrictTarget(u)
                              setRestrictReason('')
                              setRestrictPermanent(false)
                              setRestrictDays('7')
                            }}
                            className="px-2 py-1 text-[10px] font-bold uppercase bg-red-500 text-white border-2 border-stone-900"
                          >
                            Hạn chế
                          </button>
                        )}
                        {hasActiveStrike && (
                          <button
                            type="button"
                            onClick={() => setLiftTarget(u)}
                            className="px-2 py-1 text-[10px] font-bold uppercase bg-mint-400 border-2 border-stone-900"
                          >
                            Gỡ hạn chế
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-4 py-2 font-bold uppercase border-2 border-stone-900 bg-white disabled:opacity-40"
          >
            Trước
          </button>
          <span className="px-4 py-2 font-bold text-stone-700">
            Trang {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="px-4 py-2 font-bold uppercase border-2 border-stone-900 bg-white disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}

      {restrictTarget && (
        <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-100 p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold uppercase">Hạn chế người dùng</h2>
              <button
                type="button"
                onClick={() => !submitting && setRestrictTarget(null)}
                className="p-1 border-2 border-stone-900"
                aria-label="Đóng"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-stone-700 mb-3">
              Người dùng: <span className="font-bold">{restrictTarget.fullName?.trim() || restrictTarget.username}</span>
            </p>
            <div className="mb-3">
              <label className="inline-flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={restrictPermanent}
                  onChange={(e) => setRestrictPermanent(e.target.checked)}
                  className="w-4 h-4 border-2 border-stone-900"
                />
                Hạn chế vĩnh viễn
              </label>
            </div>
            {!restrictPermanent && (
              <div className="mb-3">
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Số ngày hạn chế</label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={restrictDays}
                  onChange={(e) => setRestrictDays(e.target.value)}
                  className="w-full border-2 border-stone-900 p-3 font-medium text-sm"
                />
              </div>
            )}
            <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Lý do (tối thiểu 10 ký tự)</label>
            <textarea
              value={restrictReason}
              onChange={(e) => setRestrictReason(e.target.value)}
              rows={4}
              className="w-full border-4 border-stone-900 p-3 font-medium text-sm mb-4"
              placeholder="Mô tả lý do hạn chế..."
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setRestrictTarget(null)}
                className="px-4 py-2 font-bold uppercase border-2 border-stone-900 bg-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting || restrictReason.trim().length < 10}
                onClick={() => void handleConfirmRestrict()}
                className="px-4 py-2 font-bold uppercase bg-red-500 text-white border-2 border-stone-900 disabled:opacity-50"
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận hạn chế'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={liftTarget !== null}
        title="Gỡ hạn chế"
        message={
          liftTarget
            ? `Bạn có chắc muốn gỡ hạn chế cho người dùng "${liftTarget.fullName?.trim() || liftTarget.username}"?`
            : ''
        }
        confirmLabel="Gỡ hạn chế"
        cancelLabel="Hủy"
        onConfirm={() => void handleConfirmLift()}
        onCancel={() => !submitting && setLiftTarget(null)}
        isDanger={false}
      />
    </div>
  )
}

export default AdminUsersPage
