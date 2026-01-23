# PETTIES - BPMN 2.0 Detailed Process Specifications

**Tài liệu mô tả chi tiết luồng nghiệp vụ theo chuẩn BPMN 2.0 để vẽ bằng Draw.io**

**Version:** 1.5.0  
**Last Updated:** 2026-01-22  
**Standard:** BPMN 2.0

---

## 1. BP-002: Booking Process (Đặt lịch khám)

### 1.1 Thông tin chung

| Thuộc tính | Giá trị |
|------------|---------|
| **Process ID** | BP-002 |
| **Process Name** | Booking Management Process |
| **Process Type** | Executable |
| **Pools** | 4 (Pet Owner, System, Clinic Manager, Vet) |
| **Start Event** | Pet Owner mở app và chọn "Đặt lịch" |
| **End Events** | 3 (Booking Confirmed, Booking Cancelled, Booking Rejected) |

### 1.2 Pools và Lanes

| Pool | Description | Platform |
|------|-------------|----------|
| **Pet Owner** | Chủ thú cưng - khách hàng | Mobile App |
| **System** | Petties Platform - xử lý tự động | Backend |
| **Clinic Manager** | Quản lý phòng khám | Web Dashboard |
| **Vet** | Bác sĩ thú y | Mobile App / Web |

### 1.3 Process Flow - Chi tiết từng bước

#### POOL: Pet Owner (Mobile App)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 1 | **Start Event** | Bắt đầu đặt lịch | Pet Owner mở app, chọn "Đặt lịch" | → Task 2 |
| 2 | **User Task** | Tìm kiếm phòng khám | Tìm theo vị trí GPS hoặc tên phòng khám | → Task 3 |
| 3 | **User Task** | Xem thông tin phòng khám | Xem địa chỉ, dịch vụ, giá, đánh giá, giờ làm việc | → Task 4 |
| 4 | **User Task** | Chọn loại dịch vụ | Chọn CLINIC_VISIT hoặc HOME_VISIT | → Gateway 5 |
| 5 | **Exclusive Gateway** | Loại dịch vụ? | Kiểm tra loại dịch vụ đã chọn | → Task 6 (HOME_VISIT) hoặc → Task 7 (CLINIC_VISIT) |
| 6 | **User Task** | Nhập địa chỉ nhà | Chỉ khi HOME_VISIT: nhập địa chỉ để bác sĩ đến | → Task 7 |
| 7 | **User Task** | Chọn dịch vụ cụ thể | Chọn từ danh sách dịch vụ của phòng khám | → Task 8 |
| 8 | **User Task** | Chọn ngày và giờ | Chọn ngày → Xem slots trống → Chọn slot | → Task 9 |
| 9 | **User Task** | Chọn thú cưng | Chọn pet cần khám từ danh sách pet đã đăng ký | → Task 10 |
| 10 | **User Task** | Nhập ghi chú (optional) | Mô tả triệu chứng, yêu cầu đặc biệt | → Task 11 |
| 11 | **User Task** | Chọn phương thức thanh toán | Chọn: "Thanh toán online" hoặc "Tiền mặt" | → Gateway 12 |
| 12 | **Exclusive Gateway** | Thanh toán online? | Kiểm tra phương thức thanh toán | → Task 13 (ONLINE) hoặc → Message 15 (CASH) |
| 13 | **User Task** | Nhập thông tin thẻ | Nhập thẻ tín dụng/ghi nợ qua Stripe | → Service Task 14 |
| 14 | **Service Task** | Xử lý thanh toán Stripe | Gọi Stripe API để charge thẻ | → Message 15 |
| 15 | **Send Task** | Gửi yêu cầu đặt lịch | Message Flow → System Pool | → Receive Task 24 |

