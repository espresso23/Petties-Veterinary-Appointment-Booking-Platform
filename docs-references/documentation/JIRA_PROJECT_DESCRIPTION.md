# 🐾 Petties – Jira README

## 1. Mục tiêu dự án
- **Mô tả ngắn**: **Petties** là hệ sinh thái quản lý và đặt lịch khám thú y toàn diện (**Clinic-Centric**), kết nối **Chủ pet** và các **Phòng khám** chuyên nghiệp. Hệ thống tối ưu hóa quy trình vận hành từ điều phối nhân viên, quản lý hồ sơ bệnh án điện tử (EMR) đến tư vấn AI chuyên sâu.
- **Phạm vi**:
  - **Web App**: Dành cho Clinic Manager, Clinic Owner, Admin (Quản trị hệ thống).
  - **Mobile App**: Dành cho Pet Owner (Chủ nuôi) và Staff (Nhân viên thú y).
  - **AI Agent Service**: Dịch vụ hỗ trợ tư vấn và đặt lịch thông minh.

## 2. Tổ chức issue
- **Issue types dùng**: Epic, Story, Task, Bug, Sub-task.
- **Quy ước đặt tên**:
  - `Epic`: [EPIC] Tên Epic (Ví dụ: [EPIC] Booking Flow)
  - `Story`/`Task`: [Module] Mô tả ngắn (Ví dụ: [Booking] API Confirm Booking)
  - `Bug`: [BUG][Module] Mô tả lỗi (Ví dụ: [BUG][Auth] Lỗi login vòng lặp)

## 3. Workflow
- **Các trạng thái chính**: `To Do` → `In Progress` → `In Review` → `Ready for QA` → `In QA` → `Done`.
- **Quy tắc**:
  - **To Do** → **In Progress**: Dev nhận task, đã hiểu rõ yêu cầu và bắt đầu code.
  - **In Progress** → **In Review**: Dev hoàn thành code, tạo Pull Request (PR) và assign Reviewer.
  - **In Review** → **Ready for QA**: Code đã được approve và merge vào nhánh chính (develop/staging).
  - **Ready for QA** → **In QA** → **Done**: QA thực hiện test trên môi trường staging. Nếu đạt yêu cầu (Pass) -> Done.

## 4. Mẫu mô tả issue

### 4.1. Story/Task
**Title**: [`Module`] `Mô tả ngắn gọn chức năng`

**Description**:
- **Bối cảnh**: (Tại sao cần làm task này? Ví dụ: Để user có thể xem lịch sử khám)
- **Mục tiêu**: (Kết quả mong muốn cuối cùng)
- **Phạm vi**:
    - **In scope**: (Những gì CẦN làm)
    - **Out of scope**: (Những gì KHÔNG làm trong task này)

**Acceptance Criteria**:
- [ ] Chức năng hoạt động đúng theo SRS section X.X
- [ ] UI đúng với Design Figma
- [ ] Đã viết Unit Test (nếu là Backend)
- [ ] Pass các case Happy/Rainy flow

### 4.2. Bug
**Title**: [BUG][`Module`] `Mô tả lỗi ngắn gọn`

**Steps to Reproduce**:
1. Đăng nhập vào app với role [Role]
2. Vào màn hình [Tên màn hình]
3. Click vào nút [Tên nút]
4. ...

**Expected result**:
- Hệ thống phải hiển thị thông báo thành công / Chuyển trang...

**Actual result**:
- Hệ thống báo lỗi 500 / Màn hình trắng / Không phản hồi...

**Env**:
- **Env**: (Local vs Dev vs Staging)
- **Device**: (Nếu là Mobile: Android/iOS, Dòng máy)
- **Version/Build**: (Ví dụ: Sprint 10 build 32)
- **Logs/Screenshots**: (Đính kèm ảnh/video hoặc log lỗi)

## 5. Quy ước Priority & Labels
- **Priority**:
  - `🔴 Blocker`: Hệ thống sập, không thể build, flow chính bị chặn hoàn toàn.
  - `🟠 High`: Ảnh hưởng đến tính năng chính (Core Features) hoặc khách hàng quan trọng.
  - `🟡 Medium`: Lỗi chức năng phụ, hoặc có workaround (cách đi đường vòng).
  - `🟢 Low`: Lỗi giao diện nhỏ (typo, màu sắc), enhancement nhỏ.
- **Labels**:
  - **Team**: `backend`, `frontend`, `mobile`, `ai-agent`, `devops`
  - **Type**: `feature`, `improvement`, `refactor`, `hotfix`
  - **Module**: `auth`, `booking`, `pet`, `vet-shift`, `payment`

## 6. Liên kết tài liệu
- **Product Spec (SRS)**: [Link to SRS/Wiki]
- **API Documentation**: [Link to Swagger/Postman]
- **Design (Figma)**: [Link to Figma Board]
- **Source Code**:
  - Backend: `/backend-spring`
  - Frontend: `/petties-web`
  - Mobile: `/petties_mobile`
- **Environments**:
  - **Dev/Staging**: https://dev.petties.world
  - **Production**: (TBD)
