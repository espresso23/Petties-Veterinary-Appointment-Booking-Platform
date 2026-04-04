# Hướng dẫn Test E2E theo Use Case từng Role

**Phiên bản:** 1.0  
**Cập nhật:** 2026-03-02  
**Loại test:** Manual (thủ công)  
**Tham chiếu:** [PETTIES_SRS](../SRS/PETTIES_SRS.md) (Use Case 2.2.x), [PETTIES_Features](../PETTIES_Features.md)

---

## 1. Mục đích và phạm vi

- Tài liệu dùng cho **QA/tester** chạy test end-to-end (manual) theo **use case của từng role**.
- Mỗi flow gồm: mục đích (UC-ID), điều kiện, vài bước chính, kết quả mong đợi và checklist. Chi tiết từng bước có thể bổ sung sau.
- **Platform:** Pet Owner chỉ Mobile; Staff dùng Mobile (và Web nếu có); Clinic Manager, Clinic Owner, Admin chỉ Web.

---

## 2. Môi trường và tài khoản test

### 2.1 Yêu cầu

- **Backend:** Spring Boot chạy (localhost:8080 hoặc api-test.petties.world).
- **Web:** React app (localhost:5173 hoặc test.petties.world).
- **Mobile:** Flutter app (emulator hoặc thiết bị thật).
- **Database:** PostgreSQL (và Redis, MongoDB nếu tính năng cần).

### 2.2 Tài khoản test (ví dụ)

| Role | Mục đích |
|------|----------|
| Pet Owner | Mobile: đặt lịch, xem booking, SOS, AI chat, EMR/vaccination |
| Staff | Mobile/Web: lịch, check-in, add-on, EMR, hoàn thành khám, SOS |
| Clinic Manager | Web: gán staff, ca làm việc, checkout, hủy/hoàn tiền, bệnh nhân, SOS |
| Clinic Owner | Web: thông tin clinic, dịch vụ, giá, doanh thu, staff, cấu hình SOS |
| Admin | Web: duyệt clinic, thống kê |

*(Điền username/password thực tế theo môi trường dev/test.)*

---

## 3. Cách sử dụng tài liệu

- Mỗi **section** = một role.
- Mỗi **flow** = một E2E scenario (ID dạng E2E-XX-NN).
- **Format mỗi flow:** Mục đích (UC-ID) → Điều kiện → Bước (bullet) → Kết quả mong đợi → Checklist [ ].
- Đánh dấu [x] khi đã chạy pass.

---

## 4. Pet Owner (Mobile)

### E2E-PO-01: Đăng ký / Đăng nhập

- **Mục đích:** UC-AUTH-01, UC-AUTH-02 – Đăng ký (Email/OTP), Đăng nhập Google.
- **Điều kiện:** App Mobile cài đặt, chưa đăng nhập.
- **Bước:** Đăng ký email + OTP; hoặc đăng nhập bằng Google; kiểm tra vào được màn chính.
- **Kết quả:** Tài khoản tạo/đăng nhập thành công, hiển thị role Pet Owner.
- **Checklist:** [ ] Đăng ký Email/OTP  [ ] Đăng nhập Google  [ ] Thoát đăng nhập

---

### E2E-PO-02: Tạo / sửa hồ sơ thú cưng

- **Mục đích:** UC-PET-01 – Quản lý hồ sơ thú cưng (thêm, sửa).
- **Điều kiện:** Đã đăng nhập Pet Owner.
- **Bước:** Vào Quản lý thú cưng → Thêm thú cưng (tên, loài, giống, ngày sinh, cân nặng, ảnh); Sửa thông tin một thú cưng; Lưu.
- **Kết quả:** Danh sách thú cưng hiển thị đúng; sửa lưu thành công.
- **Checklist:** [ ] Thêm thú cưng  [ ] Sửa thú cưng  [ ] Xóa/ẩn thú cưng (nếu có)

---

### E2E-PO-03: Tìm kiếm phòng khám, xem chi tiết

