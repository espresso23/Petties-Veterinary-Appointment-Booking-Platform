# Google Sign-In Setup Guide

Hướng dẫn cấu hình Google Sign-In cho Petties (Mobile + Web).

---

## 📋 Tổng quan

### Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │     │   Backend API   │     │  Google OAuth   │
│   (Flutter)     │     │  (Spring Boot)  │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. Click "Sign in     │                       │
         │    with Google"       │                       │
         │──────────────────────────────────────────────>│
         │                       │                       │
         │ 2. User selects       │                       │
         │    Google account     │                       │
         │<──────────────────────────────────────────────│
         │   (ID Token)          │                       │
         │                       │                       │
         │ 3. POST /auth/google  │                       │
         │    {idToken, platform}│                       │
         │──────────────────────>│                       │
         │                       │ 4. Verify ID Token    │
         │                       │──────────────────────>│
         │                       │<──────────────────────│
         │                       │   (User info)         │
         │                       │                       │
         │                       │ 5. Create/Login user  │
         │                       │    Generate JWT       │
         │                       │                       │
         │ 6. Return JWT tokens  │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 7. Save tokens &      │                       │
         │    Navigate to home   │                       │
         │                       │                       │
```

### Role Assignment (Tự động)

| Platform | Default Role | Use Case |
|----------|--------------|----------|
| `mobile` | `PET_OWNER` | Pet owners using the mobile app |
| `web` | `CLINIC_OWNER` | Clinic owners registering via web |

> ⚠️ STAFF và CLINIC_MANAGER **không đăng ký qua Google** - họ được cấp tài khoản bởi Clinic.

---

## 🔧 Bước 1: Google Cloud Console

### 1.1. Tạo/Chọn Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn project hiện có hoặc tạo project mới
3. Ghi nhớ **Project ID**

### 1.2. Cấu hình OAuth Consent Screen

1. Vào **APIs & Services** → **OAuth consent screen**
2. Chọn **External** → Click **Create**
3. Điền thông tin:

| Field | Value |
|-------|-------|
| App name | `Petties` |
| User support email | Email của bạn |
| App domain | `petties.world` |
| Developer contact | Email của bạn |

4. **Scopes**: Thêm `email`, `profile`, `openid`
5. **Test users**: Thêm email để test

---

## 🔑 Bước 2: Tạo OAuth 2.0 Client IDs

Vào **APIs & Services** → **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**

### 2.1. Web Client ID (BẮT BUỘC - Dùng cho Backend)

| Field | Value |
|-------|-------|
| Application type | **Web application** |
| Name | `Petties Web Client` |
| Authorized JavaScript origins | `http://localhost:3000`, `https://petties.world` |
| Authorized redirect URIs | `http://localhost:3000/auth/callback`, `https://petties.world/auth/callback` |

📝 **Lưu lại:**
- Client ID: `YOUR_WEB_CLIENT_ID.apps.googleusercontent.com`
- Client Secret: (lưu cho backend, KHÔNG commit vào repo)

### 2.2. Android Client ID

| Field | Value |
|-------|-------|
| Application type | **Android** |
| Name | `Petties Android` |
| Package name | `world.petties.mobile` |
| SHA-1 fingerprint | `50:1B:CF:4B:16:C2:BC:8B:87:C2:15:C5:07:61:E0:7E:23:F0:47:C5` |

### 2.3. iOS Client ID

| Field | Value |
|-------|-------|
| Application type | **iOS** |
| Name | `Petties iOS` |
| Bundle ID | `world.petties.mobile` |

📝 **Lưu lại iOS Client ID**: `YOUR_IOS_CLIENT_ID.apps.googleusercontent.com`

---

## 🔐 Bước 3: Lấy SHA-1 Fingerprint (Android)

```powershell
cd petties_mobile/android
.\gradlew.bat signingReport
```

Tìm trong output:
```
Variant: devDebug
Config: debug
SHA1: 50:1B:CF:4B:16:C2:BC:8B:87:C2:15:C5:07:61:E0:7E:23:F0:47:C5
```

---

## 📱 Bước 4: Cấu hình Mobile App

### 4.1. Files đã cấu hình

| File | Nội dung |
|------|----------|
| `pubspec.yaml` | `google_sign_in: ^6.2.1` |
| `lib/config/env/environment.dart` | Web Client ID (Server Client ID) |
| `ios/Runner/Info.plist` | iOS Client ID + URL Schemes |
| `lib/data/services/google_auth_service.dart` | Google Sign-In logic |
| `lib/data/services/auth_service.dart` | `loginWithGoogle(idToken, platform)` |
| `lib/providers/auth_provider.dart` | `signInWithGoogle()` |
| `lib/ui/auth/login_screen.dart` | Google Sign-In button |

### 4.2. iOS Info.plist

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>
        </array>
    </dict>
</array>
<key>GIDClientID</key>
<string>YOUR_IOS_CLIENT_ID.apps.googleusercontent.com</string>
```

### 4.3. Environment Configuration

```dart
// lib/config/env/environment.dart
static const String _googleServerClientId = String.fromEnvironment(
  'GOOGLE_SERVER_CLIENT_ID',
  // ⚠️ PHẢI dùng WEB Client ID, không phải iOS/Android Client ID
  defaultValue: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
);
```

---

## 🖥️ Bước 5: Backend API (Spring Boot)

### 5.1. Endpoint Specification

#### `POST /api/auth/google`

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "platform": "mobile"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idToken` | String | ✅ | ID Token từ Google Sign-In |
| `platform` | String | ✅ | `"mobile"` hoặc `"web"` |

