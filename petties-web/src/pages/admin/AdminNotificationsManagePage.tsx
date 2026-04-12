import { useState, useEffect, useMemo } from "react";
import {
  CurrencyDollarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  BellIcon,
  MegaphoneIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type {
  AdminNotificationRequest,
  SystemNotificationResponse,
  AdminUserSummary,
} from "../../services/api/adminNotificationService";
import { adminNotificationService } from "../../services/api/adminNotificationService";
import { useToast } from "../../components/Toast";
import { format } from "date-fns";

const ROLES = [
  { value: "CLINIC_OWNER", label: "Chủ phòng khám" },
  { value: "CLINIC_MANAGER", label: "Quản lý phòng khám" },
  { value: "STAFF", label: "Bác sĩ / Nhân viên" },
  { value: "PET_OWNER", label: "Khách hàng" },
];

const ROLE_LABEL_MAP: Record<string, string> = {
  ADMIN: "Quản trị viên",
  CLINIC_OWNER: "Chủ phòng khám",
  CLINIC_MANAGER: "Quản lý phòng khám",
  STAFF: "Bác sĩ / Nhân viên",
  PET_OWNER: "Khách hàng",
};

const NOTIFICATION_TYPES = [
  {
    value: "SYSTEM_MONEY",
    label: "Giao dịch",
    Icon: CurrencyDollarIcon,
    iconClassName: "text-amber-700",
  },
  {
    value: "SYSTEM_SERVER",
    label: "Bảo trì",
    Icon: Cog6ToothIcon,
    iconClassName: "text-blue-700",
  },
  {
    value: "SYSTEM_TIME",
    label: "Thông tin",
    Icon: DocumentTextIcon,
    iconClassName: "text-teal-700",
  },
  {
    value: "SYSTEM_WORK",
    label: "Công việc",
    Icon: CalendarDaysIcon,
    iconClassName: "text-indigo-700",
  },
  {
    value: "SYSTEM_OTHER",
    label: "Khác",
    Icon: BellIcon,
    iconClassName: "text-stone-700",
  },
] as const;

const defaultForm: AdminNotificationRequest = {
  title: "",
  message: "",
  type: "SYSTEM_OTHER",
  targetAudience: "ALL",
  targetRoles: [],
  targetUserIds: [],
};

const AdminNotificationsManagePage = () => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<SystemNotificationResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<AdminNotificationRequest>(defaultForm);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("");
  const [historyAudienceFilter, setHistoryAudienceFilter] = useState("");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");

  const loadData = async () => {
    try {
      const res = await adminNotificationService.getAll(page, 10);
      const body = res.data?.data ?? res.data;
      setNotifications(body?.content ?? []);
      setTotalPages(body?.totalPages ?? 1);
    } catch {
      showToast("error", "Lỗi khi tải danh sách thông báo");
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (isModalOpen && form.targetAudience === "SPECIFIC_USERS" && users.length === 0) {
      void loadAllUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, form.targetAudience]);

  const loadAllUsers = async () => {
    setIsUsersLoading(true);
    try {
      let currentPage = 0;
      let total = 1;
      const collected: AdminUserSummary[] = [];

      while (currentPage < total) {
        const res = await adminNotificationService.searchUsers({ page: currentPage, size: 200 });
        const body = res.data?.data ?? res.data;
        const content = Array.isArray(body?.content) ? body.content : [];

        content.forEach((item: AdminUserSummary) => {
          if (!item?.userId) return;
          collected.push({
            userId: item.userId,
            username: item.username ?? "",
            fullName: item.fullName ?? null,
            email: item.email ?? null,
            role: item.role ?? "",
            createdAt: item.createdAt ?? "",
          });
        });

        total = body?.totalPages ?? 1;
        currentPage += 1;
      }

      const uniqueUsers = Array.from(
        new Map(collected.map((u) => [u.userId, u])).values()
      );
      setUsers(uniqueUsers);
    } catch {
      showToast("error", "Không thể tải danh sách người dùng");
    } finally {
      setIsUsersLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userRoleFilter && u.role !== userRoleFilter) return false;

      if (createdFrom) {
        const fromDate = new Date(createdFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (new Date(u.createdAt) < fromDate) return false;
      }

      if (createdTo) {
        const toDate = new Date(createdTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(u.createdAt) > toDate) return false;
      }

      if (!search) return true;
      const displayName = (u.fullName || u.username || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const roleLabel = (ROLE_LABEL_MAP[u.role] || u.role).toLowerCase();
      return displayName.includes(search) || email.includes(search) || roleLabel.includes(search);
    });
  }, [users, userSearch, userRoleFilter, createdFrom, createdTo]);

  const getTypeMeta = (type: string) => {
    return NOTIFICATION_TYPES.find((item) => item.value === type) ?? NOTIFICATION_TYPES[4];
  };

  const getAudienceLabel = (audience: string) => {
    switch (audience) {
      case "ALL":
        return "Tất cả người dùng";
      case "ROLE":
        return "Theo vai trò";
      case "SPECIFIC_USERS":
        return "Người dùng cụ thể";
      default:
        return audience;
    }
  };

  const filteredNotifications = useMemo(() => {
    const keyword = historyKeyword.trim().toLowerCase();

    return notifications.filter((item) => {
      if (historyTypeFilter && item.type !== historyTypeFilter) return false;
      if (historyAudienceFilter && item.targetAudience !== historyAudienceFilter) return false;

      if (historyFromDate) {
        const from = new Date(historyFromDate);
        from.setHours(0, 0, 0, 0);
        if (new Date(item.createdAt) < from) return false;
      }

      if (historyToDate) {
        const to = new Date(historyToDate);
        to.setHours(23, 59, 59, 999);
        if (new Date(item.createdAt) > to) return false;
      }

      if (!keyword) return true;

      const title = (item.title || "").toLowerCase();
      const message = (item.message || "").toLowerCase();
      const createdBy = (item.createdBy || "").toLowerCase();
      const typeLabel = getTypeMeta(item.type).label.toLowerCase();
      const audienceLabel = getAudienceLabel(item.targetAudience).toLowerCase();

      return (
        title.includes(keyword) ||
        message.includes(keyword) ||
        createdBy.includes(keyword) ||
        typeLabel.includes(keyword) ||
        audienceLabel.includes(keyword)
      );
    });
  }, [
    notifications,
    historyKeyword,
    historyTypeFilter,
    historyAudienceFilter,
    historyFromDate,
    historyToDate,
  ]);

  const toggleUserSelection = (userId: string, checked: boolean) => {
    setSelectedUserIds((prev) => {
      if (checked) {
        return prev.includes(userId) ? prev : [...prev, userId];
      }
      return prev.filter((id) => id !== userId);
    });
  };

  const selectAllFilteredUsers = () => {
    setSelectedUserIds((prev) => {
      const merged = new Set(prev);
      filteredUsers.forEach((u) => merged.add(u.userId));
      return Array.from(merged);
    });
  };

  const clearSelectedUsers = () => {
    setSelectedUserIds([]);
  };

  const handleFieldChange = <K extends keyof AdminNotificationRequest>(
    key: K,
    value: AdminNotificationRequest[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      showToast("warning", "Tiêu đề và nội dung không được để trống");
      return;
    }

    if (form.targetAudience === "ROLE" && (!form.targetRoles || form.targetRoles.length === 0)) {
      showToast("warning", "Vui lòng chọn ít nhất 1 vai trò nhận thông báo");
      return;
    }

    if (form.targetAudience === "SPECIFIC_USERS" && selectedUserIds.length === 0) {
      showToast("warning", "Vui lòng chọn ít nhất 1 người dùng");
      return;
    }

    const payload: AdminNotificationRequest = {
      ...form,
      targetRoles: form.targetAudience === "ROLE" ? form.targetRoles : [],
      targetUserIds: form.targetAudience === "SPECIFIC_USERS" ? selectedUserIds : [],
    };

    try {
      setIsSubmitting(true);

      if (payload.targetAudience === "ROLE" && payload.targetRoles && payload.targetRoles.length > 0) {
        await Promise.all(
          payload.targetRoles.map((role) =>
            adminNotificationService.create({
              ...payload,
              targetRoles: [role],
            })
          )
        );
        showToast("success", "Đã gửi thông báo theo từng vai trò thành công");
      } else {
        await adminNotificationService.create(payload);
        showToast("success", "Thông báo đã được gửi thành công");
      }

      setIsModalOpen(false);
      setForm(defaultForm);
      setSelectedUserIds([]);
      setUserSearch("");
      setUserRoleFilter("");
      setCreatedFrom("");
      setCreatedTo("");
      loadData();
    } catch {
      showToast("error", "Gửi thông báo thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      await adminNotificationService.delete(deleteConfirmId);
      showToast("success", "Xóa thành công");
      setDeleteConfirmId(null);
      loadData();
    } catch {
      showToast("error", "Xóa thất bại");
    }
  };

  const getIconForType = (type: string) => {
    const { Icon, iconClassName } = getTypeMeta(type);
    return <Icon className={`h-5 w-5 ${iconClassName}`} />;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "HH:mm dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gửi thông báo hệ thống</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-amber-400 hover:bg-amber-500 text-stone-900 border-2 border-stone-900 px-4 py-2 font-bold shadow-[4px_4px_0_#1c1917] transition-all hover:shadow-[2px_2px_0_#1c1917] hover:translate-x-[2px] rounded-lg flex items-center gap-2"
        >
          <MegaphoneIcon className="h-5 w-5" /> Gửi mới
        </button>
      </div>

      <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-4 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3">
          <div className="xl:col-span-4 min-w-0">
            <label className="block font-bold uppercase text-xs mb-1">Tìm kiếm</label>
            <input
              value={historyKeyword}
              onChange={(e) => setHistoryKeyword(e.target.value)}
              placeholder="Tiêu đề, nội dung, người gửi..."
              className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <label className="block font-bold uppercase text-xs mb-1">Loại thông báo</label>
            <select
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value)}
              className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
            >
              <option value="">Tất cả loại</option>
              {NOTIFICATION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="xl:col-span-2 min-w-0">
            <label className="block font-bold uppercase text-xs mb-1">Đối tượng</label>
            <select
              value={historyAudienceFilter}
              onChange={(e) => setHistoryAudienceFilter(e.target.value)}
              className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
            >
              <option value="">Tất cả đối tượng</option>
              <option value="ALL">Tất cả người dùng</option>
              <option value="ROLE">Theo vai trò</option>
              <option value="SPECIFIC_USERS">Người dùng cụ thể</option>
            </select>
          </div>

          <div className="xl:col-span-2 min-w-0">
            <label className="block font-bold uppercase text-xs mb-1">Từ ngày</label>
            <input
              type="date"
              value={historyFromDate}
              onChange={(e) => setHistoryFromDate(e.target.value)}
              className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
            />
          </div>

          <div className="xl:col-span-2 min-w-0">
            <label className="block font-bold uppercase text-xs mb-1">Đến ngày</label>
            <input
              type="date"
              value={historyToDate}
              onChange={(e) => setHistoryToDate(e.target.value)}
              className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setHistoryKeyword("");
              setHistoryTypeFilter("");
              setHistoryAudienceFilter("");
              setHistoryFromDate("");
              setHistoryToDate("");
            }}
            className="px-3 py-2 font-bold uppercase border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] hover:bg-stone-100 text-xs"
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-100 border-b-2 border-stone-900">
              <tr>
                <th className="p-4 font-bold uppercase text-stone-900 border-r-2 border-stone-900">Loại</th>
                <th className="p-4 font-bold uppercase text-stone-900 border-r-2 border-stone-900">Tiêu đề / Nội dung</th>
                <th className="p-4 font-bold uppercase text-stone-900 border-r-2 border-stone-900">Đối tượng</th>
                <th className="p-4 font-bold uppercase text-stone-900 border-r-2 border-stone-900">Người gửi</th>
                <th className="p-4 font-bold uppercase text-stone-900 border-r-2 border-stone-900">Ngày</th>
                <th className="p-4 font-bold uppercase text-stone-900">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-stone-500 font-semibold">
                    Chưa có thông báo nào được gửi
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((n) => {
                  const meta = getTypeMeta(n.type);
                  return (
                  <tr key={n.id} className="border-b-2 border-stone-900 last:border-0 hover:bg-stone-50">
                    <td className="p-4 border-r-2 border-stone-900">
                      <div className="flex items-center gap-2">
                        {getIconForType(n.type)}
                        <span className="font-semibold text-sm">{meta.label}</span>
                      </div>
                    </td>
                    <td className="p-4 border-r-2 border-stone-900 max-w-xs">
                      <p className="font-bold">{n.title}</p>
                      <p className="text-sm text-stone-600 line-clamp-2">{n.message}</p>
                    </td>
                    <td className="p-4 border-r-2 border-stone-900">
                      <span className="inline-block px-2 py-1 bg-stone-200 border-2 border-stone-900 rounded-full text-xs font-bold">
                        {getAudienceLabel(n.targetAudience)} ({n.targetCount})
                      </span>
                    </td>
                    <td className="p-4 border-r-2 border-stone-900 font-medium text-sm">{n.createdBy}</td>
                    <td className="p-4 border-r-2 border-stone-900 text-sm">{formatDate(n.createdAt)}</td>
                    <td className="p-4">
                      <button
                        onClick={() => setDeleteConfirmId(n.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Xóa thông báo"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 flex justify-between items-center bg-stone-50 border-t-2 border-stone-900">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border-2 border-stone-900 rounded-lg font-bold shadow-[2px_2px_0_#1c1917] disabled:opacity-40 uppercase text-sm"
          >
            Trang trước
          </button>
          <span className="font-bold uppercase text-sm">Trang {page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border-2 border-stone-900 rounded-lg font-bold shadow-[2px_2px_0_#1c1917] disabled:opacity-40 uppercase text-sm"
          >
            Trang sau
          </button>
        </div>
      </div>

      {/* Compose Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4">
          <div className="bg-white border-2 border-stone-900 p-6 rounded-xl shadow-[8px_8px_0_#1c1917] max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold uppercase mb-4">Soạn Thông Báo Mới</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type */}
              <div>
                <label className="block font-bold uppercase text-xs mb-1">Loại thông báo</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {NOTIFICATION_TYPES.map(({ value, label, Icon, iconClassName }) => {
                    const active = form.type === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleFieldChange("type", value)}
                        className={`border-2 border-stone-900 rounded-lg px-3 py-2 text-left shadow-[2px_2px_0_#1c1917] transition-all ${
                          active ? "bg-amber-200" : "bg-white hover:bg-stone-50"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <Icon className={`h-5 w-5 ${iconClassName}`} />
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target audience */}
              <div>
                <label className="block font-bold uppercase text-xs mb-1">Đối tượng nhận</label>
                <select
                  value={form.targetAudience}
                  onChange={(e) => {
                    const value = e.target.value as AdminNotificationRequest["targetAudience"];
                    handleFieldChange("targetAudience", value);
                    if (value !== "ROLE") {
                      handleFieldChange("targetRoles", []);
                    }
                    if (value !== "SPECIFIC_USERS") {
                      setSelectedUserIds([]);
                    }
                  }}
                  className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
                >
                  <option value="ALL">Tất cả người dùng</option>
                  <option value="ROLE">Theo vai trò (Role)</option>
                  <option value="SPECIFIC_USERS">Chỉ định người dùng cụ thể</option>
                </select>
              </div>

              {form.targetAudience === "ROLE" && (
                <div>
                  <label className="block font-bold uppercase text-xs mb-1">Chọn vai trò nhận</label>
                  <div className="space-y-2 border-2 border-stone-900 rounded-lg p-3">
                    {ROLES.map((r) => (
                      <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          value={r.value}
                          checked={(form.targetRoles ?? []).includes(r.value)}
                          onChange={(e) => {
                            const current = form.targetRoles ?? [];
                            const updated = e.target.checked
                              ? [...current, r.value]
                              : current.filter((v) => v !== r.value);
                            handleFieldChange("targetRoles", updated);
                          }}
                          className="w-4 h-4 border-2 border-stone-900"
                        />
                        <span className="text-sm font-medium">{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {form.targetAudience === "SPECIFIC_USERS" && (
                <div className="space-y-3 border-2 border-stone-900 rounded-lg p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[180px] flex-1">
                      <label className="block font-bold uppercase text-xs mb-1">Tìm theo tên / email</label>
                      <input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Nhập từ khóa"
                        className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
                      />
                    </div>
                    <div className="min-w-[180px]">
                      <label className="block font-bold uppercase text-xs mb-1">Lọc vai trò</label>
                      <select
                        value={userRoleFilter}
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                        className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
                      >
                        <option value="">Tất cả vai trò</option>
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-xs mb-1">Từ ngày tạo</label>
                      <input
                        type="date"
                        value={createdFrom}
                        onChange={(e) => setCreatedFrom(e.target.value)}
                        className="border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase text-xs mb-1">Đến ngày tạo</label>
                      <input
                        type="date"
                        value={createdTo}
                        onChange={(e) => setCreatedTo(e.target.value)}
                        className="border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-700">
                      Đã chọn: {selectedUserIds.length} người dùng
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllFilteredUsers}
                        className="px-3 py-1 border-2 border-stone-900 rounded-lg text-xs font-bold shadow-[2px_2px_0_#1c1917]"
                      >
                        Chọn tất cả đang lọc
                      </button>
                      <button
                        type="button"
                        onClick={clearSelectedUsers}
                        className="px-3 py-1 border-2 border-stone-900 rounded-lg text-xs font-bold shadow-[2px_2px_0_#1c1917] bg-stone-100"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-auto border-2 border-stone-900 rounded-lg">
                    {isUsersLoading ? (
                      <div className="p-4 text-sm text-stone-600">Đang tải danh sách người dùng...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-sm text-stone-600">Không có người dùng phù hợp bộ lọc</div>
                    ) : (
                      <ul className="divide-y-2 divide-stone-900">
                        {filteredUsers.map((u) => {
                          const checked = selectedUserIds.includes(u.userId);
                          return (
                            <li key={u.userId} className="p-3 bg-white hover:bg-stone-50">
                              <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleUserSelection(u.userId, e.target.checked)}
                                  className="w-4 h-4 border-2 border-stone-900 mt-1"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-stone-900 truncate">
                                    {u.fullName?.trim() || u.username || "Không có tên"}
                                  </p>
                                  <p className="text-xs text-stone-600 truncate">{u.email || "Không có email"}</p>
                                  <p className="text-xs text-stone-600">
                                    {ROLE_LABEL_MAP[u.role] || u.role} - Tạo lúc {formatDate(u.createdAt)}
                                  </p>
                                </div>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block font-bold uppercase text-xs mb-1">Tiêu đề</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                  required
                  className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block font-bold uppercase text-xs mb-1">Nội dung chi tiết</label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => handleFieldChange("message", e.target.value)}
                  required
                  className="w-full border-2 border-stone-900 p-2 rounded-lg shadow-[2px_2px_0_#1c1917] text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setForm(defaultForm);
                    setSelectedUserIds([]);
                    setUserSearch("");
                    setUserRoleFilter("");
                    setCreatedFrom("");
                    setCreatedTo("");
                  }}
                  className="px-4 py-2 font-bold uppercase border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] hover:bg-stone-100 text-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 font-bold uppercase border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] bg-amber-400 hover:bg-amber-500 text-stone-900 disabled:opacity-60 text-sm"
                >
                  {isSubmitting ? "Đang gửi..." : "Phát thông báo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4">
          <div className="bg-white border-2 border-stone-900 p-6 rounded-xl shadow-[8px_8px_0_#1c1917] max-w-sm w-full">
            <h2 className="text-lg font-bold uppercase mb-2">Xác nhận xóa</h2>
            <p className="text-sm text-stone-600 mb-6">
              Bạn có chắc muốn xóa lịch sử thông báo này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 font-bold uppercase border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] hover:bg-stone-100 text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 font-bold uppercase border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] bg-red-500 text-white hover:bg-red-600 text-sm"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationsManagePage;
