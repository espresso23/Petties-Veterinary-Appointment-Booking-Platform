import axiosClient from "./client";

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}

export interface UserParams {
  role?: string;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  size?: number;
}

export interface AdminUserSummary {
  userId: string;
  username: string;
  fullName?: string | null;
  email?: string | null;
  role: string;
  createdAt: string;
}

export interface AdminNotificationRequest {
  title: string;
  message: string;
  type: string;
  targetAudience: "ALL" | "ROLE" | "SPECIFIC_USERS";
  targetRoles?: string[];
  targetUserIds?: string[];
}

export interface SystemNotificationResponse {
  id: string;
  title: string;
  message: string;
  type: string;
  targetAudience: string;
  targetCount: number;
  createdBy: string;
  createdAt: string;
}

export const adminNotificationService = {
  create: (data: AdminNotificationRequest) => {
    return axiosClient.post("/admin/notifications", data);
  },

  getAll: (page: number = 0, size: number = 10) => {
    return axiosClient.get<{ data: PageResponse<SystemNotificationResponse> }>("/admin/notifications", {
      params: { page, size },
    });
  },

  delete: (id: string) => {
    return axiosClient.delete(`/admin/notifications/${id}`);
  },

  searchUsers: (params: UserParams) => {
    return axiosClient.get<{ data: { content: AdminUserSummary[]; totalPages: number; totalElements: number } }>("/admin/users", { params });
  },
};
