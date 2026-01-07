import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { ToastProvider } from './components/Toast'

// Layouts
import { MainLayout } from './layouts/MainLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { VetLayout } from './layouts/VetLayout'
import { ClinicOwnerLayout } from './layouts/ClinicOwnerLayout'
import { ClinicManagerLayout } from './layouts/ClinicManagerLayout'

// Pages
import { OnboardingPage } from './pages/onboarding'
import { HomePage } from './pages/home/HomePage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'

// Admin Pages
import { AdminDashboardPage } from './pages/admin/DashboardPage'
import { NotificationsPage as AdminNotificationsPage } from './pages/admin/NotificationsPage'
import { ToolsPage } from './pages/admin/tools'
import { KnowledgePage } from './pages/admin/knowledge'
import { PlaygroundPage } from './pages/admin/playground'
import { ClinicApprovalPage } from './pages/admin/clinics'

// Role-specific Pages
// Role-specific Pages
import { VetDashboardPage, VetSchedulePage } from './pages/vet'
import { NotificationsPage as VetNotificationsPage } from './pages/vet/NotificationsPage'
import { ClinicOwnerDashboardPage, ServicesPage, NotificationsPage, MasterServicesPage } from './pages/clinic-owner'
import { ClinicManagerDashboardPage } from './pages/clinic-manager/DashboardPage'
import { NotificationsPage as ClinicManagerNotificationsPage } from './pages/clinic-manager/NotificationsPage'
import {
  ClinicsListPage,
  ClinicCreatePage,
  ClinicEditPage,
  ClinicDetailPage,
} from './pages/clinic-owner/clinics'
import { StaffManagementPage } from './pages/clinic-owner/staff'
import { VetsManagementPage } from './pages/clinic-manager/vets'
import { VetShiftPage } from './pages/clinic-manager/shifts/VetShiftPage'

// Shared Pages
import { ProfilePage } from './pages/shared'

// Components
import { ProtectedRoute } from './components/common/ProtectedRoute'

// Styles
import './styles/global.css'

function App() {
  const { initializeAuth } = useAuthStore()

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<OnboardingPage />} />

          {/* Auth Routes - uses Outlet */}
          <Route element={<AuthLayout />}>
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Home (after login) - uses Outlet */}
          <Route element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route path="/home" element={<HomePage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboardPage />} />

            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="tools" element={<ToolsPage />} />
            <Route path="playground" element={<PlaygroundPage />} />
            <Route path="clinics" element={<ClinicApprovalPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route >

          {/* Vet Routes */}
          < Route path="/vet" element={
            < ProtectedRoute allowedRoles={['VET']} >
              <VetLayout />
            </ProtectedRoute >
          }>
            <Route index element={<VetDashboardPage />} />
            <Route path="schedule" element={<VetSchedulePage />} />
            <Route path="notifications" element={<VetNotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route >

          {/* Clinic Owner Routes */}
          < Route path="/clinic-owner" element={
            < ProtectedRoute allowedRoles={['CLINIC_OWNER']} >
              <ClinicOwnerLayout />
            </ProtectedRoute >
          }>
            <Route index element={<ClinicOwnerDashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="clinics" element={<ClinicsListPage />} />
            <Route path="clinics/new" element={<ClinicCreatePage />} />
            <Route path="clinics/:clinicId" element={<ClinicDetailPage />} />
            <Route path="clinics/:clinicId/edit" element={<ClinicEditPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="staff" element={<StaffManagementPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="master-services" element={<MasterServicesPage />} />
          </Route >
          {/* Clinic Manager Routes */}
          < Route path="/clinic-manager" element={
            < ProtectedRoute allowedRoles={['CLINIC_MANAGER']} >
              <ClinicManagerLayout />
            </ProtectedRoute >
          }>
            <Route index element={<ClinicManagerDashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="vets" element={<VetsManagementPage />} />
            <Route path="shifts" element={<VetShiftPage />} />
            <Route path="notifications" element={<ClinicManagerNotificationsPage />} />
          </Route >
        </Routes >
      </BrowserRouter >
    </ToastProvider >
  )
}

export default App