**Response (Success - 200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "user@gmail.com",
  "email": "user@gmail.com",
  "role": "PET_OWNER"
}
```

**Response (Error - 401):**
```json
{
  "error": "Invalid ID token",
  "message": "The provided ID token could not be verified"
}
```

### 5.2. Backend Logic

```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private GoogleIdTokenVerifier googleTokenVerifier;
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private JwtService jwtService;

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> googleSignIn(@RequestBody GoogleSignInRequest request) {
        // 1. Verify ID Token with Google
        GoogleIdToken idToken = googleTokenVerifier.verify(request.getIdToken());
        if (idToken == null) {
            return ResponseEntity.status(401).body(new ErrorResponse("Invalid ID token"));
        }
        
        // 2. Extract user info from token
        GoogleIdToken.Payload payload = idToken.getPayload();
        String email = payload.getEmail();
        String name = (String) payload.get("name");
        String picture = (String) payload.get("picture");
        
        // 3. Find or create user
        User user = userService.findByEmail(email);
        if (user == null) {
            // New user - determine role based on platform
            String role = "mobile".equals(request.getPlatform()) ? "PET_OWNER" : "CLINIC_OWNER";
            user = userService.createUser(email, name, picture, role);
        }
        
        // 4. Generate JWT tokens
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        
        // 5. Return response
        return ResponseEntity.ok(new AuthResponse(
            accessToken, refreshToken, "Bearer",
            user.getId(), user.getUsername(), user.getEmail(), user.getRole()
        ));
    }
}
```

### 5.3. Google Token Verification

```java
// GoogleIdTokenVerifier configuration
@Bean
public GoogleIdTokenVerifier googleIdTokenVerifier() {
    return new GoogleIdTokenVerifier.Builder(
        new NetHttpTransport(), 
        JacksonFactory.getDefaultInstance()
    )
    .setAudience(Collections.singletonList(googleClientId))
    .build();
}
```

### 5.4. application.properties

```properties
# Google OAuth2
google.client-id=${GOOGLE_CLIENT_ID}
google.client-secret=${GOOGLE_CLIENT_SECRET}
```

> ⚠️ **KHÔNG commit secrets vào repo!** Sử dụng environment variables hoặc .env file.

### 5.5. Dependencies (pom.xml)

```xml
<dependency>
    <groupId>com.google.api-client</groupId>
    <artifactId>google-api-client</artifactId>
    <version>2.2.0</version>
</dependency>
```

---

## 🚀 Bước 6: Build & Run

### Mobile Development

```bash
flutter run --flavor dev --dart-define=FLAVOR=dev
```

### Mobile Production

```bash
flutter build apk --release --flavor prod --dart-define=FLAVOR=prod
flutter build appbundle --release --flavor prod --dart-define=FLAVOR=prod
```

---

## 🧪 Testing

### Test trên Emulator

1. Đảm bảo emulator có Google Play Services
2. Đăng nhập Google account trên emulator (Settings → Accounts)
3. Chạy app và test Google Sign-In

### Test Checklist

| Step | Expected Result |
|------|-----------------|
| Nhấn "Đăng nhập với Google" | Hiện popup chọn account |
| Chọn Google account | Popup đóng, loading hiện |
| Backend verify token | Trả về JWT tokens |
| App nhận response | Navigate đến Home |

### Common Issues

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| `ApiException: 10` | SHA-1 không khớp | Cập nhật SHA-1 trong Cloud Console |
| `ApiException: 10` | Sai Server Client ID | Dùng **Web** Client ID, không phải iOS/Android |
| Connection timeout | Backend chưa có endpoint | Implement `/auth/google` |
| `12500` | Google Play Services cũ | Cập nhật emulator |

---

## ✅ Checklist

### Google Cloud Console
- [x] Project tạo xong
- [x] OAuth consent screen configured
- [x] Web Client ID created
- [x] Android Client ID created (với SHA-1)
- [x] iOS Client ID created (với Bundle ID)

### Mobile App
- [x] `google_sign_in` dependency added
- [x] `environment.dart` - Web Client ID
- [x] `Info.plist` - iOS Client ID
- [x] `GoogleAuthService` - Google SDK wrapper
- [x] `AuthService.loginWithGoogle()` - API call
- [x] `AuthProvider.signInWithGoogle()` - State management
- [x] Login UI - Google button

### Backend (Spring Boot) ✅
- [x] `POST /api/auth/google` endpoint
- [x] Google ID Token verification (`GoogleAuthService.java`)
- [x] User creation with platform-based role
- [x] JWT token generation
- [x] `application.properties` - `google.client-id`
- [x] Docker Compose env `GOOGLE_CLIENT_ID`

### Web (React) ✅
- [x] `@react-oauth/google` package installed
- [x] `googleSignIn()` API function
- [x] Google Login button on LoginPage
- [x] PET_OWNER role blocking (mobile only)
- [x] Error handling & toast notifications

---

## 🌐 Production Setup

Trước khi deploy lên production:

1. **Google Cloud Console:**
   - Thêm `https://petties.world` vào **Authorized JavaScript origins**
   - Thêm `https://petties.world/auth/callback` vào **Authorized redirect URIs**

2. **VPS Environment:**
   ```bash
   # Trong file .env trên VPS (thay bằng giá trị thực)
   GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
   ```

---

## 📚 Tài liệu tham khảo

- [Google Sign-In for Flutter](https://pub.dev/packages/google_sign_in)
- [React OAuth Google](https://www.npmjs.com/package/@react-oauth/google)
- [Google API Client for Java](https://developers.google.com/api-client-library/java)
- [Verify Google ID Tokens](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

---

**Last Updated:** December 13, 2024  
**Status:** ✅ Mobile Complete | ✅ Backend Complete | ✅ Web Complete  
**Maintained by:** Petties Development Team