- **Mục đích:** UC-CLINIC-01, UC-CLINIC-02 – Tìm clinic theo vị trí/lọc, xem chi tiết.
- **Điều kiện:** Đã đăng nhập; có quyền vị trí (GPS) nếu tìm theo khoảng cách.
- **Bước:** Mở Tìm phòng khám → Nhập/vị trí → Áp dụng bộ lọc (nếu có); Chọn một clinic → Xem chi tiết (địa chỉ, dịch vụ, giờ làm việc).
- **Kết quả:** Danh sách clinic phù hợp; màn chi tiết hiển thị đủ thông tin.
- **Checklist:** [ ] Tìm theo vị trí  [ ] Xem chi tiết clinic

---

### E2E-PO-04: Đặt lịch khám tại phòng (IN_CLINIC) + thanh toán online

- **Mục đích:** UC-PO-06 – Đặt lịch tại phòng khám, thanh toán online.
- **Điều kiện:** Đã có thú cưng; clinic có dịch vụ và slot.
- **Bước:** Chọn clinic → Chọn dịch vụ → Chọn ngày/giờ (slot) → Chọn thú cưng → Chọn thanh toán Online → Xác nhận; hoàn tất thanh toán (Stripe/test).
- **Kết quả:** Booking tạo thành công, trạng thái PENDING (hoặc theo luồng); thanh toán ghi nhận.
- **Checklist:** [ ] Chọn slot còn trống  [ ] Thanh toán online thành công  [ ] Booking hiển thị trong "Lịch của tôi"

---

### E2E-PO-04c: Đặt lịch với Trợ lý AI (Interactive Components)

- **Mục đích:** UC-PO-14c – Booking With ChatBot (Guided Booking).
- **Hướng dẫn chi tiết:** [BOOKING_WITH_AI_E2E_TEST_GUIDE](./BOOKING_WITH_AI_E2E_TEST_GUIDE.md)
- **Điều kiện:**
  - Đã đăng nhập Pet Owner.
  - Có ít nhất 1 thú cưng.
  - Bật quyền vị trí (để tìm phòng khám gần nhất).
  - Clinic có dịch vụ phù hợp và có slot trống trong 7 ngày tới.
- **Bước:**
  - Mở màn hình Chat với Trợ lý AI.
  - Tap chip `Tôi muốn đặt lịch khám`.
  - Chọn Pet Card.
  - Chọn hình thức khám (tại phòng khám hoặc tại nhà).
  - Chọn nhóm dịch vụ (khám bệnh/tiêm phòng/tỉa lông). Nếu app xin quyền vị trí, chọn Cho phép.
  - Chọn phòng khám trong carousel.
  - Chọn 1 hoặc nhiều dịch vụ trong chips, bấm `Tiếp tục`.
  - Chọn ngày, chọn giờ.
  - Kiểm tra `Booking Summary Card` và bấm `XÁC NHẬN ĐẶT LỊCH`.
- **Kết quả:**
  - Nhận thông báo `booking_created` và nội dung: quản lý phòng khám xác nhận thời gian cuối.
  - Booking được tạo ở trạng thái chờ xác nhận.
- **Checklist:**
  - [ ] Hiển thị đủ chips/cards/carousel/slot grid
  - [ ] Không tạo booking nếu chưa bấm `XÁC NHẬN ĐẶT LỊCH`
  - [ ] Từ chối quyền vị trí thì AI yêu cầu bật vị trí và không crash
  - [ ] Reconnect vào cùng session vẫn restore UI bước gần nhất

---
### E2E-PO-05: Đặt lịch khám tại nhà (HOME_VISIT)

- **Mục đích:** UC-BOOK-02 – Đặt lịch khám tại nhà.
- **Điều kiện:** Clinic có dịch vụ HOME_VISIT; có slot.
- **Bước:** Chọn đặt lịch tại nhà → Chọn clinic, dịch vụ, ngày/giờ, thú cưng, địa chỉ → Xác nhận (Cash hoặc Online).
- **Kết quả:** Booking HOME_VISIT tạo thành công; hiển thị phí di chuyển (nếu có).
- **Checklist:** [ ] Tạo booking HOME_VISIT  [ ] Kiểm tra tổng tiền (base + distance nếu có)

---

### E2E-PO-06: Xem danh sách booking, hủy booking

