# Flavors Configuration Guide

Hướng dẫn cấu hình và sử dụng Flavors cho Petties Mobile App để phân biệt môi trường Development và Production.

---

## 📋 Tổng quan

Flavors cho phép tạo nhiều build variants với cấu hình khác nhau:
- **Dev**: Sử dụng URL localhost/emulator (`http://10.0.2.2:8080/api`)
- **Prod**: Sử dụng URL production (`https://api.petties.world/api`)

---

## 🏗️ Cấu trúc

### Environment Configuration

File `lib/config/env/environment.dart` đọc flavor từ build arguments:

```dart
static const String _flavor = String.fromEnvironment('FLAVOR', defaultValue: 'dev');
```

### Android Flavors

Được cấu hình trong `android/app/build.gradle.kts`:

- **dev**: 
  - Application ID: `world.petties.mobile` (không có suffix)
  - App Name: "Petties Dev"
  - Version Suffix: `-dev`
  - Dùng cho: Test trên emulator với localhost
  
- **prod**:
  - Application ID: `world.petties.mobile`
  - App Name: "Petties"
  - Dùng cho: Release app lên Play Store/App Store

> **Lưu ý**: Cả dev và prod đều dùng cùng Application ID vì chỉ release prod, dev chỉ test trên emulator.

### iOS Bundle Identifier

- Bundle Identifier: `world.petties.mobile`
- Cấu hình trong `ios/Runner.xcodeproj/project.pbxproj`

---

## 🚀 Cách sử dụng

### Development Mode (Emulator/Local)

```bash
# Chạy app với dev flavor
flutter run --flavor dev --dart-define=FLAVOR=dev

# Build APK dev (Android)
flutter build apk --flavor dev --dart-define=FLAVOR=dev

# Build iOS dev (requires Xcode)
flutter build ios --flavor dev --dart-define=FLAVOR=dev

# Build App Bundle dev (cho Play Store testing)
flutter build appbundle --flavor dev --dart-define=FLAVOR=dev
```

### Production Mode

```bash
# Chạy app với prod flavor
flutter run --flavor prod --dart-define=FLAVOR=prod

# Build APK production (Android)
flutter build apk --release --flavor prod --dart-define=FLAVOR=prod

# Build iOS production (requires Xcode, for App Store)
flutter build ios --release --flavor prod --dart-define=FLAVOR=prod

# Build App Bundle production (cho Play Store)
flutter build appbundle --release --flavor prod --dart-define=FLAVOR=prod
```

---

## 🔧 URL Configuration

### Development URLs
- **API Base URL**: `http://10.0.2.2:8080/api`
- **AI Service URL**: `http://10.0.2.2:8000`

> **Lưu ý**: `10.0.2.2` là địa chỉ localhost khi chạy trên Android emulator. 
> - Android emulator: `10.0.2.2` = `localhost` của máy host
> - iOS simulator: dùng `localhost` trực tiếp
> - Thiết bị thật: dùng IP máy host (ví dụ: `192.168.1.100`)

### Production URLs
- **API Base URL**: `https://api.petties.world/api`
- **AI Service URL**: `https://ai.petties.world`

---

## 📱 Android Emulator vs iOS Simulator

### Android Emulator
```dart
// environment.dart
static const String _devBaseUrl = 'http://10.0.2.2:8080/api';
```
- Android emulator sử dụng `10.0.2.2` để truy cập localhost của máy host
- Port mapping: `10.0.2.2:8080` → `localhost:8080` trên máy host

### iOS Simulator
- iOS simulator có thể dùng `localhost` trực tiếp
- Nếu cần, có thể thêm flavor riêng cho iOS hoặc dùng platform check

### Thiết bị thật (Physical Device)
- Cần dùng IP của máy host thay vì `10.0.2.2`
- Ví dụ: `http://192.168.1.100:8080/api` (thay `192.168.1.100` bằng IP máy bạn)

---

## 🎯 Build Commands Reference

### Development