#### POOL: System (Petties Platform)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 16 | **Receive Task** | Nhận yêu cầu đặt lịch | Message Flow từ Pet Owner | → Service Task 17 |
| 17 | **Service Task** | Tính giá dịch vụ | Base price + Distance fee (if HOME_VISIT) | → Service Task 18 |
| 18 | **Service Task** | Tạo Booking | Status = PENDING, payment_status = PAID/UNPAID | → Service Task 19 |
| 19 | **Service Task** | Giảm số slot còn lại | available_slots -= 1 cho slot đã chọn | → Send Task 20 |
| 20 | **Send Task** | Thông báo Clinic Manager | Push notification + Email → Clinic Manager | → Receive Task 21 |

#### POOL: Clinic Manager (Web Dashboard)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 21 | **Receive Task** | Nhận booking mới | Message Flow từ System: "Có booking mới cần gán bác sĩ" | → User Task 22 |
| 22 | **User Task** | Xem chi tiết booking | Xem: Pet, Owner, Service, Time, Notes | → User Task 23 |
| 23 | **User Task** | Gán bác sĩ | Chọn bác sĩ available trong ca làm việc | → Service Task (System) |

#### POOL: System (tiếp)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 24 | **Service Task** | Cập nhật Booking | Status: PENDING → ASSIGNED, vet_id = selected_vet | → Send Task 25 |
| 25 | **Send Task** | Thông báo Bác sĩ | Push notification → Vet: "Bạn có lịch hẹn mới" | → Receive Task 26 |

#### POOL: Vet (Mobile App / Web)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 26 | **Receive Task** | Nhận thông báo booking | Message Flow từ System | → User Task 27 |
| 27 | **User Task** | Xem chi tiết booking | Xem: Pet, Owner, Service, Time, Location, Notes | → Chuẩn bị thực hiện |

> 💡 **Lưu ý:** Vet KHÔNG có quyền Accept/Reject. Khi Manager gán Vet, booking tự động → CONFIRMED.

#### POOL: System (xử lý response từ Vet)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 24 | **Service Task** | Cập nhật Booking | Status: PENDING → CONFIRMED, vet_id = selected_vet | → Send Task 25 |
| 25 | **Send Task** | Thông báo Pet Owner + Vet | Push: "Lịch hẹn đã xác nhận" + "Bạn có lịch hẹn mới" | → End Event 26 |
| 26 | **End Event** | Booking Confirmed | Kết thúc thành công | - |

### 1.4 Exception Flows

#### 1.4.1 Pet Owner hủy booking (trước CONFIRMED)

| # | Element Type | Element Name | Description |
|---|--------------|--------------|-------------|
| E1 | **Boundary Event** (Interrupting) | Yêu cầu hủy | Attached to: Receive Task 24 (Pet Owner) |
| E2 | **Exclusive Gateway** | Payment online? | Kiểm tra đã thanh toán online chưa |
| E3 | **Service Task** | Hoàn tiền Stripe | Nếu PAID: gọi Stripe Refund API |
| E4 | **Service Task** | Khôi phục slot | available_slots += 1 |
| E5 | **Service Task** | Hủy booking | Status → CANCELLED |
| E6 | **Send Task** | Thông báo đã hủy | Notify: Pet Owner, Clinic Manager |
| E7 | **End Event** | Booking Cancelled | Kết thúc flow hủy |

#### 1.4.2 Reminder trước lịch hẹn

| # | Element Type | Element Name | Description |
|---|--------------|--------------|-------------|
| R1 | **Timer Event** | 24h trước lịch hẹn | Timer: appointmentTime - 24 hours |
| R2 | **Send Task** | Gửi nhắc nhở 24h | "Bạn có lịch hẹn vào ngày mai lúc X giờ" |
| R3 | **Timer Event** | 2h trước lịch hẹn | Timer: appointmentTime - 2 hours |
| R4 | **Send Task** | Gửi nhắc nhở 2h | "Lịch hẹn sẽ bắt đầu trong 2 giờ nữa" |

### 1.5 Message Flows (giữa các Pool)

| From | To | Message Name | Khi nào |
|------|-----|--------------|---------|
| Pet Owner | System | BookingRequest | Pet Owner submit đặt lịch |
| System | Clinic Manager | NewBookingNotification | Có booking mới cần xử lý |
| Clinic Manager | System | VetAssignment | Clinic Manager gán vet |
| System | Vet | AssignmentNotification | Vet được gán booking |
| System | Pet Owner | ConfirmationNotification | Booking được confirm |
| System | Pet Owner | CancellationNotification | Booking bị hủy |

