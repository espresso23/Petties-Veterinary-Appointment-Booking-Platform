# 🔔 Sentry Error Monitoring Setup Guide

**Mục đích:** Tự động báo lỗi production về Discord để team fix ngay  
**Thời gian setup:** ~30 phút  
**Chi phí:** FREE (5,000 errors/month)

---

## 📋 Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Bước 1: Tạo tài khoản Sentry](#2-bước-1-tạo-tài-khoản-sentry)
3. [Bước 2: Setup cho React (petties-web)](#3-bước-2-setup-cho-react-petties-web)
4. [Bước 3: Setup cho Spring Boot (backend)](#4-bước-3-setup-cho-spring-boot-backend)
5. [Bước 4: Setup cho FastAPI (ai-service)](#5-bước-4-setup-cho-fastapi-ai-service)
6. [Bước 5: Setup cho Flutter (petties-mobile)](#6-bước-5-setup-cho-flutter-petties-mobile)
7. [Bước 6: Kết nối Sentry → Discord](#7-bước-6-kết-nối-sentry--discord)
8. [Bước 7: Cấu hình Alert Rules](#8-bước-7-cấu-hình-alert-rules)
9. [Testing](#9-testing)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tổng quan

### 1.1 Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User gặp    │     │   Sentry     │     │   Discord    │
│    lỗi       │────▶│  thu thập    │────▶│   thông báo  │
│  (tự động)   │     │   (cloud)    │     │   (instant)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 1.2 Sentry thu thập gì?

| Thông tin | Ví dụ |
|-----------|-------|
| **Error type** | `TypeError`, `500 Internal Server Error` |
| **Stack trace** | File nào, dòng nào gây lỗi |
| **User context** | Email/ID của user đang dùng |
| **Browser info** | Chrome 120, Windows 10 |
| **URL** | `/booking/create` |
| **Request data** | Body, headers (sanitized) |

---

## 2. Bước 1: Tạo tài khoản Sentry

### 2.1 Đăng ký

1. Vào https://sentry.io/signup/
2. Chọn **Sign up with GitHub** (recommended)
3. Tạo Organization: `petties`

### 2.2 Tạo Projects

Tạo 3 projects:

| Project Name | Platform | Dùng cho |
|--------------|----------|----------|
| `petties-web` | React | Frontend React |
| `petties-backend` | Spring Boot | Backend Java |
| `petties-ai-service` | Python | AI Service FastAPI |

**Cách tạo:**
1. Sentry Dashboard → Settings → Projects → Create Project
2. Chọn platform tương ứng
3. Copy DSN (Data Source Name) - sẽ dùng sau

---

## 3. Bước 2: Setup cho React (petties-web)

> ✅ **Đã implement!** File: `src/lib/sentry.ts` và `src/main.tsx`

### 3.1 Environment variable

Thêm vào `.env.production`:

```env
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

> ⚠️ **Lấy DSN từ:** Sentry → Settings → Projects → petties-web → Client Keys (DSN)

---

## 4. Bước 3: Setup cho Spring Boot (backend)

> ✅ **Đã implement!** File: `config/SentryConfig.java` và `application.properties`

### 4.1 Environment variables

```bash
# .env hoặc environment
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENABLED=true
```

---

## 5. Bước 4: Setup cho FastAPI (ai-service)

> ✅ **Đã implement!** File: `app/core/sentry.py` và `app/config/settings.py`

### 5.1 Environment variables

```bash
# .env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
ENVIRONMENT=production
```

---

## 6. Bước 5: Setup cho Flutter (petties-mobile)

> ✅ **Đã implement!** File: `lib/core/services/sentry_service.dart` và `lib/main.dart`

### 6.1 Cài đặt package

```bash
cd petties_mobile
flutter pub get
```

### 6.2 Build với Sentry DSN

Khi build cho production:

```bash
# Android
flutter build apk --dart-define=SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx --dart-define=ENVIRONMENT=production

# iOS
flutter build ios --dart-define=SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx --dart-define=ENVIRONMENT=production
```

### 6.3 Set user context sau login

Trong auth logic:

```dart
import 'package:petties_mobile/core/services/sentry_service.dart';

// Sau khi login thành công
SentryService.setUser(
  id: user.id,
  email: user.email,
  role: 'PET_OWNER',
);

// Khi logout
SentryService.clearUser();
```

---

## 7. Bước 6: Kết nối Sentry → Discord

### 6.1 Tạo Discord Webhook

1. Vào **Discord Server** của team
2. Chọn channel để nhận alerts (ví dụ: `#petties-alerts`)
3. **Edit Channel** → **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Đặt tên: `Petties Sentry Alerts`
6. **Copy Webhook URL**

```
https://discord.com/api/webhooks/1234567890/abcdefghijk...
```

> 💡 **Tip:** Tạo 2 webhooks nếu muốn tách Production và Staging alerts

### 6.2 Cấu hình Alert trong Sentry

1. Vào **Sentry** → **Alerts** → **Create Alert**
2. Chọn loại alert:
   - **Issue Alert** (cho errors)
   - **Metric Alert** (cho performance)

3. Ở phần **Actions**:
   - Chọn **Send a notification via an integration**
   - Chọn **Webhooks**
   - Dán **Discord Webhook URL**

### 6.3 Alternative: Sử dụng Discord Integration (Beta)

Sentry có Discord integration chính thức (đang beta):

1. Vào **Sentry** → **Settings** → **Integrations**
2. Tìm **Discord** → Click **Install**
3. Authorize với Discord
4. Chọn server và channel

> ⚠️ **Note:** Discord integration đang beta, Webhook ổn định hơn

---

## 7. Bước 6: Cấu hình Alert Rules

### 7.1 Tạo Alert Rules

Vào Sentry → **Alerts** → **Create Alert**

#### Alert 1: Critical Errors (Immediate)

```yaml
Name: 🔴 Critical Error Alert
Conditions:
  - Event occurs
  - Level is "error" or "fatal"
Filters:
  - First seen in last 5 minutes
  - Environment is "production"
Actions:
  - Send notification via webhook (Discord URL)
Frequency: Every 5 minutes
```

#### Alert 2: High Volume Errors

```yaml
Name: 🟠 High Volume Error Alert
Conditions:
  - More than 10 events occur in 5 minutes
Actions:
  - Send notification via webhook (Discord URL)
Frequency: Every 15 minutes
```

#### Alert 3: New Issue Alert

```yaml
Name: 🆕 New Issue Alert
Conditions:
  - A new issue is created
Actions:
  - Send notification via webhook (Discord URL)
Frequency: Real-time
```

### 7.2 Alert Message trên Discord

Sentry webhook sẽ gửi message như sau trên Discord:

```
🔴 Error in petties-web
━━━━━━━━━━━━━━━━━━━━━━━━━

❌ TypeError: Cannot read property 'id' of undefined

📍 Location: BookingPage.tsx:145
👤 User: vet@clinic.com
🌐 Browser: Chrome 120 / Windows

📊 First seen: 2 minutes ago
📊 Occurrences: 15

🔗 https://sentry.io/organizations/petties/issues/xxx
```

---

## 8. Testing

### 8.1 Test React Integration

```tsx
// Thêm button này để test (xóa sau khi test xong)
<button onClick={() => {
  throw new Error("Test Sentry Error - React")
}}>
  Test Sentry
</button>
```

### 8.2 Test Spring Boot Integration

```java
// Tạo endpoint test (xóa sau khi test)
@GetMapping("/test-sentry")
public void testSentry() {
    throw new RuntimeException("Test Sentry Error - Spring Boot");
}
```

### 8.3 Test FastAPI Integration

```python
# Tạo endpoint test (xóa sau khi test)
@app.get("/test-sentry")
def test_sentry():
    raise Exception("Test Sentry Error - FastAPI")
```

### 8.4 Verify

1. Trigger lỗi từ các test endpoints
2. Kiểm tra Sentry dashboard (nên thấy errors trong 1-2 phút)
3. Kiểm tra Discord channel (nên nhận notification)

---

## 9. Troubleshooting

### 9.1 Không thấy errors trên Sentry

| Vấn đề | Giải pháp |
|--------|-----------|
| DSN sai | Kiểm tra lại DSN trong Settings → Client Keys |
| Chỉ chạy ở dev | Kiểm tra `sentry.enabled` hoặc condition `import.meta.env.PROD` |
| Error bị filter | Kiểm tra `beforeSend` callback |

### 9.2 Không nhận Discord notification

| Vấn đề | Giải pháp |
|--------|-----------|
| Webhook URL sai | Kiểm tra lại URL trong Discord → Channel Settings → Webhooks |
| Alert rule không trigger | Kiểm tra Alerts → View Alert History |
| Channel không đúng | Đảm bảo webhook thuộc channel đúng |

### 9.3 Quá nhiều alerts (spam)

| Vấn đề | Giải pháp |
|--------|-----------|
| Mọi error đều alert | Tăng threshold (>10 events) |
| Duplicate alerts | Tăng frequency (15 min thay vì 5 min) |
| Dev errors | Filter by environment = production |

---

## 📋 Checklist Setup

### Team Lead

- [ ] Tạo Sentry organization `petties`
- [ ] Tạo 3 projects (web, backend, ai-service)
- [ ] Lấy DSN cho từng project
- [ ] Tạo Discord webhook trong #petties-alerts
- [ ] Cấu hình Alert Rules với Discord webhook
- [ ] Test alert flow

### Developer

- [ ] Kiểm tra Sentry SDK đã được thêm vào code
- [ ] Thêm DSN vào environment variables
- [ ] Test integration locally
- [ ] Verify errors appear in Sentry

### DevOps

- [ ] Thêm SENTRY_DSN vào production environment
- [ ] Set SENTRY_ENABLED=true cho production
- [ ] Verify alerts work in production

---

## 🔗 Links hữu ích

- [Sentry React Docs](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Spring Boot Docs](https://docs.sentry.io/platforms/java/guides/spring-boot/)
- [Sentry Python Docs](https://docs.sentry.io/platforms/python/integrations/fastapi/)
- [Sentry Webhooks](https://docs.sentry.io/product/integrations/integration-platform/webhooks/)
- [Discord Webhooks Guide](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)

---

## 📝 Discord Channel Structure (Recommended)

```
#petties-alerts       → Production errors (Critical/High)
#petties-alerts-dev   → Staging/Dev errors (optional)
#petties-general      → Team discussions
```

---

> **Questions?** Contact Team Lead hoặc post trong #petties-general
