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
   - `petties-test` - Team nội bộ (dev build)
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

### 2.0 Apple Developer Account - FAQ

#### ❓ Team 5 người có cần 5 tài khoản không?

**KHÔNG!** Chỉ cần **1 tài khoản** cho cả team.

| Câu hỏi | Trả lời |
|---------|---------|
| Cần bao nhiêu account? | **CHỈ 1** |
| Chi phí? | **$99/năm** (~2.5 triệu VND) |
| Team members build được không? | ✅ Có (qua CI/CD) |
| Team members test được không? | ✅ Có (qua TestFlight - MIỄN PHÍ) |

#### 🎫 Hai loại Apple Developer Account

| Loại | Chi phí | Phù hợp với |
|------|---------|-------------|
| **Individual** | $99/năm | Cá nhân, freelancer, team nhỏ |
| **Organization** | $99/năm | Công ty, startup (cần DUNS number) |

#### 👥 Phân quyền trong team (Organization Account)

| Vai trò | Quyền |
|---------|-------|
| **Account Holder** | Quản lý mọi thứ, thanh toán |
| **Admin** | Quản lý certificates, users, builds |
| **Developer** | Tạo builds, access code signing |
| **Marketing** | Quản lý App Store listing |

#### 📱 TestFlight - Testers hoàn toàn MIỄN PHÍ

- Testers **KHÔNG cần** Apple Developer Account
- Chỉ cần iPhone + App Store (để tải TestFlight app)
- Owner mời bằng email → Testers accept → Cài app test
- Hỗ trợ tối đa **10,000 external testers**

#### 🔗 Đăng ký Apple Developer

1. Truy cập: https://developer.apple.com/programs/enroll/
2. Đăng nhập Apple ID
3. Chọn Individual hoặc Organization
4. Thanh toán $99 (Visa/Mastercard)
5. Đợi Apple approve (24-48 giờ)

#### 🖥️ Team không có Mac có thể test iOS không?

**CÓ!** Dùng Codemagic để build trên cloud.

```
Windows/Linux Dev → Push code → Codemagic (macOS cloud) → Build IPA → TestFlight → iPhone test
```

| Bước | Thực hiện bởi | Thiết bị cần |
|------|---------------|--------------|
| Code Flutter | Dev | Windows/Linux/Mac |
| Push code | Dev | Git |
| Build iOS (.ipa) | **Codemagic** | Không cần (cloud) |
| Upload TestFlight | **Codemagic** | Tự động |
| Test app | Tester | **iPhone** |

#### ✅ Yêu cầu tối thiểu để develop iOS (không có Mac)

| Yêu cầu | Bắt buộc? | Chi phí |
|---------|-----------|---------|
| Apple Developer Account | ✅ | $99/năm |
| **Ít nhất 1 iPhone** trong team | ✅ | - |
| Codemagic account | ✅ | Miễn phí (500 phút/tháng) |
| Mac | ❌ | Không cần |

#### 🔐 Code Signing không cần Mac

Codemagic hỗ trợ **Automatic Code Signing**:
1. Bạn cung cấp Apple Developer credentials
2. Codemagic tự động tạo certificates và profiles
3. Không cần Mac để tạo thủ công!

---

### 2.1 Lựa chọn CI/CD Platform cho iOS

#### 🔄 So sánh GitHub Actions vs Codemagic

| Tiêu chí | GitHub Actions | Codemagic |
|----------|----------------|-----------|
| **macOS Runner** | ❌ Tốn tiền ($0.08/phút) | ✅ Miễn phí 500 phút/tháng |
| **iOS Build** | ⚠️ Phức tạp | ✅ Dễ setup |
| **Apple Signing** | ❌ Phải tự setup | ✅ Tự động quản lý |
| **Flutter Support** | ⚠️ Cần cấu hình | ✅ Native support |
| **Free Tier (iOS)** | ~200 phút/tháng | 500 phút/tháng |

#### 💡 Khuyến nghị

| Platform | CI/CD Tool | Lý do |
|----------|------------|-------|
| **Android** | GitHub Actions | Đã setup, miễn phí |
| **iOS** | **Codemagic** | macOS miễn phí, dễ setup |

#### 🛠️ Setup Codemagic (Khuyến nghị cho iOS)

1. Đăng ký: https://codemagic.io/signup
2. Kết nối GitHub repository
3. Codemagic sẽ hướng dẫn từng bước:
   - Tự động detect Flutter project
   - Hỗ trợ code signing wizard
   - Tích hợp TestFlight/Firebase

---

### 2.2 Yêu cầu (nếu dùng GitHub Actions)

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

### 3.1 Manual Dispatch là gì?

**Manual Dispatch** (`workflow_dispatch`) là cơ chế cho phép bạn **chủ động kích hoạt** quy trình CI/CD bằng cách nhấn nút chạy trên giao diện GitHub, thay vì chờ hệ thống tự động chạy mỗi khi có code mới. Điều này giúp:
*   **Tiết kiệm tài nguyên:** Tránh lãng phí build quota cho các commit nhỏ lẻ.
*   **Kiểm soát release:** Chỉ tạo bản build Tester khi tính năng đã thực sự hoàn thiện.
*   **Linh hoạt:** Cho phép bạn tùy chọn môi trường và nền tảng build ngay lúc chạy.

### 3.2 Hướng dẫn chạy Pipeline (Từng bước)

1.  Truy cập vào tab **Actions** trên GitHub Repository của dự án.
2.  Ở cột bên trái, chọn workflow tên là **Mobile CI/CD**.
3.  Nhìn sang bên phải, nhấn vào nút **Run workflow** (dropdown menu).
4.  Điền/Chọn các thông số cấu hình (Inputs):

| Tùy chọn (Input) | Ý nghĩa | Lựa chọn khuyên dùng |
| :--- | :--- | :--- |
| **Use workflow from** | Chọn nhánh code nguồn để build | `develop` (cho Test/Staging)<br>`main` (cho Production) |
| **Build flavor** | Chọn môi trường cấu hình app | `dev` (Developer - trỏ local/test server)<br>`staging` (QA Tester - trỏ test server)<br>`prod` (Release - trỏ real server) |
| **Target platform** | Hệ điều hành muốn build | `android` (Build APK)<br>`ios` (Build IPA)<br>`both` (Chạy cả hai song song) |
| **iOS distribution** | Nơi upload bản build iOS | `testflight` (Khuyên dùng - Chuẩn Apple)<br>`firebase` (Nội bộ - cần UDID) |

5.  Nhấn nút **Run workflow** màu xanh lá cây để bắt đầu tiến trình.

> **Lưu ý:** Sau khi merge code xong, nếu Team muốn có APK mới để test thì Leader hoặc người phụ trách cần vào bấm nút này.

---

## 🔥 Workflow Flow

```
┌────────────────────────────────────────────────────────────────┐
│                      TRIGGER                                    │
│  (Manual dispatch only)                                          │
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