### 1.6 Data Objects

| Data Object | Type | Description |
|-------------|------|-------------|
| BookingData | Input/Output | petId, serviceId, slotId, notes, paymentMethod |
| PaymentData | Input | cardNumber, expiry, cvv (Stripe handles) |
| AssignmentData | Input | vetId |
| NotificationData | Output | title, body, recipientId, channel (push/email/sms) |

---

## 2. BP-003 + BP-005: Medical Service + Review Process (Thăm khám và Đánh giá)

### 2.1 Thông tin chung

| Thuộc tính | Giá trị |
|------------|---------|
| **Process ID** | BP-003-005 |
| **Process Name** | Medical Service and Review Process |
| **Process Type** | Executable |
| **Pools** | 3 (Pet Owner, Vet, System) |
| **Start Event** | Booking ở trạng thái CONFIRMED, đến ngày hẹn |
| **End Events** | 2 (Service Completed, Review Submitted) |
| **Subprocess** | Vet Review (Immediate), Clinic Review (Delayed) |

### 2.2 Pools và Lanes

| Pool | Description | Platform |
|------|-------------|----------|
| **Pet Owner** | Chủ thú cưng | Mobile App |
| **Vet** | Bác sĩ thú y | Mobile App / Web |
| **System** | Petties Platform | Backend |

### 2.3 Process Flow - Medical Service

#### POOL: Pet Owner (Mobile App)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 1 | **Start Event** | Đến ngày hẹn | Booking status = CONFIRMED, đúng ngày appointment | → Task 2 |
| 2 | **User Task** | Đến phòng khám / Chờ bác sĩ | CLINIC_VISIT: Pet Owner đến phòng khám. HOME_VISIT: Chờ bác sĩ đến nhà | → Message → Vet |

#### POOL: Vet (Mobile App / Web)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 3 | **User Task** | Check-in bệnh nhân | Xác nhận Pet Owner đã đến, bắt đầu phiên khám | → Service Task (System) |

#### POOL: System

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 4 | **Service Task** | Cập nhật status CHECK_IN | Status: CONFIRMED → CHECK_IN, checkin_time = now() | → Send Task 5 |
| 5 | **Send Task** | Thông báo Pet Owner | "Bác sĩ đã check-in, phiên khám bắt đầu" | → Task 6 (Vet) |

#### POOL: Vet (tiếp tục khám)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 6 | **User Task** | Xem hồ sơ Pet | Xem: profile pet, lịch sử EMR cũ, sổ tiêm chủng | → Task 7 |
| 7 | **User Task** | Bắt đầu khám | Bắt đầu quy trình khám bệnh | → Service Task (System) |

#### POOL: System

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 8 | **Service Task** | Cập nhật status IN_PROGRESS | Status: CHECK_IN → IN_PROGRESS, start_time = now() | → Task 9 (Vet) |

#### POOL: Vet (ghi EMR)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 9 | **User Task** | Khám và chẩn đoán | Thực hiện khám, đánh giá tình trạng pet | → Task 10 |
| 10 | **User Task** | Ghi triệu chứng | Nhập symptoms vào EMR form | → Task 11 |
| 11 | **User Task** | Ghi chẩn đoán | Nhập diagnosis vào EMR form | → Task 12 |
| 12 | **User Task** | Tạo kế hoạch điều trị | Nhập treatment plan vào EMR form | → Gateway 13 |
| 13 | **Exclusive Gateway** | Cần đơn thuốc? | Bác sĩ quyết định có cần kê đơn không | → Task 14 (Yes) hoặc → Gateway 15 (No) |
| 14 | **User Task** | Ghi đơn thuốc | Nhập prescription: tên thuốc, liều lượng, hướng dẫn | → Gateway 15 |
| 15 | **Exclusive Gateway** | Cần tiêm chủng? | Bác sĩ quyết định có cập nhật sổ tiêm không | → Task 16 (Yes) hoặc → Task 17 (No) |
| 16 | **User Task** | Cập nhật tiêm chủng | Thêm record vaccination mới vào sổ tiêm | → Task 17 |
| 17 | **User Task** | Lưu EMR | Submit EMR form, lưu toàn bộ dữ liệu | → Service Task (System) |