- **Mục đích:** UC-BOOK-03, UC-BOOK-04 – Xem lịch hẹn, hủy lịch.
- **Điều kiện:** Có ít nhất một booking ở trạng thái PENDING hoặc CONFIRMED (cho phép hủy).
- **Bước:** Vào "Lịch của tôi" / "My bookings" → Xem danh sách theo trạng thái; Mở chi tiết một booking → Hủy (nếu được phép).
- **Kết quả:** Danh sách đúng; hủy thành công, trạng thái chuyển CANCELLED.
- **Checklist:** [ ] Xem danh sách  [ ] Xem chi tiết  [ ] Hủy booking (khi status cho phép)

---

### E2E-PO-07: Full booking lifecycle (xuyên role)

- **Mục đích:** UC-BOOK-01/02 + UC-BOOK-03 + UC-BOOK-06/07 + UC-BOOK-08 + UC-BOOK-11 – Từ đặt lịch đến hoàn thành.
- **Điều kiện:** Pet Owner, Clinic Manager, Staff có tài khoản; clinic có staff và slot.
- **Bước (Pet Owner):** Đặt lịch IN_CLINIC hoặc HOME_VISIT → Thanh toán (nếu online). **(Manager):** Vào Web → Gán staff cho booking. **(Staff):** Mobile/Web → Check-in → (HOME_VISIT/SOS: thêm/xóa dịch vụ phát sinh nếu cần) → Hoàn thành khám. **(Manager):** Nhận thanh toán & checkout.
- **Kết quả:** Booking chuyển PENDING → CONFIRMED → IN_PROGRESS → COMPLETED; tổng tiền đúng nếu có add-on.
- **Checklist:** [ ] PO đặt lịch  [ ] CM gán staff  [ ] Staff check-in  [ ] Staff thêm/xóa add-on (nếu HOME_VISIT/SOS)  [ ] Staff hoàn thành khám  [ ] CM checkout  [ ] PO thấy trạng thái COMPLETED

---

### E2E-PO-08: Xem hồ sơ EMR, sổ tiêm chủng

- **Mục đích:** UC-PET-02, UC-PET-03 – Xem EMR và sổ tiêm của thú cưng.
- **Điều kiện:** Đã có booking COMPLETED có EMR / vaccination.
- **Bước:** Vào thú cưng → Hồ sơ bệnh án / EMR; Sổ tiêm chủng. Xem chi tiết một lần khám / một mũi tiêm.
- **Kết quả:** Danh sách EMR/vaccination hiển thị; mở được chi tiết.
- **Checklist:** [ ] Xem danh sách EMR  [ ] Xem chi tiết EMR  [ ] Xem sổ tiêm chủng

---

### E2E-PO-09: SOS – Gửi yêu cầu, theo dõi vị trí, ETA, nhận thông báo

- **Mục đích:** 3.10.1, 3.10.2, 3.10.3, 3.10.4 – Yêu cầu SOS, theo dõi staff, ETA, thông báo đến nơi.
- **Điều kiện:** App có quyền vị trí; clinic cấu hình SOS; có staff được gán.
- **Bước:** Mở SOS → Chọn thú cưng, mô tả → Gửi yêu cầu; Sau khi clinic nhận và staff bắt đầu di chuyển: xem bản đồ vị trí staff, ETA; Nhận thông báo khi staff sắp đến / đã đến.
- **Kết quả:** SOS tạo thành công; bản đồ/ETA cập nhật; nhận push/in-app thông báo đúng.
- **Checklist:** [ ] Tạo yêu cầu SOS  [ ] Xem bản đồ/ETA  [ ] Nhận thông báo sắp đến / đã đến

---

### E2E-PO-10: Chat AI – Tư vấn, symptom check, real-time

- **Mục đích:** UC-AI-01, UC-AI-02, UC-AI-04 – Hỏi tư vấn, kiểm tra triệu chứng, chat real-time.
- **Điều kiện:** AI service và WebSocket hoạt động; đã đăng nhập.
- **Bước:** Mở Chat AI → Gửi câu hỏi tư vấn; Gửi câu hỏi triệu chứng; Kiểm tra phản hồi real-time (streaming).
- **Kết quả:** Bot trả lời phù hợp; symptom check trả về gợi ý (nếu có); tin nhắn hiển thị theo thời gian thực.
- **Checklist:** [ ] Câu hỏi tư vấn  [ ] Symptom check  [ ] Real-time chat

