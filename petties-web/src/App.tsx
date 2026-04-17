import { Suspense, lazy, type ComponentType, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { useAuthStore } from './store/authStore'
import { MainLayout } from './layouts/MainLayout'
import { AuthLayout } from './layouts/AuthLayout'
import OnboardingPage from './pages/onboarding/OnboardingPage'
import { HomePage } from './pages/home/HomePage'
import PetHealthRecordPage from './pages/home/PetHealthRecordPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'

// Styles
import './styles/global.css'

const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const StaffLayout = lazy(() => import('./layouts/StaffLayout'))
const ClinicOwnerLayout = lazy(() => import('./layouts/ClinicOwnerLayout'))
const ClinicManagerLayout = lazy(() => import('./layouts/ClinicManagerLayout'))

const AdminDashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const AdminNotificationsPage = lazy(() => import('./pages/admin/NotificationsPage'))
const AdminNotificationsManagePage = lazy(() => import('./pages/admin/AdminNotificationsManagePage'))
// const ReportReasonManagePage = lazy(() => import('./pages/admin/ReportReasonManagePage'))
const ToolsPage = lazy(() => import('./pages/admin/tools/ToolsPage'))
const KnowledgePage = lazy(() => import('./pages/admin/knowledge/KnowledgePage'))
const PlaygroundPage = lazy(() => import('./pages/admin/playground/PlaygroundPage'))
const AIInsightsPage = lazy(() => import('./pages/admin/insights/AIInsightsPage'))
const SystemLogsPage = lazy(() => import('./pages/admin/logs/SystemLogsPage'))
const ClinicApprovalPage = lazy(() => import('./pages/admin/clinics/ClinicApprovalPage'))
const ClinicRegistryPage = lazy(() => import('./pages/admin/clinics/ClinicRegistryPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminReportsPage = lazyNamed(() => import('./pages/admin/ReportsPage'), 'ReportsPage')
const AdminRefundApplicationsPage = lazyNamed(
  () => import('./pages/admin/refunds/AdminRefundApplicationsPage'),
  'AdminRefundApplicationsPage',
)
const AdminVoucherPage = lazy(() => import('./pages/admin/vouchers/AdminVoucherPage'))
const AdminSubscriptionListPage = lazyNamed(
  () => import('./pages/admin/subscriptions/SubscriptionListPage'),
  'SubscriptionListPage',
)
const AdminSubscriptionHistoryPage = lazyNamed(
  () => import('./pages/admin/subscriptions/UserSubscriptionHistoryPage'),
  'UserSubscriptionHistoryPage',
)

const StaffDashboardPage = lazy(() => import('./pages/staff/DashboardPage'))
const StaffSchedulePage = lazy(() => import('./pages/staff/StaffSchedulePage'))
const StaffBookingsPage = lazy(() => import('./pages/staff/StaffBookingsPage'))
const StaffPatientsPage = lazy(() => import('./pages/staff/patients/StaffPatientsPage'))
const StaffNotificationsPage = lazy(() => import('./pages/staff/NotificationsPage'))
const CreateEmrPage = lazy(() => import('./pages/staff/emr/CreateEmrPage'))
const EditEmrPage = lazyNamed(() => import('./pages/staff/emr/EditEmrPage'), 'EditEmrPage')
const EmrDetailPage = lazy(() => import('./pages/staff/emr/EmrDetailPage'))
const VaccinationPage = lazy(() => import('./pages/staff/vaccine/VaccinationPage'))

const ClinicOwnerDashboardPage = lazy(() => import('./pages/clinic-owner/DashboardPage'))
const ServicesPage = lazyNamed(() => import('./pages/clinic-owner/ServicesPage'), 'ServicesPage')
const ClinicOwnerNotificationsPage = lazy(() => import('./pages/clinic-owner/NotificationsPage'))
const MasterServicesPage = lazyNamed(
  () => import('./pages/clinic-owner/MasterServicesPage'),
  'MasterServicesPage',
)
const ClinicOwnerRevenuePage = lazy(() => import('./pages/clinic-owner/RevenuePage'))
const MySubscriptionPage = lazyNamed(
  () => import('./pages/clinic-owner/subscriptions/MySubscriptionPage'),
  'MySubscriptionPage',
)

const ClinicManagerDashboardPage = lazy(() => import('./pages/clinic-manager/DashboardPage'))
const ClinicManagerChatPage = lazy(() => import('./pages/clinic-manager/ChatPage'))
const ManagerClinicInfoPage = lazyNamed(
  () => import('./pages/clinic-manager/clinic/ClinicInfoPage'),
  'ClinicInfoPage',
)
const ManagerClinicEditPage = lazyNamed(
  () => import('./pages/clinic-manager/clinic/ClinicEditPage'),
  'ClinicEditPage',
)
const RevenuePage = lazy(() => import('./pages/clinic-manager/RevenuePage'))
const ClinicManagerNotificationsPage = lazy(() => import('./pages/clinic-manager/NotificationsPage'))
const ClinicManagerStaffPage = lazy(() => import('./pages/clinic-manager/staff/StaffManagementPage'))
const StaffShiftPage = lazy(() => import('./pages/clinic-manager/shifts/StaffShiftPage'))
const BookingDashboardPage = lazy(() => import('./pages/clinic-manager/bookings/BookingDashboardPage'))
const ServicesViewPage = lazy(() => import('./pages/clinic-manager/services/ServicesViewPage'))
const RefundsPage = lazy(() => import('./pages/clinic-manager/RefundsPage'))
const ClinicManagerVoucherPage = lazy(() => import('./pages/clinic-manager/vouchers/ClinicManagerVoucherPage'))

const ClinicsListPage = lazyNamed(
  () => import('./pages/clinic-owner/clinics/ClinicsListPage'),
  'ClinicsListPage',
)
const ClinicCreatePage = lazyNamed(
  () => import('./pages/clinic-owner/clinics/ClinicCreatePage'),
  'ClinicCreatePage',
)
const ClinicEditPage = lazyNamed(
  () => import('./pages/clinic-owner/clinics/ClinicEditPage'),
  'ClinicEditPage',
)
const ClinicDetailPage = lazyNamed(
  () => import('./pages/clinic-owner/clinics/ClinicDetailPage'),
  'ClinicDetailPage',
)
const StaffManagementPage = lazy(() => import('./pages/clinic-owner/staff/StaffManagementPage'))
const ProfilePage = lazy(() => import('./pages/shared/ProfilePage'))

type LazyModule = Record<string, unknown>

function lazyNamed<TModule extends LazyModule, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(async () => {
    const module = await loader()
    return {
      default: module[exportName] as ComponentType<unknown>,
    }
  })
}

function AppRouteFallback() {
  return (
    <div className="min-h-screen bg-stone-50 p-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl border-2 border-stone-900 bg-white p-6 shadow-[4px_4px_0_#1c1917]">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          <div>
            <p className="text-xs font-bold uppercase text-stone-500">Đang tải</p>
            <p className="text-sm font-medium text-stone-700">Vui lòng đợi trong giây lát</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const { initializeAuth } = useAuthStore()

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<AppRouteFallback />}>
          <Routes>
            <Route path="/" element={<OnboardingPage />} />

            <Route element={<AuthLayout />}>
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/home/pets/:petId/health-record" element={<PetHealthRecordPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="knowledge" element={<KnowledgePage />} />
              <Route path="tools" element={<ToolsPage />} />
              <Route path="playground" element={<PlaygroundPage />} />
              <Route path="ai-insights" element={<AIInsightsPage />} />
              <Route path="system-logs" element={<SystemLogsPage />} />
              <Route path="clinics" element={<ClinicApprovalPage />} />
              <Route path="clinics/registry" element={<ClinicRegistryPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="refunds" element={<AdminRefundApplicationsPage />} />
              <Route path="vouchers" element={<AdminVoucherPage />} />
              <Route path="subscriptions" element={<AdminSubscriptionListPage />} />
              <Route path="subscriptions/history" element={<AdminSubscriptionHistoryPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="notification-manage" element={<AdminNotificationsManagePage />} />
              {/* <Route path="report-reason-manage" element={<ReportReasonManagePage />} /> */}
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<StaffDashboardPage />} />
              <Route path="schedule" element={<StaffSchedulePage />} />
              <Route path="bookings" element={<StaffBookingsPage />} />
              <Route path="patients" element={<StaffPatientsPage />} />
              <Route path="notifications" element={<StaffNotificationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="emr/create/:petId" element={<CreateEmrPage />} />
              <Route path="emr/edit/:emrId" element={<EditEmrPage />} />
              <Route path="emr/detail/:emrId" element={<EmrDetailPage />} />
              <Route path="patients/:petId/vaccinations" element={<VaccinationPage />} />
            </Route>

            <Route
              path="/clinic-owner"
              element={
                <ProtectedRoute allowedRoles={['CLINIC_OWNER']}>
                  <ClinicOwnerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClinicOwnerDashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="clinics" element={<ClinicsListPage />} />
              <Route path="clinics/new" element={<ClinicCreatePage />} />
              <Route path="clinics/:clinicId" element={<ClinicDetailPage />} />
              <Route path="clinics/:clinicId/edit" element={<ClinicEditPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="staff" element={<StaffManagementPage />} />
              <Route path="notifications" element={<ClinicOwnerNotificationsPage />} />
              <Route path="master-services" element={<MasterServicesPage />} />
              <Route path="revenue" element={<ClinicOwnerRevenuePage />} />
              <Route path="subscriptions" element={<MySubscriptionPage />} />
            </Route>

            <Route
              path="/clinic-manager"
              element={
                <ProtectedRoute allowedRoles={['CLINIC_MANAGER']}>
                  <ClinicManagerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClinicManagerDashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="bookings" element={<BookingDashboardPage />} />
              <Route path="staff" element={<ClinicManagerStaffPage />} />
              <Route path="shifts" element={<StaffShiftPage />} />
              <Route path="services" element={<ServicesViewPage />} />
              <Route path="chat" element={<ClinicManagerChatPage />} />
              <Route path="refunds" element={<RefundsPage />} />
              <Route path="revenue" element={<RevenuePage />} />
              <Route path="notifications" element={<ClinicManagerNotificationsPage />} />
              <Route path="clinic" element={<ManagerClinicInfoPage />} />
              <Route path="clinic/edit" element={<ManagerClinicEditPage />} />
              <Route path="vouchers" element={<ClinicManagerVoucherPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App