#### POOL: System (Lưu EMR)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 18 | **Service Task** | Lưu EMR vào DB | Insert EMR record: symptoms, diagnosis, treatment, prescription, vet_notes | → Task 19 (Vet) |

#### POOL: Vet (Checkout)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 19 | **User Task** | Checkout bệnh nhân | Hoàn thành phiên khám | → Service Task (System) |

#### POOL: System (Xử lý checkout)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 20 | **Service Task** | Cập nhật status CHECK_OUT | Status: IN_PROGRESS → CHECK_OUT, checkout_time = now() | → Gateway 21 |
| 21 | **Exclusive Gateway** | Payment status? | Kiểm tra payment_status của booking | → Task 22 (UNPAID) hoặc → Task 24 (PAID) |
| 22 | **User Task** | Thu tiền mặt | Vet thu tiền từ Pet Owner | → Service Task 23 |
| 23 | **Service Task** | Cập nhật payment | payment_status: UNPAID → PAID, payment_method = CASH | → Task 24 |
| 24 | **Service Task** | Tạo hóa đơn | Generate digital receipt: services, price, payment info | → Service Task 25 |
| 25 | **Service Task** | Hoàn thành booking | Status: CHECK_OUT → COMPLETED | → Parallel Gateway 26 |
| 26 | **Parallel Gateway** | Fork | Chia thành 2 nhánh song song | → Send Task 27 AND → Subprocess 30 |
| 27 | **Send Task** | Thông báo Pet Owner | "Khám xong! Xem kết quả trong app" | → Task 28 |

#### POOL: Pet Owner (Nhận kết quả)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 28 | **User Task** | Xem hóa đơn | Mở notification → Xem digital receipt | → Task 29 |
| 29 | **User Task** | Xem kết quả EMR | Mở tab "Hồ sơ bệnh án" → Xem EMR mới | → Subprocess 30 |

### 2.4 Process Flow - Review (Subprocess)

#### 2.4.1 Vet Review (Immediate - như Grab)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 30 | **Start Event** (Subprocess) | Sau COMPLETED | Ngay sau khi booking COMPLETED | → Service Task 31 |
| 31 | **Service Task** | Hiển thị popup đánh giá | Show rating popup trên mobile app | → Gateway 32 |
| 32 | **Exclusive Gateway** | Pet Owner đánh giá? | Chờ 30 giây hoặc user action | → Task 33 (Rating) hoặc → Task 34 (Skip) |
| 33 | **User Task** | Chọn số sao cho Vet | Select 1-5 stars | → Service Task 35 |
| 34 | **User Task** | Bỏ qua đánh giá | Click Skip hoặc timeout | → Service Task 36 |
| 35 | **Service Task** | Lưu Vet Rating | Save: vet_rating = stars, vet_rated = true, tính lại vet average | → End Event 37 |
| 36 | **Service Task** | Đánh dấu không đánh giá | vet_rated = false | → End Event 37 |
| 37 | **End Event** | Vet Review Done | Kết thúc subprocess Vet Review | → Timer 38 |

#### 2.4.2 Clinic Review (Delayed - sau 24h)