---

## 5. Staff (Mobile / Web)

### E2E-ST-01: Đăng nhập (invited account)

- **Mục đích:** UC-AUTH-03 – Staff đăng nhập bằng tài khoản được mời.
- **Điều kiện:** Manager/Owner đã thêm nhân viên bằng email hoặc liên kết account vào clinic; Staff chưa đăng nhập.
- **Bước:** Mở app → Đăng nhập bằng email đã được invite (hoặc Google nếu đã link); kiểm tra vào được màn Staff.
- **Kết quả:** Đăng nhập thành công; hiển thị role Staff, không thấy chức năng Pet Owner.
- **Checklist:** [ ] Đăng nhập email invite  [ ] Hiển thị đúng dashboard Staff

---

### E2E-ST-02: Xem lịch làm việc, danh sách booking được gán

- **Mục đích:** UC-BOOK-09, UC-STAFF-04 – Xem lịch và booking được gán.
- **Điều kiện:** Staff đã được gán ca và ít nhất một booking.
- **Bước:** Vào Lịch làm việc → Xem ca trong ngày/tuần; Vào Danh sách booking / Assigned bookings → Xem booking CONFIRMED/IN_PROGRESS.
- **Kết quả:** Ca làm việc và danh sách booking hiển thị đúng; mở được chi tiết booking.
- **Checklist:** [ ] Xem lịch ca  [ ] Xem danh sách booking gán  [ ] Mở chi tiết booking

---

### E2E-ST-03: Check-in bệnh nhân

- **Mục đích:** UC-BOOK-08 – Check-in khi khách đến (IN_CLINIC) hoặc bắt đầu di chuyển (HOME_VISIT/SOS).
- **Điều kiện:** Booking trạng thái CONFIRMED; Staff là người được gán.
- **Bước:** Mở chi tiết booking → Bấm "Check-in" / "Bắt đầu khám" (IN_CLINIC) hoặc "Bắt đầu di chuyển" (HOME_VISIT/SOS); xác nhận.
- **Kết quả:** Trạng thái chuyển IN_PROGRESS; có thể tạo EMR (nếu áp dụng); Pet Owner nhận thông báo (nếu có).
- **Checklist:** [ ] Check-in IN_CLINIC  [ ] Check-in HOME_VISIT/SOS (bắt đầu di chuyển)

---

### E2E-ST-04: Thêm / xóa dịch vụ phát sinh

- **Mục đích:** Add-on service – Chỉ khi booking IN_PROGRESS, type HOME_VISIT hoặc SOS.
- **Điều kiện:** Booking IN_PROGRESS, HOME_VISIT hoặc SOS; clinic có dịch vụ add-on (isHomeVisit cho HOME_VISIT).
- **Bước:** Trong chi tiết booking → "Thêm dịch vụ phát sinh" → Chọn dịch vụ → Xác nhận; Kiểm tra tổng tiền tăng; Xóa một dịch vụ phát sinh → Xác nhận; Kiểm tra tổng tiền giảm.
- **Kết quả:** Danh sách dịch vụ và tổng tiền cập nhật đúng; chỉ dịch vụ add-on được xóa (không xóa dịch vụ gốc).
- **Checklist:** [ ] Thêm dịch vụ phát sinh  [ ] Xóa dịch vụ phát sinh  [ ] Tổng tiền đúng

---

### E2E-ST-05: Tạo EMR (SOAP), kê đơn, thêm sổ tiêm

- **Mục đích:** UC-VT-06, UC-VT-07, UC-VT-08 – Tạo EMR, kê đơn, thêm vaccination.
- **Điều kiện:** Booking IN_PROGRESS; Staff đã check-in.
- **Bước:** Từ chi tiết booking → Tạo EMR (SOAP); Thêm đơn thuốc (nếu có); Thêm/cập nhật sổ tiêm chủng; Lưu.
- **Kết quả:** EMR lưu thành công; đơn thuốc và vaccination hiển thị trong EMR / hồ sơ pet.
- **Checklist:** [ ] Tạo EMR SOAP  [ ] Kê đơn thuốc  [ ] Thêm vaccination

