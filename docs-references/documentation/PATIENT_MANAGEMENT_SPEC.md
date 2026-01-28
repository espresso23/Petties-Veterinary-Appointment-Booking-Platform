# PETTIES - PATIENT MANAGEMENT MODULE SPECIFICATION
**Version:** 1.5.0  
**Scope:** Clinic Manager (Web), Vet (Mobile/Web)  
**Created:** 2025-12-27

---

## 1. YÊU CẦU NGHIỆP VỤ (BUSINESS REQUIREMENTS)

### 1.1 Mục tiêu
Cung cấp khả năng quản lý tập trung danh sách khách hàng (Thú cưng & Chủ nuôi) cho Phòng khám. Giúp Clinic Manager (CM) và Vet tra cứu lịch sử khám bệnh (EMR) và tiêm chủng (Vaccination) dễ dàng mà không cần phải tìm qua Booking.

### 1.2 User Stories
*   **Là Clinic Manager**, tôi muốn xem danh sách tất cả thú cưng đã từng khám tại phòng khám của tôi để chăm sóc khách hàng.
*   **Là Clinic Manager**, tôi muốn xem chi tiết hồ sơ (Tên, tuổi, giống, lịch sử EMR) của thú cưng để hỗ trợ bác sĩ hoặc giải quyết khiếu nại.
*   **Là Vet**, tôi muốn tìm kiếm nhanh một bệnh nhân cũ để xem lại tiền sử bệnh trước khi khám.

---

## 2. USE CASES MỚI

### UC-CM-09: Xem Danh sách Bệnh nhân (View Patient List)
*   **Actor:** Clinic Manager, Vet (Web Dashboard)
*   **Logic:** Hiển thị danh sách các Pet **đã từng có ít nhất 1 Booking** (trạng thái != CANCELLED) tại Clinic này.
*   **Filters:** Tìm theo tên Pet, tên Chủ, SĐT chủ.

### UC-CM-10: Xem Hồ sơ Bệnh nhân (View Patient Detail)
*   **Actor:** Clinic Manager, Vet
*   **View:** 
    *   Thông tin chung (Info): Tên, Tuổi, Giống, Cân nặng, Chủ nuôi.
    *   Lịch sử khám (EMR History): Danh sách các lần khám, Chẩn đoán, Bác sĩ khám.
    *   Lịch sử Tiêm chủng (Vaccination): Các mũi đã tiêm, ngày tái chủng.
*   **Permission:** CM chỉ có quyền **Read-Only**. Vet có quyền **Write** (thêm EMR mới) nếu đang trong ca khám.

---

## 3. DATABASE DESIGN & LOGIC

### 3.1 Xác định "Bệnh nhân của Phòng khám"
Hệ thống không có bảng `Clinic_Patient` riêng. Quan hệ được xác định qua `Booking`.

**Logic Query:**
> "Lấy tất cả PET có booking tại CLINIC_ID với status là COMPLETED (hoặc CONFIRMED/CHECKIN)"

```sql
SELECT DISTINCT p.*, u.full_name as owner_name, u.phone_number as owner_phone
FROM pets p
JOIN bookings b ON b.pet_id = p.id
JOIN users u ON p.owner_id = u.id
WHERE b.clinic_id = :current_clinic_id
  AND b.status IN ('COMPLETED', 'CHECK_OUT', 'IN_PROGRESS', 'CONFIRMED')
ORDER BY b.updated_at DESC;
```

---

## 4. API SPECIFICATION (Backend Spring Boot)

### 4.1 Get Patient List
*   **Endpoint:** `GET /api/v1/clinics/{clinicId}/patients`
*   **Access:** CLINIC_MANAGER, VET (thuộc clinic đó)
*   **Query Params:**
    *   `search`: string (Tên pet, tên chủ, sđt)
    *   `page`: int
    *   `size`: int
*   **Response:**
    ```json
    {
      "content": [
        {
          "id": "pet_123",
          "name": "Mimi",
          "breed": "Mèo Anh",
          "ownerName": "Nguyễn Văn A",
          "ownerPhone": "0909123456",
          "lastVisitDate": "2024-12-25"
        }
      ],
      "totalPages": 5
    }
    ```

### 4.2 Get Patient Details (Summary)
*   **Endpoint:** `GET /api/v1/patients/{petId}`
*   **Access:** VET (All), CLINIC_MANAGER (Only if pet visited their clinic), PET_OWNER (Own pet)
*   **Response:** Full pet info + Owner info.

### 4.3 Get EMR History
*   **Endpoint:** `GET /api/v1/patients/{petId}/emrs`
*   **Access:** VET, CLINIC_MANAGER
*   **Logic:** Trả về list EMR sắp xếp theo ngày giảm dần.

### 4.4 Get Vaccination History
*   **Endpoint:** `GET /api/v1/patients/{petId}/vaccinations`
*   **Access:** VET, CLINIC_MANAGER

### 4.5 Add EMR (Vet Only)
*   **Endpoint:** `POST /api/v1/bookings/{bookingId}/emr` (Gắn liền với Booking hiện tại)
*   **Endpoint (Alternative):** `POST /api/v1/patients/{petId}/emr` (Case cấp cứu/vãng lai - Ít dùng) -> **Nên dùng endpoint theo Booking**.

### 4.6 Add Vaccination (Vet Only)
*   **Endpoint:** `POST /api/v1/patients/{petId}/vaccinations`
*   **Body:** `vaccineName`, `batchNumber`, `administerDate`, `nextDueDate`, `vetId`.

---

## 5. UI/UX DESIGN (Frontend Spec)

### 5.1 Screen: Patient List (Web - Clinic Manager)
*   **Route:** `/admin/patients`
*   **Layout:** Table
*   **Columns:**
    1.  **Pet Info:** Avatar + Tên + Giống
    2.  **Owner Info:** Tên chủ + SĐT (Quick Call action)
    3.  **Last Visit:** Ngày khám gần nhất
    4.  **Total Visits:** Tổng số lần khám
    5.  **Action:** Nút "View Detail" (Eye Icon)

### 5.2 Screen: Patient Detail (Web - Clinic Manager)
*   **Route:** `/admin/patients/:id`
*   **Layout:** Split View
    *   **Left Column (30%):** Patient Card (Avatar, Info, Owner Contact).
    *   **Right Column (70%):** Tabs
        *   **Tab 1: Lịch sử khám (EMRs):** Timeline view (dọc), hiển thị ngày, bác sĩ, chẩn đoán chính. Click để xem chi tiết đơn thuốc.
        *   **Tab 2: Tiêm chủng (Vaccines):** Table view (Ngày tiêm, Loại vaccine, Ngày tái chủng).
        *   **Tab 3: Bookings:** Lịch sử đặt hẹn (cả quá khứ và sắp tới).

---

## 6. QA & SECURITY CHECKLIST

*   [ ] **Security (IDOR):** CM Clinic A không được xem danh sách bệnh nhân của Clinic B (trừ khi bệnh nhân đó cũng từng khám ở Clinic A).
*   [ ] **Privacy:** Số điện thoại chủ nuôi cần được bảo vệ (chỉ hiện cho CM/Vet, ẩn với role khác nếu cần).
*   [ ] **Performance:** Query list patients cần đánh index vào `bookings.clinic_id` và `bookings.pet_id`.