| # | Element Type | Element Name | Description | Outgoing |
|---|--------------|--------------|-------------|----------|
| 38 | **Timer Event** (Non-Interrupting) | Chờ 24 giờ | Duration: PT24H (ISO 8601) | → Service Task 39 |
| 39 | **Service Task** | Gửi push notification | "Hãy đánh giá phòng khám [Clinic Name]" | → Gateway 40 |
| 40 | **Exclusive Gateway** | User mở app? | Kiểm tra user có mở notification không | → Task 41 (Yes) hoặc → Timer 42 (No) |
| 41 | **User Task** | Viết đánh giá phòng khám | Select 1-5 stars + Viết comment | → Service Task 43 |
| 42 | **Timer Event** | Reminder sau 72h | Nếu chưa review, gửi nhắc nhở lần 2 | → Service Task 44 |
| 43 | **Service Task** | Lưu Clinic Review | Save: clinic_rating, clinic_comment, clinic_reviewed = true | → Service Task 45 |
| 44 | **Service Task** | Gửi reminder lần 2 | Push notification nhắc nhở lần cuối | → End Event 46 |
| 45 | **Service Task** | Tính lại Rating trung bình | Cập nhật clinic.average_rating | → End Event 46 |
| 46 | **End Event** | Review Process Complete | Kết thúc toàn bộ flow | - |

### 2.5 Message Flows

| From | To | Message Name | Khi nào |
|------|-----|--------------|---------|
| Vet | System | CheckInRequest | Vet báo pet đã đến |
| Vet | System | StartExamRequest | Vet bắt đầu khám |
| Vet | System | EMRData | Vet submit EMR |
| Vet | System | CheckoutRequest | Vet kết thúc khám |
| System | Pet Owner | ServiceCompletedNotification | Booking COMPLETED |
| System | Pet Owner | VetRatingPopup | Yêu cầu đánh giá vet |
| Pet Owner | System | VetRatingSubmit | Submit rating vet |
| System | Pet Owner | ClinicReviewRequest | Yêu cầu đánh giá clinic (sau 24h) |
| Pet Owner | System | ClinicReviewSubmit | Submit review clinic |

### 2.6 Data Objects

| Data Object | Type | Description |
|-------------|------|-------------|
| EMRData | Input | symptoms, diagnosis, treatment_plan, prescription, vet_notes |
| VaccinationData | Input | vaccine_name, dose, date, next_due_date |
| ReceiptData | Output | booking_id, services, total_amount, payment_info |
| VetRatingData | Input | stars (1-5) |
| ClinicReviewData | Input | stars (1-5), comment (text) |

### 2.7 Timers

| Timer ID | Event Type | Duration/Date | Attached To |
|----------|------------|---------------|-------------|
| T1 | Duration | PT24H (24 hours) | After Vet Review completed |
| T2 | Duration | PT72H (72 hours) | If no clinic review after T1 |
| T3 | Duration | PT30S (30 seconds) | Vet rating popup timeout |

---

## 3. BPMN 2.0 Element Reference (Chi tiết đầy đủ)

Phần này giải thích **tất cả các elements** trong BPMN 2.0 để vẽ diagram chính xác.

---

### 3.1 EVENTS (Sự kiện)

Events đại diện cho một điều xảy ra trong quá trình. Tất cả events đều dùng hình **VÒNG TRÒN (Circle)**.

#### 3.1.1 Start Events (Sự kiện bắt đầu)

| Event Type | Shape | Marker | Mô tả | Ví dụ trong Petties |
|------------|-------|--------|-------|---------------------|
| **None Start** | Circle, thin border | Không có | Bắt đầu process đơn giản | "Bắt đầu đặt lịch" |
| **Message Start** | Circle, thin border | ✉️ envelope (outline) | Bắt đầu khi nhận message | "Nhận yêu cầu booking từ API" |
| **Timer Start** | Circle, thin border | ⏱ clock | Bắt đầu theo lịch/thời gian | "Chạy job backup hàng ngày" |
| **Signal Start** | Circle, thin border | △ triangle | Bắt đầu khi có signal | "Khi clinic được approve" |

**Đặc điểm Start Event:** Vòng tròn viền mảnh (~2px), không tô màu bên trong, đường kính ~30px.

#### 3.1.2 Intermediate Events (Sự kiện trung gian)

| Event Type | Shape | Marker | Mô tả | Ví dụ trong Petties |
|------------|-------|--------|-------|---------------------|
| **Message Catch** | Circle, double border | ✉️ envelope (outline) | Chờ nhận message | "Chờ Vet phản hồi" |
| **Message Throw** | Circle, double border | ✉️ envelope (filled) | Gửi message đi | "Gửi notification" |
| **Timer Catch** | Circle, double border | ⏱ clock | Chờ một khoảng thời gian | "Chờ 24h trước khi nhắc review" |
| **Signal Catch** | Circle, double border | △ triangle (outline) | Bắt signal | "Khi payment thành công" |
| **Signal Throw** | Circle, double border | △ triangle (filled) | Phát signal | "Broadcast booking confirmed" |

