# 📱 Mobile Development Guide

Hướng dẫn phát triển và chạy Petties Mobile App (Flutter).

---

## 🌍 Environments

Mobile app hỗ trợ 3 environments thông qua flavor:

| Environment | Flavor | API URL | AI Service URL |
|-------------|--------|---------|----------------|
| **Dev** | `dev` | `http://10.0.2.2:8080/api` | `http://10.0.2.2:8000` |
| **Staging/Test** | `staging` | `https://api-test.petties.world/api` | `https://api-test.petties.world/ai` |
| **Prod** | `prod` | `https://api.petties.world/api` | `https://ai.petties.world` |

> **Lưu ý**: 
> - `10.0.2.2` là alias cho localhost khi chạy Android emulator
> - Test environment dùng path-based routing (`/api`, `/ai`) trên cùng 1 domain


---

## 🚀 Commands

### 1. Setup ban đầu
```bash
cd petties_mobile
flutter pub get
```

### 2. Chạy app

#### Development (Local Backend)
```bash
# 1. Chạy trên Emulator (mặc định dùng 10.0.2.2)
flutter run --flavor dev --dart-define=FLAVOR=dev

# 2. Chạy trên Thiết bị thật qua USB (Khuyên dùng - Ổn định nhất)
# B1: Mở terminal chạy: adb reverse tcp:8080 tcp:8080
# B2: Chạy lệnh dưới (dùng localhost)
adb reverse tcp:8080 tcp:8080
flutter run --flavor dev --dart-define=FLAVOR=dev --dart-define=API_URL=http://localhost:8080/api

flutter run --flavor dev --dart-define=FLAVOR=dev --dart-define=API_URL=http://localhost:8080/api --dart-define=WS_URL=ws://localhost:8080/ws

# 3. Chạy trên Thiết bị thật qua LAN/Wifi (Khuyên dùng - Không cần cắm cáp USB)
# Cách này giúp bạn không cần chạy `adb reverse` mỗi lần.

# B1: Tìm IP LAN của máy tính
# - Windows: Mở Terminal gõ `ipconfig` -> Tìm IPv4 Address (ví dụ: 192.168.1.15)
# - macOS: Mở Terminal gõ `ifconfig | grep "inet " | grep -v 127.0.0.1`

# B2: Cập nhật file `.env` trong thư mục `petties_mobile`
# API_BASE_URL=http://192.168.1.15:8080

# B3: Chạy ứng dụng (Máy tính và điện thoại phải chung Wifi)
flutter run --flavor dev
```

#### Staging/Test Environment (api-test.petties.world)
```bash
# Chạy với test backend
flutter run --flavor staging --dart-define=FLAVOR=staging
```

#### Production (api.petties.world)
```bash
# Chạy với production backend
flutter run --flavor prod --dart-define=FLAVOR=prod
```
flutter run --dart-define=SENTRY_DSN=https://DAN_DSN_MOD_BAN_VUA_COPY_O_BUOC_1 --dart-define=ENVIRONMENT=development
### 3. Build APK

```bash
# Dev build (debug)
flutter build apk --debug --flavor dev --dart-define=FLAVOR=dev

# Staging/Test build (debug)
flutter build apk --debug --flavor staging --dart-define=FLAVOR=staging

# Production build (release)
flutter build apk --release --flavor prod --dart-define=FLAVOR=prod
```

### 4. Build iOS

```bash
# Cần macOS với Xcode
flutter build ios --flavor prod --dart-define=FLAVOR=prod
```

### 5. Tests

```bash
flutter test
```

---

## 📋 Quick Reference

| Mục đích | Command |
|----------|---------|
| Cài dependencies | `flutter pub get` |
| Chạy dev (local) | `flutter run --flavor dev --dart-define=FLAVOR=dev` |
| Chạy staging/test env | `flutter run --flavor staging --dart-define=FLAVOR=staging` |
| Chạy production | `flutter run --flavor prod --dart-define=FLAVOR=prod` |
| Build APK release | `flutter build apk --release --flavor prod --dart-define=FLAVOR=prod` |
| Run tests | `flutter test` |

---

## 🔧 Troubleshooting

### Android Emulator không kết nối được localhost
- **Nguyên nhân**: Android emulator dùng `10.0.2.2` thay vì `localhost`
- **Fix**: Đảm bảo backend đang chạy local và dùng `--dart-define=FLAVOR=dev`

### Physical device không kết nối được
- **Nguyên nhân**: Máy thật không hiểu `localhost` hoặc `10.0.2.2`.
- **Fix**: Cập nhật IP LAN vào file `.env` (Xem mục 3 bên trên) và đảm bảo chung Wifi.

### iOS Simulator & Physical Device (iPhone/iPad)

#### 1. Chạy trên Simulator
- iOS simulator có thể dùng `localhost` trực tiếp.
- Chỉ cần chạy lệnh: `flutter run --flavor dev`

#### 2. Chạy trên thiết bị thật (Không cần tài khoản Apple Developer 99$)
Bạn có thể dùng tính năng **Personal Team** (miễn phí) của Xcode để cài app lên iPhone của mình.

**Bước 1: Cấu hình Signing trong Xcode**
1. Mở file `ios/Runner.xcworkspace` bằng Xcode.
2. Chọn project **Runner** ở cột bên trái -> Chọn target **Runner**.
3. Chọn thẻ **Signing & Capabilities**.
4. Nhấn **Add Account...** và đăng nhập Apple ID miễn phí của bạn.
5. Ở mục **Team**, chọn **[Tên Bạn] (Personal Team)**.
6. Thay đổi **Bundle Identifier** nếu cần (ví dụ thêm đuôi `.dev` hoặc tên bạn) để tránh trùng lặp.

**Bước 2: Tin cậy ứng dụng trên iPhone**
1. Kết nối iPhone vào máy Mac.
2. Trên Xcode, chọn thiết bị của bạn ở thanh trên cùng và bấm nút **Run** (Play icon) hoặc chạy lệnh Terminal:
   ```bash
   flutter run --flavor dev
   ```
3. Lần đầu cài đặt, app sẽ không mở được.
4. Trên iPhone, vào **Settings (Cài đặt) > General (Cài đặt chung) > VPN & Device Management (Quản lý VPN & Thiết bị)**.
5. Chọn Apple ID của bạn ở mục **Developer App** và nhấn **Trust (Tin cậy)**.

**Lưu ý:**
- Chứng chỉ miễn phí (Free Provisioning Profile) chỉ tồn tại trong **7 ngày**. Sau 7 ngày bạn cần build lại để gia hạn.
- Bạn chỉ cài được tối đa 3 app sỡ hữu bởi Personal Team trên thiết bị.

---

## 📚 Tài liệu liên quan

- [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) - Git workflow & environments
- [TEST_ENVIRONMENT_SETUP.md](../deployment/TEST_ENVIRONMENT_SETUP.md) - Setup test environment

---

**Last Updated:** December 16, 2025