#### Android
```bash
# Run on connected device/emulator
flutter run --flavor dev --dart-define=FLAVOR=dev

# Run on specific device
flutter run -d <device_id> --flavor dev --dart-define=FLAVOR=dev

# Build debug APK
flutter build apk --debug --flavor dev --dart-define=FLAVOR=dev

# Build release APK (for testing)
flutter build apk --release --flavor dev --dart-define=FLAVOR=dev

# Build App Bundle (for testing)
flutter build appbundle --flavor dev --dart-define=FLAVOR=dev
```

#### iOS
```bash
# Run on iOS Simulator/Device
flutter run --flavor dev --dart-define=FLAVOR=dev

# Build iOS (Debug/Development)
flutter build ios --flavor dev --dart-define=FLAVOR=dev

# Build iOS (Release, for testing)
flutter build ios --release --flavor dev --dart-define=FLAVOR=dev
```

### Production

#### Android
```bash
# Run production flavor (for testing)
flutter run --flavor prod --dart-define=FLAVOR=prod

# Build release APK
flutter build apk --release --flavor prod --dart-define=FLAVOR=prod

# Build App Bundle (for Play Store)
flutter build appbundle --release --flavor prod --dart-define=FLAVOR=prod
```

#### iOS
```bash
# Run production flavor (for testing)
flutter run --flavor prod --dart-define=FLAVOR=prod

# Build iOS (Release, for App Store)
flutter build ios --release --flavor prod --dart-define=FLAVOR=prod

# Build iOS IPA (for distribution, requires Xcode archive)
# Sau khi build ios, mở Xcode và archive:
# cd ios && xcodebuild -workspace Runner.xcworkspace -scheme Runner -configuration Release-$(FLAVOR) -archivePath build/Runner.xcarchive archive
```

---

## 🔍 Kiểm tra Flavor đang sử dụng

Trong code, bạn có thể kiểm tra flavor hiện tại:

```dart
import 'package:petties_mobile/config/env/environment.dart';

// Kiểm tra flavor
print('Current flavor: ${Environment.flavor}');
print('Is production: ${Environment.isProduction}');
print('API URL: ${Environment.baseUrl}');
```

Hoặc trong API Interceptor (đã có logging):

```dart
_logger.i('[API Configuration]');
_logger.i('  Flavor: ${Environment.flavor}');
_logger.i('  Environment: ${Environment.isProduction ? "PRODUCTION" : "DEVELOPMENT"}');
_logger.i('  Base URL: ${Environment.baseUrl}');
```

---

## ⚠️ Lưu ý quan trọng

1. **Luôn truyền cả 2 flags**: `--flavor` và `--dart-define=FLAVOR`
   - `--flavor`: Cấu hình Android/iOS build variants
   - `--dart-define=FLAVOR`: Truyền giá trị vào Dart code

2. **Android Emulator vs Physical Device**:
   - Emulator: `10.0.2.2:8080`
   - Physical device: IP máy host (ví dụ: `192.168.1.100:8080`)

3. **Không được commit các file build**:
   - Các file APK/AAB/IPA không được commit vào git
   - Chỉ commit source code và config files

4. **CI/CD Integration**:
   - Trong CI/CD, luôn build với `--flavor prod --dart-define=FLAVOR=prod`
   - Đảm bảo signing config đã được setup cho production builds

5. **iOS Build Requirements**:
   - **Xcode**: Cần cài Xcode và command line tools
   - **CocoaPods**: `cd ios && pod install` (chạy lần đầu hoặc sau khi thay đổi dependencies)
   - **Signing**: Cần cấu hình signing trong Xcode cho production builds
   - **Archive**: Build iOS chỉ tạo file, cần archive qua Xcode để tạo IPA cho App Store

---

## 📚 Tài liệu liên quan

- [Flutter Flavors Documentation](https://docs.flutter.dev/deployment/flavors)
- [Android Product Flavors](https://developer.android.com/studio/build/build-variants#product-flavors)
- [iOS Schemes](https://developer.apple.com/documentation/xcode/running-multiple-schemes-in-a-project)
- [Run on Emulator Guide](RUN_ON_EMULATOR.md) - Hướng dẫn setup emulator

---

**Last Updated:** December 2024  
**Maintained by:** Petties Development Team