**Đặc điểm Intermediate Event:** Vòng tròn viền đôi (2 vòng lồng nhau), đường kính ~30px.

#### 3.1.3 End Events (Sự kiện kết thúc)

| Event Type | Shape | Marker | Mô tả | Ví dụ trong Petties |
|------------|-------|--------|-------|---------------------|
| **None End** | Circle, thick border | Không có | Kết thúc process bình thường | "Booking Confirmed" |
| **Message End** | Circle, thick border | ✉️ envelope (filled) | Kết thúc và gửi message | "Gửi email xác nhận + kết thúc" |
| **Terminate End** | Circle, thick border | ● large dot | Chấm dứt toàn bộ process | "Hủy tất cả nếu timeout" |
| **Error End** | Circle, thick border | ⚡ lightning | Kết thúc với lỗi | "Payment Failed" |

**Đặc điểm End Event:** Vòng tròn viền đậm (~4-5px), đường kính ~30px.

#### 3.1.4 Boundary Events (Sự kiện biên)

Attached vào Task, xử lý exception hoặc trigger trong quá trình task đang chạy.

| Event Type | Interrupting? | Border Style | Mô tả | Ví dụ |
|------------|---------------|--------------|-------|-------|
| **Timer Boundary** | Yes | Solid double | Interrupt task khi timeout | "Hủy nếu Vet không respond 2h" |
| **Timer Boundary** | No | Dashed double | Không interrupt, chạy song song | "Gửi reminder sau 1h" |
| **Message Boundary** | Yes | Solid double + ✉️ | Interrupt khi nhận message | "Hủy khi Pet Owner cancel" |
| **Error Boundary** | Always Yes | Solid double + ⚡ | Bắt lỗi từ task | "Catch payment error" |

**Vị trí:** Đặt ở viền (edge) của Task, nửa trong task và nửa ngoài task.

---

### 3.2 ACTIVITIES (Hoạt động)

Activities là các công việc được thực hiện trong process. Tất cả dùng hình **ROUNDED RECTANGLE** (hình chữ nhật bo góc).

#### 3.2.1 Tasks (Công việc đơn lẻ)

| Task Type | Marker Icon | Vị trí Marker | Ai thực hiện | Mô tả | Ví dụ trong Petties |
|-----------|-------------|---------------|--------------|-------|---------------------|
| **User Task** | 👤 person | Top-left corner | Con người | Người dùng thao tác trên UI (click, nhập form, select) | "Chọn dịch vụ", "Nhập chẩn đoán" |
| **Service Task** | ⚙️ gear | Top-left corner | Hệ thống | Hệ thống tự động xử lý (API call, DB query, tính toán) | "Tính giá", "Lưu vào DB" |
| **Send Task** | ✉️ filled envelope | Top-left corner | Hệ thống | Gửi message/notification đi (không chờ response) | "Gửi push notification" |
| **Receive Task** | ✉️ outline envelope | Top-left corner | Hệ thống | Chờ nhận message (blocking until received) | "Nhận booking request" |
| **Script Task** | 📜 script | Top-left corner | Hệ thống | Chạy script/code tự động | "Validate input data" |
| **Manual Task** | ✋ hand | Top-left corner | Con người | Làm thủ công offline (không có hệ thống hỗ trợ) | "In giấy xác nhận" |
| **Business Rule Task** | 📊 table | Top-left corner | Hệ thống | Áp dụng business rule/decision table | "Kiểm tra refund policy" |

**Đặc điểm Task:**
- Shape: Rounded rectangle (~100-150px x 50-80px)
- Border-radius: ~10px
- Border: 2px solid black
- Background: white hoặc màu nhạt
- Marker: Icon ở góc trên trái
- Text: Tên task căn giữa

