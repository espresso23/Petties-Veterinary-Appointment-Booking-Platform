# 📱 Mobile CI/CD Setup Guide

Hướng dẫn thiết lập CI/CD cho Petties Mobile App với Firebase App Distribution và TestFlight.

## 📋 Tổng quan

Pipeline CI/CD cho mobile app bao gồm:

| Platform | Build | Deploy Options |
|----------|-------|----------------|
| **Android** | APK | Firebase App Distribution |
| **iOS** | IPA | TestFlight (recommended) hoặc Firebase |

## 🤖 PHẦN 1: ANDROID SETUP

### 1.1 Bật Firebase App Distribution

1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Chọn project **petties-cd84e**
3. Vào **Release & Monitor** → **App Distribution**
4. Click **Get started** nếu chưa bật

### 1.2 Tạo Tester Groups

1. Trong App Distribution, click **Testers & Groups**
2. Tạo các groups:
   - `internal-testers` - Team nội bộ (dev build)
   - `production-testers` - QA team (prod build)
3. Thêm email của testers vào từng group

### 1.3 Tạo Service Account cho CI/CD

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project **petties-cd84e**
3. Vào **IAM & Admin** → **Service Accounts**
4. Click **+ CREATE SERVICE ACCOUNT**
5. Đặt tên: `github-actions-firebase`
6. Click **Create and Continue**
7. Thêm role: **Firebase App Distribution Admin**
8. Click **Done**
9. Click vào service account → **Keys** → **Add Key** → **Create new key** → **JSON**
10. Download file JSON

### 1.4 GitHub Secrets cho Android

| Secret Name | Giá trị | Mô tả |
|-------------|---------|-------|
| `FIREBASE_ANDROID_APP_ID` | `1:620454234596:android:5ca04071d2ff84970adff1` | App ID từ Firebase |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | *Nội dung file JSON* | Service account JSON key |
| `ANDROID_KEYSTORE_BASE64` | *Base64 của keystore file* | Cho production build |
| `KEYSTORE_PASSWORD` | *Password* | Keystore password |
| `KEY_PASSWORD` | *Password* | Key password |
| `KEY_ALIAS` | *Alias* | Key alias |

---

## 🍎 PHẦN 2: iOS SETUP

### 2.1 Yêu cầu

- **Apple Developer Account** ($99/năm): https://developer.apple.com/
- **App ID đã đăng ký** trên Apple Developer Portal
- **Certificates & Provisioning Profiles**

### 2.2 Option A: TestFlight (Khuyến nghị) ⭐

TestFlight là cách tốt nhất để distribute iOS apps cho testers vì:
- ✅ Không cần thu thập UDID của từng tester
- ✅ Testers cài app dễ dàng qua TestFlight app
- ✅ Hỗ trợ up to 10,000 external testers
- ✅ Chính thức từ Apple

#### Bước 1: Tạo App trên App Store Connect

