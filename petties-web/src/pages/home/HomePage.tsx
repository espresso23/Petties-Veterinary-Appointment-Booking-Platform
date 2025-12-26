import { Link } from 'react-router-dom'
import { env } from '../../config/env'
import { useAuthStore } from '../../store/authStore'

export function HomePage() {
  const { isAuthenticated, user, accessToken } = useAuthStore()

  return (
    <section className="page">
      <div className="page__content">
        <p className="page__eyebrow">Welcome to</p>
        <h1 className="page__title">{env.APP_NAME}</h1>
        
        {/* Hiển thị trạng thái đăng nhập */}
        {isAuthenticated && user ? (
          <div className="auth-status">
            <h2>Đã đăng nhập thành công!</h2>
            <div className="auth-status__details">
              <p><strong>Username:</strong> {user.username}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Role:</strong> {user.role}</p>
              <p><strong>User ID:</strong> {user.userId}</p>
              <details className="auth-status__token-preview">
                <summary>Xem Token (Debug)</summary>
                <pre className="auth-status__token-code">
                  {accessToken ? accessToken.substring(0, 50) + '...' : 'No token'}
                </pre>
              </details>
            </div>
          </div>
        ) : (
          <>
            <p className="page__subtitle">
              Đây là skeleton ban đầu để phát triển web app. Thêm component/feature mới bằng cách mở rộng các thư mục đã
              chuẩn hóa sẵn ở <code>src/</code>.
            </p>
            <div className="page__actions">
              <Link to="/auth/login" className="btn btn--primary">
                Đi tới trang đăng nhập
              </Link>
              <a className="btn btn--ghost" href="https://vitejs.dev/guide/" target="_blank" rel="noopener noreferrer">
                Xem hướng dẫn Vite
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

