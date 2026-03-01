# Báo cáo kiểm tra UI Mobile sau merge

**Ngày kiểm tra:** 2026-02-28

## 1. Router & màn hình đã nối đúng

Các route trong `lib/routing/router_config.dart` đều trỏ tới file tồn tại và import đúng:

| Nhóm | Màn hình | File | Ghi chú |
|------|----------|------|--------|
| Auth | Login, Register, Forgot/Reset Password | `ui/auth/*` | OK |
| Onboarding | OnboardingScreen | `ui/onboarding/onboarding_screen.dart` | OK |
| Pet Owner | PetOwnerHomeScreen | `ui/pet_owner/pet_owner_home_screen.dart` | OK |
| Staff | StaffHome, Schedule, Bookings, BookingDetail, AddService | `ui/staff/*` | OK |
| Staff | Patient list, VaccinationForm, CreateEmr, EmrDetail, EditEmr | `ui/staff/patient/*`, `ui/staff/emr/*` | OK |
| Clinic | Search, Detail, Map, AllServices | `ui/clinics/*` | OK |
| Booking flow | SelectPet, SelectServices, DateTime, Confirm, Success | `ui/booking/*` | OK |
| Booking detail | `/bookings/detail` (extra: booking) | AppointmentDetailScreen trong `booking_detail_screen.dart` | OK – dùng từ My Bookings |
| Profile | Profile, EditProfile, ChangePassword | `ui/screens/profile/*` | OK |
| Pet | List, Add/Edit, Detail, HealthRecord | `ui/pet/*` | OK |
| Notification | NotificationListScreen | `ui/screens/notification/*` | OK |
| Chat | ChatList, ChatDetail | `ui/chat/*` | OK |
| SOS | Request, RadarMap (SosMatching), Tracking | `ui/booking/sos_*.dart` | OK |

Không có lỗi biên dịch do thiếu file hoặc sai import.

---

## 2. Màn hình / luồng có thể thiếu hoặc chưa nối

### 2.1 ChangeEmailScreen (Hủy yêu cầu thay đổi Email)

- **File:** `lib/ui/screens/profile/change_email_screen.dart` – tồn tại.
- **Vấn đề:** Không có route trong `router_config.dart` và không thấy nơi nào trong Profile (profile_screen, edit_profile_screen) gọi hoặc navigate tới `ChangeEmailScreen`.
- **Gợi ý:** Thêm route (ví dụ `/profile/change-email`) và một entry point từ màn Profile (ví dụ mục “Thay đổi email” hoặc “Hủy yêu cầu thay đổi email”) mở `ChangeEmailScreen`.

### 2.2 WriteReviewScreen

- **File:** `lib/ui/booking/write_review_screen.dart` – tồn tại.
- **Luồng:** Được mở từ `my_bookings_tab.dart` bằng `Navigator.push(..., WriteReviewScreen(booking: booking))` – không cần route riêng.
- **Kết luận:** Không thiếu; UI đã nối đúng.

### 2.3 AppRoutes.bookingDetails (`/booking/:id`)

- **Định nghĩa:** Có trong `app_routes.dart` (`bookingDetails = '/booking/:id'`).
- **Router:** Không có `GoRoute` tương ứng trong `router_config.dart`.
- **Thực tế:** Chi tiết booking Pet Owner đang dùng `/bookings/detail` với `extra: booking`.
- **Kết luận:** Có thể là route cũ/chưa dùng; không ảnh hưởng luồng hiện tại. Nếu sau này cần “mở booking theo id” (deep link, notification) thì nên thêm route này.

---

## 3. Flutter analyze

- **Lệnh:** `flutter analyze --no-fatal-infos`
- **Kết quả:** 215 issues (info + warning), **không có error**.
- **Nội dung chủ yếu:** Deprecated (`withOpacity`, …), naming, unused local/field – không phải thiếu UI hay broken reference sau merge.

---

## 4. Tóm tắt

- Các thành phần UI mobile dùng trong router đều tồn tại và không bị missing sau merge.
- Cần bổ sung: **điểm vào (navigation) cho ChangeEmailScreen** từ Profile (và có thể thêm route).
- WriteReviewScreen và luồng booking detail đã nối đúng; route `bookingDetails` có thể bỏ hoặc thêm sau tùy product.
