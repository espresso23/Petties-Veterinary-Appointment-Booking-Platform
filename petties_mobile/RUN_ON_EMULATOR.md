# Hướng Dẫn Chạy Flutter App Trên Emulator

## 1. Kiểm Tra Emulator Đã Cài Đặt

### Android Emulator:
```bash
flutter doctor
```

Nếu chưa có emulator, cài đặt Android Studio và tạo AVD (Android Virtual Device).

### iOS Simulator (chỉ trên macOS):
```bash
open -a Simulator
```

---

## 2. Liệt Kê Các Emulator/Device Có Sẵn

```bash
flutter devices
```

Kết quả sẽ hiển thị:
```
3 connected devices:

sdk gphone64 arm64 (mobile) • emulator-5554 • android-arm64  • Android 13 (API 33) (emulator)
iPhone 15 Pro (mobile)     • 12345678-1234-1234-1234-123456789012 • ios • com.apple.CoreSimulator.SimRuntime.iOS-17-0 (simulator)
Chrome (web)               • chrome • web-javascript • Google Chrome 120.0.6099.109
```

---

## 3. Chạy App Trên Emulator

### A. Chạy trên Android Emulator:

**Bước 1: Khởi động Android Emulator**
- Mở Android Studio → Tools → Device Manager
- Click ▶️ để start emulator
- Hoặc chạy lệnh:
```bash
emulator -avd <AVD_NAME>
```

**Bước 2: Chạy Flutter app**
```bash
cd petties_mobile
flutter run
```

Hoặc chỉ định device cụ thể:
```bash
flutter run -d emulator-5554
```

### B. Chạy trên iOS Simulator (macOS only):

**Bước 1: Khởi động iOS Simulator**
```bash
open -a Simulator
```

**Bước 2: Chạy Flutter app**
```bash
cd petties_mobile
flutter run
```

Hoặc chỉ định device:
```bash
flutter run -d "iPhone 15 Pro"
```

---

## 4. Cấu Hình Base URL Cho Emulator

### Android Emulator:
- **Localhost của máy tính** = `10.0.2.2` trong Android emulator
- Sửa trong `lib/config/constants/app_constants.dart`:
```dart
static const String baseUrl = 'http://10.0.2.2:8080/api';
```

### iOS Simulator:
- **Localhost** hoạt động bình thường
- Giữ nguyên:
```dart
static const String baseUrl = 'http://localhost:8080/api';
```

### Thiết Bị Thật:
- Cần dùng **IP của máy tính** (không phải localhost)
- Tìm IP máy tính:
  - **Windows**: `ipconfig` → tìm IPv4 Address
  - **macOS/Linux**: `ifconfig` hoặc `ip addr`
- Ví dụ: `http://192.168.1.100:8080/api`

---

## 5. Các Lệnh Hữu Ích

### Hot Reload (sau khi app đã chạy):
- Nhấn `r` trong terminal
- Hoặc click nút Hot Reload trong IDE

### Hot Restart:
- Nhấn `R` (chữ hoa) trong terminal

### Stop App:
- Nhấn `q` trong terminal

### Xem Logs:
```bash
flutter logs
```

### Build APK (Android):
```bash
flutter build apk
```

### Build IPA (iOS):
```bash
flutter build ios
```

---

## 6. Troubleshooting

### Lỗi: "No devices found"
**Giải pháp:**
```bash
# Kiểm tra devices
flutter devices

# Nếu không thấy emulator, khởi động lại:
# Android: Mở Android Studio → Device Manager → Start emulator
# iOS: open -a Simulator
```

### Lỗi: "Connection refused" khi gọi API
**Giải pháp:**
1. Kiểm tra backend đã chạy chưa:
```bash
curl http://localhost:8080/api/actuator/health
```

2. Đổi base URL trong `app_constants.dart`:
   - Android emulator: `http://10.0.2.2:8080/api`
   - iOS simulator: `http://localhost:8080/api`
   - Thiết bị thật: `http://<YOUR_IP>:8080/api`

### Lỗi: "Unable to locate Android SDK"
**Giải pháp:**
```bash
flutter doctor --android-licenses
flutter doctor
```

### Lỗi: "CocoaPods not installed" (iOS)
**Giải pháp:**
```bash
sudo gem install cocoapods
cd ios
pod install
```

---

## 7. Test Authentication Flow

1. **Start Backend:**
```bash
cd backend-spring/petties
mvn spring-boot:run
```

2. **Start Flutter App:**
```bash
cd petties_mobile
flutter run
```

3. **Test Login:**
   - Mở app → Thấy màn hình Login
   - Nhập username: `petowner1`
   - Nhập password: `123456` (hoặc password bạn đã tạo)
   - Click "Đăng nhập"
   - Nếu thành công → Redirect đến HomeScreen
   - Thấy card xanh với thông tin user

4. **Test Logout:**
   - Click icon user ở AppBar
   - Click "Đăng xuất"
   - Quay về Login screen

---

## 8. Debug Tips

### Xem Network Requests:
- Mở DevTools: `flutter pub global activate devtools`
- Chạy: `flutter pub global run devtools`
- Hoặc trong VS Code: F5 → Chọn "Dart & Flutter"

### Xem Logs Trong Code:
```dart
import 'package:logger/logger.dart';

final logger = Logger();
logger.d('Debug message');
logger.e('Error message');
```

### Check Storage:
```dart
import 'package:shared_preferences/shared_preferences.dart';

final prefs = await SharedPreferences.getInstance();
print('Access Token: ${prefs.getString('access_token')}');
```

---

## 9. Quick Start Commands

```bash
# 1. Check devices
flutter devices

# 2. Run on specific device
flutter run -d <device_id>

# 3. Run on first available device
flutter run

# 4. Hot reload (sau khi app chạy)
# Nhấn 'r' trong terminal

# 5. Hot restart
# Nhấn 'R' trong terminal

# 6. Quit
# Nhấn 'q' trong terminal
```

---

## 10. Recommended Setup

### Android Studio:
1. Cài đặt Android Studio
2. Cài đặt Android SDK
3. Tạo AVD (Android Virtual Device):
   - Tools → Device Manager → Create Device
   - Chọn device (ví dụ: Pixel 5)
   - Chọn system image (API 33 recommended)
   - Finish

### VS Code:
1. Cài đặt extension "Flutter"
2. Cài đặt extension "Dart"
3. Cấu hình launch.json (tự động tạo khi debug)

---

Chúc bạn test thành công! 🚀