---

### E2E-ST-06: Hoàn thành khám (Mark treatment finished)

- **Mục đích:** UC-BOOK-08 – Đánh dấu đã khám xong, chuyển sang bước thanh toán/checkout.
- **Điều kiện:** Booking IN_PROGRESS; đã check-in và (nên) có EMR.
- **Bước:** Trong chi tiết booking → "Hoàn thành khám" / "Mark treatment finished"; xác nhận.
- **Kết quả:** Trạng thái chuyển CHECK_OUT (hoặc tương đương); Manager nhận thông báo cần thanh toán/checkout (nếu có).
- **Checklist:** [ ] Bấm hoàn thành khám  [ ] Trạng thái chuyển đúng  [ ] Manager thấy booking cần checkout

---

### E2E-ST-07: Tra cứu bệnh nhân cũ (Patient Lookup)

- **Mục đích:** UC-VT-12 – Tìm và xem hồ sơ bệnh nhân cũ của phòng khám.
- **Điều kiện:** Staff thuộc clinic; clinic có bệnh nhân đã khám (có EMR).
- **Bước:** Vào Tra cứu bệnh nhân / Patient Lookup → Tìm theo tên pet/owner/số điện thoại; Mở hồ sơ → Xem EMR, vaccination.
- **Kết quả:** Tìm thấy bệnh nhân; xem được lịch sử EMR và tiêm chủng (read-only).
- **Checklist:** [ ] Tìm bệnh nhân  [ ] Xem EMR/vaccination

---

### E2E-ST-08: SOS – Nhận assignment, bắt đầu di chuyển, xác nhận đến nơi, checkout

- **Mục đích:** 3.10.3, 3.10.2, 3.10.5 – Nhận SOS, di chuyển, đến nơi, checkout.
- **Điều kiện:** Manager đã gán Staff cho SOS; Pet Owner đã tạo yêu cầu SOS.
- **Bước:** Xem booking SOS được gán → "Bắt đầu di chuyển" (bật GPS, gửi vị trí); Sau khi đến → "Đã đến nơi" / Confirm arrival; Thực hiện khám, add-on (nếu cần), hoàn thành khám; (Manager checkout hoặc Staff checkout tùy nghiệp vụ).
- **Kết quả:** Pet Owner thấy vị trí/ETA; thông báo đến nơi; booking chuyển IN_PROGRESS → có thể checkout; phí SOS và add-on đúng.
- **Checklist:** [ ] Nhận SOS  [ ] Bắt đầu di chuyển (GPS)  [ ] Xác nhận đến nơi  [ ] Hoàn thành khám / checkout

---

## 6. Clinic Manager (Web)

### E2E-CM-01: Đăng nhập Manager

- **Mục đích:** UC-AUTH-04 – Clinic Manager đăng nhập Web.
- **Điều kiện:** Tài khoản CLINIC_MANAGER đã tồn tại.
- **Bước:** Mở Web → Đăng nhập bằng email/Google của Manager.
- **Kết quả:** Vào dashboard Manager; không thấy chức năng Admin/Owner.
- **Checklist:** [ ] Đăng nhập thành công  [ ] Dashboard Manager hiển thị

---

### E2E-CM-02: Xem danh sách nhân viên, thêm nhân viên bằng email

- **Mục đích:** UC-STAFF-03, UC-STAFF-01 – Xem staff, mời staff bằng email.
- **Điều kiện:** Manager thuộc clinic có quyền quản lý staff.
- **Bước:** Vào Quản lý nhân viên → Xem danh sách; Thêm nhân viên (nhập email, role/specialty nếu có) → Xác nhận liên kết/tạo account.
- **Kết quả:** Danh sách staff hiển thị; staff mới được liên kết vào clinic hoặc tạo mới theo email; trạng thái roster cập nhật đúng.
- **Checklist:** [ ] Xem danh sách staff  [ ] Thêm staff bằng email  [ ] Kiểm tra roster cập nhật

---

### E2E-CM-03: Tạo / xem / xóa ca làm việc

