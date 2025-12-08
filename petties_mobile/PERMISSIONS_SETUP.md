# Permissions Setup Guide

## ✅ Đã Cấu Hình

### Android (`android/app/src/main/AndroidManifest.xml`)
- ✅ Internet & Network
- ✅ Location (Fine, Coarse, Background)
- ✅ Camera
- ✅ Storage (Read/Write cho Android ≤12, Read Media cho Android 13+)
- ✅ Notifications
- ✅ Vibration

### iOS (`ios/Runner/Info.plist`)
- ✅ Network (App Transport Security)
- ✅ Location (When In Use, Always)
- ✅ Camera
- ✅ Photo Library (Read & Add)
- ✅ Microphone (cho video)
- ✅ Background Notifications

---

## 🔑 Google Maps API Key Setup

### 1. Lấy API Key

1. Truy cập: https://console.cloud.google.com/
2. Tạo project mới hoặc chọn project hiện có
3. Vào **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **API Key**
5. Enable các APIs sau:
   - **Maps SDK for Android** (cho Android)
   - **Maps SDK for iOS** (cho iOS)

### 2. Cấu Hình API Key

#### Android:
Sửa file: `android/app/src/main/AndroidManifest.xml`

Tìm dòng:
```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY"/>
```

Thay `YOUR_GOOGLE_MAPS_API_KEY` bằng API key thật của bạn.

#### iOS:
Sửa file: `ios/Runner/AppDelegate.swift`

Tìm dòng:
```swift
GMSServices.provideAPIKey("YOUR_GOOGLE_MAPS_API_KEY")
```

Thay `YOUR_GOOGLE_MAPS_API_KEY` bằng API key thật của bạn.

---

## 📱 Sử Dụng Permission Helper

File `lib/utils/permission_helper.dart` đã được tạo để dễ dàng request permissions.

### Ví dụ sử dụng:

```dart
import 'package:petties_mobile/utils/permission_helper.dart';

// Request location permission
final hasLocation = await PermissionHelper.requestLocationPermission();
if (hasLocation) {
  // Use location
}

// Request camera permission
final hasCamera = await PermissionHelper.requestCameraPermission();
if (hasCamera) {
  // Use camera
}

// Request storage permission
final hasStorage = await PermissionHelper.requestStoragePermission();
if (hasStorage) {
  // Access photos
}

// Request all permissions at once
final permissions = await PermissionHelper.requestAllPermissions();
print('Location: ${permissions['location']}');
print('Camera: ${permissions['camera']}');
print('Storage: ${permissions['storage']}');

// Check permissions status
final status = await PermissionHelper.checkAllPermissions();
```

---

## 🧪 Test Permissions

### Android:
1. Chạy app: `flutter run`
2. Khi app request permission → Cho phép
3. Kiểm tra trong Settings → Apps → Petties Mobile → Permissions

### iOS:
1. Chạy app: `flutter run`
2. Khi app request permission → Cho phép
3. Kiểm tra trong Settings → Petties Mobile → Privacy

---

## ⚠️ Lưu Ý Quan Trọng

### Android:
- **Storage Android 13+**: Dùng `READ_MEDIA_IMAGES` thay vì `READ_EXTERNAL_STORAGE`
- **Background Location**: Cần thêm bước cấu hình cho Android 10+
- **Google Maps API Key**: Phải enable "Maps SDK for Android" trong Google Cloud Console

### iOS:
- **Location Descriptions**: Phải có mô tả rõ ràng, nếu không app sẽ bị reject khi submit App Store
- **App Transport Security**: Đã cấu hình để cho phép HTTP cho localhost và 10.0.2.2 (Android emulator)
- **Google Maps API Key**: Phải enable "Maps SDK for iOS" trong Google Cloud Console

---

## 🔒 Security Best Practices

1. **API Key Restrictions**:
   - Restrict API key theo platform (Android/iOS)
   - Restrict theo package name/bundle ID
   - Set up API key restrictions trong Google Cloud Console

2. **Permissions**:
   - Chỉ request permissions khi thực sự cần
   - Giải thích rõ ràng tại sao cần permission
   - Handle gracefully khi user deny permission

---

## 📚 Tài Liệu Tham Khảo

- [Flutter Permission Handler](https://pub.dev/packages/permission_handler)
- [Google Maps Flutter Plugin](https://pub.dev/packages/google_maps_flutter)
- [Android Permissions](https://developer.android.com/guide/topics/permissions/overview)
- [iOS Privacy](https://developer.apple.com/documentation/avfoundation/avcapturedevice/requesting_authorization_to_use_the_camera)

---

Chúc bạn phát triển thành công! 🚀

