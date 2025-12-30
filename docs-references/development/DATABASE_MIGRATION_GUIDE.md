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
1.  **Tạo Script:** Tạo file SQL mới với định dạng `V<Timestamp>__<tên_mô_tả>.sql`.
    *   **Sai:** `V2__add_phone.sql` (Dễ trùng nếu 2 người cùng làm).
    *   **Đúng:** `V202412301030__add_phone_to_users.sql` (Định dạng: V + NămThángNgàyGiờPhút).
2.  **Lưu ý:** Giữa Version và Mô tả phải có **2 dấu gạch dưới** (`__`).
3.  **Áp dụng:** Flyway sẽ tự động chạy script này khi ứng dụng khởi động.
4.  **Kiểm tra:** Trạng thái migration được lưu trong bảng `flyway_schema_history`.

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
    *Lưu ý: Alembic dùng mã Hash ID duy nhất nên không lo trùng tên file.*
2.  **Xử lý xung đột (Multiple Heads):** 
    Nếu khi merge code bạn thấy báo lỗi "Multiple heads present", hãy dùng lệnh sau để gộp nhánh:
    ```bash
    alembic merge heads -m "merge multiple heads"
    ```
3.  **Kiểm tra:** Mở file mới tạo trong thư mục `versions` để rà soát code Python/SQL.
4.  **Áp dụng:**
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

## � Ví dụ thực tế: Thêm một Entity mới

### Trường hợp 1: Thêm bảng `Booking` ở Backend (Java)
1.  **Viết Code:** Bạn tạo Class `@Entity Booking`.
2.  **Khởi động App:** App sẽ **báo lỗi (Crash)** ngay lập tức vì chế độ `validate` thấy DB chưa có bảng `Booking`.
3.  **Viết Migration:** Bạn tạo file SQL mới (VD: `V202412301100__create_table_booking.sql`) trong thư mục migration.
4.  **Chạy lại App:** Flyway tự chạy script -> DB cập nhật -> App khởi động thành công.

### Trường hợp 2: Thêm bảng `Booking` ở AI Service (Python)
1.  **Viết Code:** Bạn định nghĩa class `Booking(Base)` trong file `models.py`.
2.  **Gen Migration:** Chạy lệnh `alembic revision --autogenerate -m "Add booking table"`.
3.  **Áp dụng:** Khi bạn khởi động App, logic trong `session.py` sẽ tự động gọi Alembic để tạo bảng mới trong Database.

---

## �🔧 Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
| :--- | :--- | :--- |
| **Flyway Checksum Error** | File SQL đã bị sửa đổi sau khi đã chạy migration. | Tuyệt đối không sửa file SQL cũ. Tạo file version mới (V+1). |
| **Alembic Target Table Not Found** | Đường dẫn `alembic.ini` hoặc PYTHONPATH sai. | Chạy lệnh từ thư mục `petties-agent-serivce`. |
| **Conflict Table Name** | Đặt tên bảng trùng giữa 2 service. | Kiểm tra danh sách bảng hiện có trước khi đặt tên mới. |

---
*Cập nhật lần cuối: 29/12/2025*