- **Mục đích:** UC-STAFF-05, UC-STAFF-06, UC-STAFF-07 – Tạo, xem và xóa ca làm việc.
- **Điều kiện:** Có staff trong clinic.
- **Bước:** Vào Lịch / Shifts → Tạo ca (chọn staff, ngày, giờ) → Xem chi tiết ca và slot summary → Xóa ca hợp lệ → Xác nhận.
- **Kết quả:** Ca hiển thị đúng; xem được chi tiết ca; xóa thành công khi không có slot đã được đặt.
- **Checklist:** [ ] Tạo ca  [ ] Xem chi tiết ca  [ ] Xóa ca hợp lệ

---

### E2E-CM-04: Xem booking mới, gán staff, gán lại staff (reassign)

- **Mục đích:** UC-BOOK-05, UC-BOOK-06, UC-BOOK-07 – Xem booking, gán staff, reassign.
- **Điều kiện:** Có booking PENDING hoặc CONFIRMED; có staff có slot phù hợp.
- **Bước:** Dashboard / Booking mới → Xem danh sách; Chọn booking → Gán staff (chọn staff, xác nhận); Với booking đã xác nhận → Gán lại staff khác cho service item nếu cần.
- **Kết quả:** Booking chuyển CONFIRMED; Staff và Pet Owner nhận thông báo (nếu có); Reassign cập nhật đúng.
- **Checklist:** [ ] Xem booking mới  [ ] Gán staff  [ ] Reassign staff

---

### E2E-CM-05: Nhận thanh toán & checkout

- **Mục đích:** UC-BOOK-08 – Nhận tiền (cash/online) và hoàn tất checkout.
- **Điều kiện:** Booking đã CHECK_OUT (Staff đã hoàn thành khám); có thể đã thanh toán online trước hoặc thanh toán tại quầy.
- **Bước:** Vào booking cần thanh toán → Chọn Cash hoặc xác nhận Online đã thanh toán → Nhập số tiền (nếu cash) → "Hoàn tất checkout".
- **Kết quả:** Booking chuyển COMPLETED; thanh toán ghi nhận; slot/doanh thu cập nhật (nếu có).
- **Checklist:** [ ] Checkout cash  [ ] Checkout online (đã paid)  [ ] Trạng thái COMPLETED

---

### E2E-CM-06: Xử lý hủy & hoàn tiền

- **Mục đích:** UC-BOOK-04 – Hủy booking và xử lý hoàn tiền.
- **Điều kiện:** Booking ở trạng thái cho phép hủy; có chính sách hoàn tiền (nếu áp dụng).
- **Bước:** Tìm booking (PENDING/CONFIRMED) → Hủy booking; Nếu đã thanh toán online → Thực hiện hoàn tiền (theo quy trình Stripe/refund).
- **Kết quả:** Booking CANCELLED; hoàn tiền thành công (nếu có); slot được giải phóng.
- **Checklist:** [ ] Hủy booking  [ ] Hoàn tiền (nếu có)

---

### E2E-CM-07: Xem danh sách bệnh nhân, xem hồ sơ EMR (read-only)

- **Mục đích:** UC-CM-08, UC-CM-09 – Quản lý bệnh nhân, xem EMR.
- **Điều kiện:** Clinic có booking đã khám (có EMR).
- **Bước:** Vào Quản lý bệnh nhân / Patient list → Xem danh sách; Chọn một bệnh nhân → Xem lịch sử EMR, sổ tiêm (read-only).
- **Kết quả:** Danh sách bệnh nhân đúng; xem được EMR và vaccination, không chỉnh sửa.
- **Checklist:** [ ] Xem danh sách bệnh nhân  [ ] Xem EMR/vaccination read-only

---

### E2E-CM-08: SOS – Dispatch thủ công, Accept/Decline (auto-match)

- **Mục đích:** 3.10.1, 3.10.3 – Dispatch SOS thủ công; Nhận/ từ chối yêu cầu SOS (auto-match).
- **Điều kiện:** Có yêu cầu SOS gửi tới clinic (auto-match hoặc manual); có staff.
- **Bước:** (Auto-match) Nhận thông báo SOS → Accept hoặc Decline; nếu Accept → Gán staff. (Manual) Vào SOS / Emergency → Chọn yêu cầu → Dispatch → Gán staff.
- **Kết quả:** Pet Owner nhận thông báo clinic nhận/từ chối; staff được gán nhận assignment; trạng thái SOS cập nhật.
- **Checklist:** [ ] Accept SOS (auto-match)  [ ] Decline SOS  [ ] Dispatch thủ công + gán staff

