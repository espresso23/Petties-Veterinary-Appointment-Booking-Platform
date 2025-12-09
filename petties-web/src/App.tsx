import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'

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

// Admin Pages
import { AdminDashboardPage } from './pages/admin/DashboardPage'
import { AgentsPage } from './pages/admin/agents'
import { ToolsPage } from './pages/admin/tools'
import { KnowledgePage } from './pages/admin/knowledge'
import { PlaygroundPage } from './pages/admin/playground'
import { SettingsPage } from './pages/admin/settings'

// Role-specific Pages
import { VetDashboardPage } from './pages/vet/DashboardPage'
import { ClinicOwnerDashboardPage } from './pages/clinic-owner/DashboardPage'
import { ClinicManagerDashboardPage } from './pages/clinic-manager/DashboardPage'

// Components
import { ProtectedRoute } from './components/ProtectedRoute'

// Styles
import './styles/global.css'

function App() {
  const { initializeAuth } = useAuthStore()

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<OnboardingPage />} />

        {/* Auth Routes - uses Outlet */}
        <Route element={<AuthLayout />}>
          <Route path="/auth/login" element={<LoginPage />} />
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
          <Route path="agents" element={<AgentsPage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Vet Routes */}
        <Route path="/vet" element={
          <ProtectedRoute allowedRoles={['VET']}>
            <VetLayout />
          </ProtectedRoute>
        }>
          <Route index element={<VetDashboardPage />} />
        </Route>

        {/* Clinic Owner Routes */}
        <Route path="/clinic-owner" element={
          <ProtectedRoute allowedRoles={['CLINIC_OWNER']}>
            <ClinicOwnerLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ClinicOwnerDashboardPage />} />
        </Route>

        {/* Clinic Manager Routes */}
        <Route path="/clinic-manager" element={
          <ProtectedRoute allowedRoles={['CLINIC_MANAGER']}>
            <ClinicManagerLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ClinicManagerDashboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
