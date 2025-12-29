# CHIẾN LƯỢC QUẢN LÝ DATABASE & MIGRATION TRÊN ĐA MÔI TRƯỜNG

Tài liệu này hướng dẫn cách đồng bộ hóa cấu trúc dữ liệu giữa các môi trường Dev, Test, Staging và Prod cho dự án Petties, đảm bảo không xảy ra xung đột hoặc mất dữ liệu.

---

## 1. BACKEND SERVICE (JAVA - SPRING BOOT)

### Công cụ: **Flyway**
Flyway quản lý database thông qua các file script SQL có đánh số phiên bản.

#### Nguyên tắc hoạt động:
- Toàn bộ thay đổi DB (Table, Column, Index) KHÔNG được thực hiện tay. 
- Mọi thay đổi phải viết vào file `.sql` đặt tại: `src/main/resources/db/migration/`.

#### Quy tắc đặt tên file:
`V<Version>__<Description>.sql`
- **V1__init_schema.sql**: Khởi tạo cấu trúc ban đầu.
- **V2__add_phone_to_users.sql**: Thêm cột phone.
- **V3__create_emr_table.sql**: Tạo bảng mới.

#### Cấu hình theo môi trường:
| Môi trường | `hibernate.ddl-auto` | Flyway | Ghi chú |
|------------|----------------------|--------|---------|
| **Dev**    | `update`             | Enabled| Code nhanh, DB cá nhân tự do. |
| **Test**   | `create-drop`        | Enabled| Luôn bắt đầu từ DB sạch trước khi chạy test. |
| **Prod**   | **`validate`**       | Enabled| Spring sẽ kiểm tra cấu trúc DB, nếu không khớp script Flyway sẽ báo lỗi, không tự ý sửa. |

---

## 2. AI AGENT SERVICE (PYTHON - FASTAPI)

### Công cụ: **Alembic** (Cho SQL) & **Init Scripts** (Cho Vector DB)

#### Đối với Relational DB (PostgreSQL):
Dùng **Alembic** (đi kèm SQLAlchemy).
- **Lệnh tạo migration:** `alembic revision --autogenerate -m "description"`
- **Lệnh áp dụng:** `alembic upgrade head`
- Cấu trúc tương tự Flyway nhưng viết bằng Python code hoặc SQL.

#### Đối với Vector DB (Qdrant):
Vì Vector DB không có cơ chế "mũi tên phiên bản" như SQL, ta dùng chiến lược **Check-and-Init**:
- **Startup Logic:** Khi AI Service khởi động, nó gọi một script `init_collections.py`.
- **Logic:** 
  - Nếu Collection `pet_knowledge` chưa có -> Tạo mới + Indexing.
  - Nếu đã có -> Bỏ qua.
- **Môi trường Prod:** Dùng Alias (bí danh). Tạo collection `pet_knowledge_v2`, sau khi xong thì trỏ alias `pet_knowledge` sang bản mới để không bị downtime.

---

## 3. QUY TRÌNH ĐƯA LÊN TEST / PROD (CICD)

Để an toàn tuyệt đối, quy trình deploy phải tuân thủ:

1.  **Local Dev:** Developer viết code + file Migration (SQL/Python). Chạy thử trên máy cá nhân OK.
2.  **Commit Code:** Đẩy code lên branch `develop` hoặc `main`.
3.  **Môi trường Test:** 
    - Github Actions khởi động DB Test sạch.
    - Chạy Migration -> DB lên cấu trúc mới nhất.
    - Chạy Unit/Integration Test. Nếu lỗi DB -> Dừng ngay tại đây.
4.  **Môi trường Prod:**
    - Backup Database hiện tại (Snapshot).
    - App mới khởi động -> Flyway/Alembic tự động quét và chạy các file script mới nhất chưa có trong DB Prod.
    - Nếu thành công -> App bắt đầu nhận Request.
    - Nếu thất bại -> Rollback code về bản cũ.

---

## 4. BẢNG TỔNG HỢP CÔNG CỤ

| Thành phần | Công cụ Migration | File lưu trữ |
|-----------|-------------------|--------------|
| **Backend (Spring)** | **Flyway** | `db/migration/*.sql` |
| **AI Service (SQL)** | **Alembic** | `alembic/versions/*.py` |
| **AI Service (RAG)** | **Custom Scripts** | `app/core/init_db.py` |

---

## 5. LỜI KHUYÊN AN TOÀN
1. **Không bao giờ sửa file Migration đã commit:** Nếu sai, hãy tạo một file Migration mới để "sửa lỗi" cho file cũ.
2. **Backup là bắt buộc:** Luôn có lịch backup DB tự động (ví dụ mỗi 6 tiếng) trên môi trường Prod.
3. **Validate trước khi chạy:** Luôn dùng `ddl-auto=validate` trên Prod để tránh việc Hibernate tự sinh ra các câu lệnh `ALTER TABLE` không kiểm soát.