---

## 7. Clinic Owner (Web)

### E2E-CO-01: Đăng ký phòng khám (chờ Admin duyệt)

- **Mục đích:** UC-AUTH-06 – Đăng ký clinic, gửi duyệt Admin.
- **Điều kiện:** Tài khoản Clinic Owner (hoặc đăng ký mới); chưa có clinic approved.
- **Bước:** Đăng ký clinic: thông tin cơ bản, địa chỉ, giấy phép, dịch vụ/giờ (nếu có trong form); Gửi.
- **Kết quả:** Clinic ở trạng thái pending; Admin thấy trong danh sách chờ duyệt.
- **Checklist:** [ ] Điền form đăng ký  [ ] Gửi thành công  [ ] Trạng thái pending

---

### E2E-CO-02: Quản lý thông tin phòng khám

- **Mục đích:** UC-OPS-01 – Cập nhật thông tin clinic.
- **Điều kiện:** Clinic đã được Admin duyệt; Owner đã đăng nhập.
- **Bước:** Vào Thông tin phòng khám → Sửa tên, địa chỉ, SĐT, mô tả, ảnh/logo → Lưu.
- **Kết quả:** Thông tin cập nhật; hiển thị đúng trên app Mobile (tìm kiếm/chi tiết).
- **Checklist:** [ ] Sửa thông tin  [ ] Upload ảnh/logo  [ ] Hiển thị đúng trên app

---

### E2E-CO-03: Quản lý Master Services, cấu hình dịch vụ tại phòng khám

- **Mục đích:** UC-OPS-04, UC-OPS-02 – Master services, dịch vụ tại branch.
- **Điều kiện:** Clinic Owner có quyền; có Master catalog (nếu dùng inherit).
- **Bước:** Master Services: tạo/sửa danh mục dịch vụ (tên, category, giá mặc định). Clinic Services: thêm dịch vụ từ Master (inherit) hoặc tạo custom; bật/tắt active.
- **Kết quả:** Master và clinic services hiển thị; Pet Owner thấy dịch vụ khi đặt lịch tại clinic đó.
- **Checklist:** [ ] Tạo/sửa Master service  [ ] Thêm dịch vụ từ Master  [ ] Tạo dịch vụ custom  [ ] Bật/tắt dịch vụ

---

### E2E-CO-04: Cấu hình giá (base, cân nặng, price per KM, bulk)

- **Mục đích:** UC-OPS-03, UC-OPS-09, UC-OPS-10 – Giá cơ bản, theo cân nặng, theo km, cập nhật hàng loạt.
- **Điều kiện:** Đã có dịch vụ tại clinic.
- **Bước:** Vào Pricing / Giá → Cấu hình base price, weight-based; Với HOME_VISIT: price per KM; (Nếu có) Bulk update price per KM cho nhiều dịch vụ.
- **Kết quả:** Giá áp dụng đúng khi đặt lịch (tại phòng / tại nhà); tổng tiền tính đúng.
- **Checklist:** [ ] Base price  [ ] Giá theo cân nặng  [ ] Price per KM  [ ] Bulk update (nếu có)

---

### E2E-CO-05: Xem báo cáo doanh thu

- **Mục đích:** UC-OPS-05 – Xem doanh thu.
- **Điều kiện:** Clinic có booking đã thanh toán.
- **Bước:** Vào Doanh thu / Revenue → Chọn khoảng thời gian; Xem bảng/đồ thị.
- **Kết quả:** Số liệu doanh thu hiển thị đúng theo kỳ; có thể export (nếu có).
- **Checklist:** [ ] Xem theo ngày/tuần/tháng  [ ] Số liệu khớp với booking completed

---

### E2E-CO-06: Quick add staff, quản lý staff (xem, đổi role, xóa)

