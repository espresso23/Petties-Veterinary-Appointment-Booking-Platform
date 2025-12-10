# 📚 PETTIES Documentation

Tài liệu tham khảo được tổ chức theo từng nhóm nội dung để dễ dàng tìm kiếm và quản lý.

## 📁 Cấu trúc Folder

### 🛠️ Setup (`/setup`)
Các hướng dẫn setup môi trường và cấu hình ban đầu:
- `SETUP_GUIDE.md` - Hướng dẫn setup chi tiết cho Development và Production
- `ENVIRONMENT_SETUP_GUIDE.md` - Hướng dẫn cấu hình môi trường (Local & Production)

### 🚀 Deployment (`/deployment`)
Các hướng dẫn về deployment và cấu hình production:
- `EC2_PRODUCTION_DEPLOYMENT.md` - Hướng dẫn chi tiết deploy Backend và AI Service lên AWS EC2
- `VERCEL_PRODUCTION_SETUP.md` - Hướng dẫn cấu hình Environment Variables trên Vercel cho Frontend Production

### 🏗️ Infrastructure (`/infrastructure`)
Cấu hình infrastructure, server, và network:
- `NGINX_WEBSOCKET_CONFIG.md` - Cấu hình Nginx reverse proxy và WebSocket cho EC2

### 💻 Development (`/development`)
Workflow, best practices, và hướng dẫn phát triển:
- `DEVELOPMENT_WORKFLOW.md` - Workflow phát triển
- `FRONTEND_BEST_PRACTICES.md` - Best practices cho Frontend development
- `PETTIES_Git_Workflow_TEAM_GUIDE.md` - Hướng dẫn Git workflow cho team

### 📖 Reference (`/reference`)
Quick reference, commands, và cheat sheets:
- `COMMANDS.md` - Danh sách commands thường dùng

### 📋 Documentation (`/documentation`)
Technical documentation, features, và architecture:
- `PETTIES_Features.md` - Danh sách features của hệ thống
- `TECHNICAL SCOPE PETTIES - AGENT MANAGEMENT.md` - Technical scope về Agent Management
- `SP26_Petties_Capstone.md` - Tài liệu Capstone project

### 🎨 Design (`/design`)
Design guides và style guidelines:
- `design-style-guide.md` - Design system và style guide

## 🔍 Cách sử dụng

### Khi cần setup môi trường mới
→ Xem folder `/setup`

### Khi cần deploy lên production
→ Xem folder `/deployment`
  - **Backend & AI Service**: `EC2_PRODUCTION_DEPLOYMENT.md`
  - **Frontend (Vercel)**: `VERCEL_PRODUCTION_SETUP.md`

### Khi cần config server/infrastructure
→ Xem folder `/infrastructure`

### Khi cần hiểu về workflow và best practices
→ Xem folder `/development`

### Khi cần tra cứu commands nhanh
→ Xem folder `/reference`

### Khi cần hiểu về features và architecture
→ Xem folder `/documentation`

### Khi cần hướng dẫn về design
→ Xem folder `/design`

## 📝 Ghi chú

- Tất cả tài liệu sử dụng Markdown format
- Các file được đặt tên theo convention: `UPPERCASE_DESCRIPTION.md`
- Khi thêm file mới, đặt vào folder phù hợp với nội dung
- Cập nhật README này nếu có thay đổi cấu trúc

