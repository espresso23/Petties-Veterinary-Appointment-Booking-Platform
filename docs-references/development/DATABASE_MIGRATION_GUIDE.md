# 🗄️ Database Migration Guide (Backend & AI)

Tài liệu này hướng dẫn cách quản lý và cập nhật cấu trúc Database (Schema) cho dự án Petties, đảm bảo tính đồng bộ và an toàn giữa hai hệ thống: **Spring Boot (Flyway)** và **FastAPI (Alembic)**.

---

## 🏗️ Chiến Lược Chung: Migration-First
Dự án áp dụng mô hình **Migration-First** trên tất cả môi trường (Dev, Test, Prod):
*   **Hibernate/SQLAlchemy:** KHÔNG tự động tạo/sửa bảng (`ddl-auto=validate`).
*   **Source of Truth:** Mọi thay đổi cấu trúc DB phải được định nghĩa bằng các file Migration script.
*   **Shared Database:** Cả hai service dùng chung 1 Database PostgreSQL nhưng quản lý các bộ bảng (tables) riêng biệt.

---

## 1. Backend Spring Boot (Flyway)

Quản lý các thực thể nghiệp vụ: `users`, `clinics`, `pets`, `bookings`, v.v.

### 📁 Thư mục lưu trữ
`backend-spring/petties/src/main/resources/db/migration/`

### 🚀 Quy trình cập nhật
1.  **Tạo Script:** Tạo file SQL mới với định dạng `V<Số_Phiên_Bản>__<tên_mô_tả>.sql`.
    *   Ví dụ: `V3__add_phone_to_users.sql`
2.  **Áp dụng:** Flyway sẽ tự động chạy script này khi ứng dụng khởi động.
3.  **Kiểm tra:** Trạng thái migration được lưu trong bảng `flyway_schema_history`.

---

## 2. AI Agent Service (Alembic)

Quản lý các thực thể AI: `agents`, `tools`, `chat_sessions`, `knowledge_documents`, v.v.

### 📁 Thư mục lưu trữ
`petties-agent-serivce/app/db/postgres/migrations/versions/`

### 🚀 Quy trình cập nhật (Dùng Dev Container)
1.  **Tự động tạo Script (Autogenerate):** Sau khi sửa file `models.py`, chạy lệnh:
    ```bash
    alembic revision --autogenerate -m "mô tả thay đổi"
    ```
2.  **Kiểm tra:** Mở file mới tạo trong thư mục `versions` để rà soát code Python/SQL.
3.  **Áp dụng:**
    *   **Thủ công (Dev):** `alembic upgrade head`
    *   **Tự động (Test/Prod):** Service sẽ tự động chạy migration khi khởi động (đã tích hợp trong `session.py`).

---

## 🛡️ Cơ Chế Chống Xung Đột (No Overlap)

Để đảm bảo service này không xóa nhầm bảng của service kia, chúng tôi đã cấu hình:

### Dynamic Allowlist (Alembic)
Trong `env.py` của AI Service, hàm `include_object` đã được tinh chỉnh để:
*   Chỉ quản lý các bảng được định nghĩa trong `app.db.postgres.models.Base`.
*   Bỏ qua hoàn toàn các bảng nghiệp vụ của Spring Boot.
*   Chỉ tác động đến bảng `alembic_version`.

### Hibernate Validation
Trên môi trường Dev/Test, `spring.jpa.hibernate.ddl-auto` được đặt là `validate`. Nếu bạn thêm trường vào Code Java mà quên tạo file Flyway, App sẽ báo lỗi ngay lập tức thay vì tự ý sửa DB làm hỏng cấu trúc.

## 🛡️ Cơ Chế An Toàn & Nhận Nuôi Database Cũ (Adoption)

Quy trình này được thiết kế để triển khai an toàn lên các môi trường đã có sẵn dữ liệu (`develop`, `main`):

### Chống Mất Dữ Liệu
*   Sử dụng `spring.jpa.hibernate.ddl-auto=validate`. Hibernate sẽ **chỉ đọc** để kiểm tra, tuyệt đối không sửa hay xóa dữ liệu.

### Xử Lý Bảng Đã Tồn Tại
1.  **Flyway (Java):** Đã bật `baseline-on-migrate=true`. Nếu thấy database đã có bảng, Flyway sẽ tự động coi đó là điểm bắt đầu (Version 1) và không chạy lại các script cũ.
2.  **Alembic (AI):** Đã tích hợp logic **Auto-Stamp** trong `session.py`. Nếu phát hiện đã có bảng AI nhưng chưa có lịch sử migration, hệ thống sẽ tự động đánh dấu (stamp) phiên bản hiện tại là "Head" mà không cố gắng chạy lệnh `CREATE TABLE`, tránh lỗi xung đột.

---

## 🔧 Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
| :--- | :--- | :--- |
| **Flyway Checksum Error** | File SQL đã bị sửa đổi sau khi đã chạy migration. | Tuyệt đối không sửa file SQL cũ. Tạo file version mới (V+1). |
| **Alembic Target Table Not Found** | Đường dẫn `alembic.ini` hoặc PYTHONPATH sai. | Chạy lệnh từ thư mục `petties-agent-serivce`. |
| **Conflict Table Name** | Đặt tên bảng trùng giữa 2 service. | Kiểm tra danh sách bảng hiện có trước khi đặt tên mới. |

---
*Cập nhật lần cuối: 29/12/2025*