- **Mục đích:** UC-STAFF-01, UC-STAFF-03 – Thêm staff nhanh, quản lý staff.
- **Điều kiện:** Clinic Owner đăng nhập.
- **Bước:** Thêm staff bằng email (quick add); Xem danh sách; Sửa role (Manager/Staff); Gỡ staff khỏi clinic (remove).
- **Kết quả:** Staff nhận invite; danh sách và role cập nhật; remove thành công.
- **Checklist:** [ ] Quick add staff  [ ] Xem/sửa role  [ ] Remove staff

---

### E2E-CO-07: Cấu hình SOS auto-match (phí SOS, bán kính, v.v.)

- **Mục đích:** 3.10.x – Cấu hình SOS (phí, bán kính nhận request).
- **Điều kiện:** Clinic đã duyệt; tính năng SOS bật.
- **Bước:** Vào Cấu hình SOS / SOS Settings → Đặt phí SOS; Bán kính (km) nhận yêu cầu; Bật/tắt nhận auto-match; Lưu.
- **Kết quả:** Pet Owner thấy phí SOS khi chọn clinic; auto-match gửi request đúng clinic trong bán kính.
- **Checklist:** [ ] Đặt phí SOS  [ ] Bán kính  [ ] Bật/tắt auto-match

---

## 8. Admin (Web)

### E2E-AD-01: Đăng nhập Admin, xem clinic pending, phê duyệt / từ chối

- **Mục đích:** UC-AUTH-07, UC-GOV-01, UC-GOV-02 – Admin login, duyệt clinic.
- **Điều kiện:** Tài khoản ADMIN; có clinic đăng ký pending.
- **Bước:** Đăng nhập Web với role Admin → Vào Quản lý clinic / Pending clinics → Xem chi tiết từng clinic → Approve hoặc Reject (kèm lý do nếu reject).
- **Kết quả:** Clinic approved hiển thị trong danh sách clinic active; rejected nhận thông báo (email/in-app nếu có).
- **Checklist:** [ ] Đăng nhập Admin  [ ] Xem pending  [ ] Approve clinic  [ ] Reject clinic (có lý do)

---

### E2E-AD-02: Xem thống kê nền tảng, báo cáo người dùng

- **Mục đích:** UC-GOV-03, UC-GOV-04 – Thống kê platform, báo cáo user.
- **Điều kiện:** Admin đăng nhập; có dữ liệu (user, booking, clinic).
- **Bước:** Vào Dashboard / Statistics → Xem tổng quan (số user, clinic, booking, doanh thu); Vào Báo cáo người dùng (nếu có) → Lọc, xem chi tiết.
- **Kết quả:** Số liệu hiển thị đúng; có thể filter theo thời gian (nếu có).
- **Checklist:** [ ] Thống kê tổng quan  [ ] Báo cáo user/transaction

---

### E2E-AD-03: (Optional) Cấu hình AI Agent – Tools, Knowledge Base, Playground

- **Mục đích:** UC-AI-06, UC-AI-07, UC-AI-08 – Quản lý tools, RAG, test agent.
- **Điều kiện:** Admin; AI service và dashboard Agent Management có sẵn.
- **Bước:** Vào AI Agent Config → Bật/tắt từng tool; Knowledge Base: upload tài liệu, xem trạng thái index; Playground: gửi câu hỏi test, xem ReAct flow / tool calls.
- **Kết quả:** Tool on/off áp dụng; KB index thành công; Playground trả lời và hiển thị flow đúng.
- **Checklist:** [ ] Bật/tắt tool  [ ] Upload KB  [ ] Test playground

---

## 9. Checklist tổng hợp (pass toàn bộ)

- **Pet Owner:** [ ] E2E-PO-01 → E2E-PO-10  
- **Staff:** [ ] E2E-ST-01 → E2E-ST-08  
- **Clinic Manager:** [ ] E2E-CM-01 → E2E-CM-08  
- **Clinic Owner:** [ ] E2E-CO-01 → E2E-CO-07  
- **Admin:** [ ] E2E-AD-01 → E2E-AD-03  
- **Cross-role:** [ ] E2E-PO-07 (full booking lifecycle)

---

*Tài liệu dạng outline; có thể bổ sung chi tiết từng bước (data mẫu, ảnh màn hình) trong các bản cập nhật sau.*