#### 3.2.2 Sub-Process (Tiến trình con)

| Type | Border Style | Marker | Mô tả |
|------|--------------|--------|-------|
| **Embedded Sub-Process** | Solid rounded rect | ⊕ (plus in circle) ở bottom-center | Process con chứa bên trong, có thể expand để xem chi tiết |
| **Call Activity** | Thick solid border | Không có | Gọi/reference một process đã định nghĩa sẵn |
| **Event Sub-Process** | Dashed rounded rect | Không có | Sub-process được trigger bởi event (start event bên trong) |

---

### 3.3 GATEWAYS (Cổng quyết định)

Gateways kiểm soát luồng đi (flow control). Tất cả dùng hình **DIAMOND** (hình thoi).

| Gateway Type | Marker | Mô tả | Logic tương đương | Khi nào dùng |
|--------------|--------|-------|-------------------|--------------|
| **Exclusive (XOR)** | ✕ hoặc empty | Chỉ 1 đường được chọn | `if-else` | "Thanh toán online hay cash?" |
| **Parallel (AND)** | ➕ plus | Tất cả các đường chạy song song | `fork/join threads` | "Gửi email VÀ push notification" |
| **Inclusive (OR)** | ◯ circle | Một hoặc nhiều đường | `if` với multiple conditions | "Gửi SMS và/hoặc Email" |
| **Event-based** | ⬠ pentagon | Chờ event nào đến trước | `race condition` | "Manager assign hoặc timeout 2h" |
| **Complex** | ✳ asterisk | Logic phức tạp tùy chỉnh | Complex conditions | Hiếm dùng |

**Đặc điểm Gateway:**
- Shape: Diamond (rotated square), ~40-50px mỗi cạnh
- Border: 2px solid black
- Background: white
- Marker: Icon ở center

**Lưu ý:**
- **Fork Gateway**: 1 input, nhiều outputs (chia nhánh)
- **Join Gateway**: Nhiều inputs, 1 output (hợp nhánh)
- Parallel Gateway cần cả Fork và Join để đảm bảo tất cả paths hoàn thành

---

### 3.4 SWIMLANES (Pools & Lanes)

Phân chia trách nhiệm giữa các participants.

#### 3.4.1 Pool

| Property | Description |
|----------|-------------|
| **Shape** | Large horizontal rectangle |
| **Header** | Pool name (participant/organization) ở bên trái hoặc trên |
| **Content** | Chứa toàn bộ process flow của participant đó |
| **Communication** | Pools khác nhau giao tiếp bằng Message Flow |

**Ví dụ Pools trong Petties:** Pet Owner, System, Clinic Manager, Vet

#### 3.4.2 Lane

| Property | Description |
|----------|-------------|
| **Shape** | Horizontal stripe bên trong Pool |
| **Purpose** | Chia Pool thành các roles/departments |
| **Header** | Lane name (role) ở bên trái |

**Ví dụ:** Pool "Clinic" có thể chia thành Lane "Manager" và Lane "Vet"

#### 3.4.3 Petties Pools Configuration