1. Vào [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **My Apps** → **+** → **New App**
3. Điền thông tin:
   - Platform: iOS
   - Name: Petties
   - Bundle ID: `world.petties.mobile`
   - SKU: `petties-mobile`
4. Click **Create**

#### Bước 2: Tạo App Store Connect API Key

1. Vào [App Store Connect → Users and Access → Keys](https://appstoreconnect.apple.com/access/api)
2. Click **+** để tạo key mới
3. Name: `GitHub Actions`
4. Access: **App Manager** (hoặc Admin)
5. Click **Generate**
6. **Download file .p8** (chỉ download được 1 lần!)
7. Ghi lại **Key ID** và **Issuer ID**

#### Bước 3: Tạo Distribution Certificate

1. Mở **Keychain Access** trên Mac
2. **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
3. Điền email, chọn **Saved to disk**
4. Lên [Apple Developer → Certificates](https://developer.apple.com/account/resources/certificates/list)
5. Click **+** → **Apple Distribution**
6. Upload file CSR vừa tạo
7. Download certificate (.cer) và double-click để cài
8. Export thành .p12:
   - Mở Keychain Access → **My Certificates**
   - Right-click certificate → **Export**
   - Chọn format **.p12**
   - Đặt password

#### Bước 4: Tạo Provisioning Profile

1. Vào [Apple Developer → Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Click **+** → **App Store** (cho TestFlight distribution)
3. Chọn App ID: `world.petties.mobile`
4. Chọn certificate vừa tạo
5. Download profile (.mobileprovision)

#### Bước 5: Tạo ExportOptions.plist

Tạo file `petties_mobile/ios/ExportOptions.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>uploadSymbols</key>
    <true/>
    <key>uploadBitcode</key>
    <false/>
    <key>signingStyle</key>
    <string>manual</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>world.petties.mobile</key>
        <string>YOUR_PROVISIONING_PROFILE_NAME</string>
    </dict>
</dict>
</plist>
```

#### Bước 6: GitHub Secrets cho TestFlight

| Secret Name | Giá trị | Mô tả |
|-------------|---------|-------|
| `IOS_P12_CERTIFICATE_BASE64` | Base64 của file .p12 | Distribution certificate |
| `IOS_P12_PASSWORD` | Password đặt khi export .p12 | Certificate password |
| `IOS_KEYCHAIN_PASSWORD` | Random password | Temporary keychain |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64 của .mobileprovision | Provisioning profile |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID từ bước 2 | API Key ID |
| `APP_STORE_CONNECT_API_ISSUER_ID` | Issuer ID từ bước 2 | Issuer ID |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Base64 của file .p8 | API private key |

**Encode files thành Base64:**

```bash
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\file.p12")) | Set-Clipboard

# Mac/Linux
base64 -i path/to/file.p12 | pbcopy
```

---

### 2.3 Option B: Firebase App Distribution cho iOS

Nếu muốn dùng Firebase thay vì TestFlight:

#### Yêu cầu
- Cần thu thập UDID của từng tester device
- Tạo **Ad Hoc** provisioning profile thay vì App Store profile
- Giới hạn 100 devices

#### Bước 1: Thu thập UDID testers

Testers cần gửi UDID của device:
1. Kết nối iPhone với Mac
2. Mở **Finder** → Chọn iPhone → Click vào thông tin để hiện UDID
3. Hoặc dùng dịch vụ như https://udid.io/

#### Bước 2: Thêm devices vào Apple Developer

1. [Apple Developer → Devices](https://developer.apple.com/account/resources/devices/list)
2. Click **+** → Thêm từng UDID

#### Bước 3: Tạo Ad Hoc Provisioning Profile

1. Vào Profiles → **+** → **Ad Hoc**
2. Chọn App ID, Certificate, và các devices
3. Download profile

#### Bước 4: Update ExportOptions.plist

```xml
<key>method</key>
<string>ad-hoc</string>
```

#### Bước 5: GitHub Secrets bổ sung

| Secret Name | Giá trị |
|-------------|---------|
| `FIREBASE_IOS_APP_ID` | `1:620454234596:ios:f5591036fcb0ed880adff1` |

---

## 🚀 PHẦN 3: SỬ DỤNG PIPELINE

### Auto-trigger (Push code)

| Event | Platform | Flavor | Deploy Target |
|-------|----------|--------|---------------|
| Push to `develop` | Android only | dev | Firebase (internal-testers) |
| Push to `main` | Android only | prod | Firebase (production-testers) |

### Manual trigger (Workflow dispatch)

1. Vào **GitHub Actions** → **Mobile CI/CD**
2. Click **Run workflow**
3. Chọn:
   - **Branch**: develop/main
   - **Flavor**: dev/staging/prod
   - **Platform**: android/ios/both
   - **iOS distribution**: testflight/firebase
4. Click **Run workflow**

---

## 🔥 Workflow Flow

```
┌────────────────────────────────────────────────────────────────┐
│                      TRIGGER                                    │
│  (Push to develop/main OR Manual dispatch)                     │
└───────────────────────┬────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│                     SETUP JOB                                  │
│  Determine: flavor, platforms, iOS distribution method        │
└───────────────────────┬───────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐
│   BUILD ANDROID     │    │    BUILD iOS        │
│   (Ubuntu runner)   │    │  (macOS runner)     │
│   → APK artifact    │    │   → IPA artifact    │
└─────────┬───────────┘    └─────────┬───────────┘
          │                           │
          ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐
│ DEPLOY → Firebase   │    │ DEPLOY → TestFlight │
│ App Distribution    │    │    or Firebase      │
└─────────────────────┘    └─────────────────────┘
```

---

## 📱 Testers: Cách cài đặt app

### Android (Firebase App Distribution)
1. Nhận email mời từ Firebase
2. Tải **Firebase App Tester** từ Play Store
3. Đăng nhập và cài Petties app

### iOS (TestFlight)
1. Nhận email mời từ TestFlight
2. Tải **TestFlight** app từ App Store
3. Accept invitation và cài Petties app

### iOS (Firebase - Ad Hoc)
1. Gửi UDID cho dev team trước
2. Nhận email mời sau khi UDID được thêm
3. Tải **Firebase App Tester** và cài app

---

## ⚠️ Troubleshooting

### Android
| Error | Solution |
|-------|----------|
| "No matching client found" | Check applicationId matches Firebase |
| "Permission denied" | Service account cần Firebase App Distribution Admin role |

### iOS
| Error | Solution |
|-------|----------|
| "No signing certificate" | Check P12 certificate secret |
| "Provisioning profile not found" | Check profile secret và Bundle ID |
| "App Store Connect API error" | Verify API Key ID và Issuer ID |
| "Device not registered" | (Ad Hoc only) Thêm UDID vào Apple Developer |

---

## 🔗 Links hữu ích

- [Firebase Console](https://console.firebase.google.com/project/petties-cd84e)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Apple Developer Portal](https://developer.apple.com/)
- [Firebase App Distribution Docs](https://firebase.google.com/docs/app-distribution)
- [TestFlight Docs](https://developer.apple.com/testflight/)

