import { Link, NavLink, Outlet } from 'react-router-dom'
import { env } from '../config/env'
import { useAuthStore } from '../store/authStore'
import { logout } from '../services/endpoints/auth'

export function MainLayout() {
  const { isAuthenticated, user } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/'
  }

  return (
    <div className="layout layout--main">
      <header className="layout__header">
        <Link to="/" className="layout__brand">
          {env.APP_NAME}
        </Link>
        <nav className="layout__nav">
          <NavLink to="/" end>
            Trang chủ
          </NavLink>
          {isAuthenticated && user ? (
            <>
              <span style={{ color: '#0369a1', fontWeight: 500 }}>
                👤 {user.username} ({user.role})
              </span>
              <button 
                onClick={handleLogout}
                className="btn btn--ghost"
                style={{ 
                  border: '1px solid rgba(15, 23, 42, 0.2)',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer'
                }}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <NavLink to="/auth/login">Đăng nhập</NavLink>
          )}
        </nav>
      </header>

      <main className="layout__content">
        <Outlet />
      </main>

      <footer className="layout__footer">
        <small>© {new Date().getFullYear()} Petties Team</small>
      </footer>
    </div>
  )
}