| Pool | Description | Platform | Color (recommended) |
|------|-------------|----------|---------------------|
| Pet Owner | Chủ thú cưng - khách hàng | Mobile App | Blue (#4285F4) |
| System | Petties Platform - xử lý tự động | Backend | Gray (#E0E0E0) |
| Clinic Manager | Quản lý phòng khám | Web Dashboard | Green (#34A853) |
| Vet | Bác sĩ thú y | Mobile App / Web | Orange (#FBBC05) |
| Admin | Quản trị viên nền tảng | Web Dashboard | Red (#EA4335) |

---

### 3.5 CONNECTING OBJECTS (Đường nối)

| Type | Line Style | Arrow | Mô tả | Khi nào dùng |
|------|------------|-------|-------|--------------|
| **Sequence Flow** | Solid line | Filled arrowhead | Thứ tự thực hiện các bước | Giữa elements trong CÙNG Pool |
| **Message Flow** | Dashed line | Open arrowhead + circle at start | Giao tiếp giữa participants | Giữa elements ở KHÁC Pool |
| **Association** | Dotted line | No arrowhead | Liên kết annotation/data | Gắn Data Object hoặc Annotation vào element |
| **Data Association** | Dotted line | Open arrowhead | Luồng dữ liệu input/output | Chỉ hướng data flow vào/ra Task |

**Quan trọng:**
- Sequence Flow: Chỉ dùng trong cùng 1 Pool
- Message Flow: Bắt buộc dùng khi nối giữa 2 Pool khác nhau
- Không được dùng Sequence Flow xuyên Pool

---

### 3.6 ARTIFACTS (Đối tượng bổ sung)

| Artifact | Shape | Mô tả | Ví dụ trong Petties |
|----------|-------|-------|---------------------|
| **Data Object** | Document shape (rectangle with folded corner) | Dữ liệu input/output của Task | BookingData, EMRData, PaymentData |
| **Data Store** | Cylinder shape | Database hoặc persistent storage | PostgreSQL, MongoDB, Qdrant |
| **Annotation** | Open rectangle with text | Ghi chú giải thích thêm | "Gọi Stripe API v2", "Timeout 30s" |
| **Group** | Dashed rectangle | Nhóm các elements liên quan (visual only) | "Payment Section", "EMR Recording" |

---

### 3.7 COLOR CODING (Khuyến nghị cho Petties)

#### Pool Colors

| Pool | Fill Color | Hex Code |
|------|------------|----------|
| Pet Owner | Light Blue | #E3F2FD |
| System | Light Gray | #F5F5F5 |
| Clinic Manager | Light Green | #E8F5E9 |
| Vet | Light Orange | #FFF3E0 |
| Admin | Light Red | #FFEBEE |

#### Element Colors

| Element Type | Fill Color | Border Color |
|--------------|------------|--------------|
| User Task | Light Blue (#E3F2FD) | Blue (#1976D2) |
| Service Task | Light Gray (#F5F5F5) | Gray (#616161) |
| Send/Receive Task | Light Yellow (#FFF9C4) | Orange (#FF9800) |
| Gateway | White (#FFFFFF) | Black (#000000) |
| Events | White (#FFFFFF) | Black (#000000) |
| Sub-Process | Light Purple (#F3E5F5) | Purple (#7B1FA2) |

---

### 3.8 Hướng dẫn vẽ trên Draw.io

#### Bước 1: Tạo file mới
1. Mở [draw.io](https://app.diagrams.net/)
2. File → New Diagram
3. Chọn template: **Software → BPMN**

#### Bước 2: Thêm BPMN Shape Library
1. Click **+ More Shapes** (góc dưới trái)
2. Tìm và enable: **BPMN General**, **BPMN Gateways**, **BPMN Events**

#### Bước 3: Tạo Pools
1. Kéo **Pool** từ panel BPMN vào canvas
2. Double-click để đổi tên Pool
3. Click vào Pool → Right-click → **Add Lane** để thêm lanes (nếu cần)

#### Bước 4: Thêm Elements
1. Kéo các shapes (Task, Event, Gateway) vào đúng Lane
2. Double-click element để đổi tên

#### Bước 5: Nối các Elements
1. Dùng **Sequence Flow** (mũi tên liền) nối trong cùng Pool
2. Dùng **Message Flow** (mũi tên đứt) nối giữa các Pools

#### Bước 6: Thêm Markers cho Tasks
1. Select Task → Format Panel (bên phải) → Style
2. Hoặc Right-click → Edit Style
3. Thêm marker phù hợp:
   - User Task: `shape=bpmn.task;taskMarker=user;`
   - Service Task: `shape=bpmn.task;taskMarker=service;`
   - Send Task: `shape=bpmn.task;taskMarker=send;`

#### Bước 7: Export
1. File → Export as → PNG/SVG/PDF
2. Upload lên GitHub (drag & drop vào Issues để get URL)
3. Copy URL và dán vào documentation với format: `<img src="URL" alt="Diagram Name" />`

---

**Document Status:** Ready for Review  
**Last Updated:** 2025-12-18
