# 📱 Mobile Development Guide

Hướng dẫn phát triển và chạy Petties Mobile App (Flutter).

---

## 🌍 Environments

Mobile app hỗ trợ 3 environments thông qua flavor:

| Environment | Flavor | API URL | AI Service URL |
|-------------|--------|---------|----------------|
| **Dev** | `dev` | `http://10.0.2.2:8080/api` | `http://10.0.2.2:8000` |
| **Staging/Test** | `staging` | `https://api-test.petties.world/api` | `https://ai-test.petties.world` |
| **Prod** | `prod` | `https://api.petties.world/api` | `https://ai.petties.world` |

> **Lưu ý**: `10.0.2.2` là alias cho localhost khi chạy Android emulator

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
# Chạy với local backend (localhost:8080)
flutter run --flavor dev --dart-define=FLAVOR=dev
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
- Dùng IP máy host thay vì localhost (ví dụ: `192.168.1.100`)
- Cần sửa URL trong code hoặc tạo flavor riêng

### iOS Simulator
- iOS simulator có thể dùng `localhost` trực tiếp
- Cần macOS và Xcode để build

---

## 📚 Tài liệu liên quan

- [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) - Git workflow & environments
- [TEST_ENVIRONMENT_SETUP.md](../deployment/TEST_ENVIRONMENT_SETUP.md) - Setup test environment

---

**Last Updated:** December 16, 2025
