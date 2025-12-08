import { Link, Outlet } from 'react-router-dom'
import { env } from '../config/env'

export function AuthLayout() {
  return (
    <div className="layout layout--auth">
      <div className="layout__panel">
        <Link to="/" className="layout__brand">
          {env.APP_NAME}
        </Link>
        <p>Trang đăng nhập/đăng ký đơn giản cho bản initial.</p>
      </div>
      <div className="layout__content">
        <Outlet />
      </div>
    </div>
  )
}

