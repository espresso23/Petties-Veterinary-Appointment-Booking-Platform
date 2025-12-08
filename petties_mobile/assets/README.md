# 📦 Assets Directory

Thư mục chứa tất cả static assets cho ứng dụng Petties Mobile.

---

## 📁 Cấu Trúc Thư Mục

```
assets/
├── images/
│   ├── icons/          # Icons (PNG, SVG) - menu icons, action icons
│   ├── illustrations/  # Illustrations - empty states, onboarding, errors
│   ├── avatars/        # Default avatar images
│   ├── backgrounds/    # Background images - login, splash screens
│   ├── logo/           # Logo files - app logo, favicon
│   └── photos/         # Photo images (nếu cần bundle)
│
├── fonts/              # Custom fonts (TTF, OTF)
├── data/               # JSON data files (mock data, config)
└── lottie/             # Lottie animations (.json)
```

---

## 📝 Hướng Dẫn Sử Dụng

### 1. Images

**Icons:**
- Đặt trong `images/icons/`
- Định dạng: PNG (transparency) hoặc SVG (vector)
- Naming: `icon-name.png`, `menu-icon.svg`

**Illustrations:**
- Đặt trong `images/illustrations/`
- Dùng cho empty states, onboarding, error screens
- Naming: `empty-state.png`, `onboarding-1.png`

**Logos:**
- Đặt trong `images/logo/`
- Các phiên bản: `logo.png`, `logo-light.png`, `logo-dark.png`

**Avatars:**
- Đặt trong `images/avatars/`
- Default avatars: `default-avatar.png`, `default-pet-avatar.png`

---

### 2. Fonts

**Cấu trúc:**
```
fonts/
└── FontName/
    ├── FontName-Regular.ttf
    ├── FontName-Bold.ttf
    └── FontName-Italic.ttf
```

**Khai báo trong `pubspec.yaml`:**
```yaml
fonts:
  - family: FontName
    fonts:
      - asset: assets/fonts/FontName/FontName-Regular.ttf
      - asset: assets/fonts/FontName/FontName-Bold.ttf
        weight: 700
```

---

### 3. Lottie Animations

**Cấu trúc:**
```
lottie/
├── loading-animation.json
├── success-animation.json
└── error-animation.json
```

**Cần package:** `lottie: ^3.1.0`

**Sử dụng:**
```dart
import 'package:lottie/lottie.dart';

Lottie.asset('assets/lottie/loading-animation.json')
```

---

## ✅ Best Practices

1. **Tối ưu images:**
   - Compress PNG/JPEG trước khi thêm
   - Resize về đúng kích thước cần dùng
   - Dùng WebP nếu có thể (nhẹ hơn)

2. **Naming convention:**
   - ✅ `pet-icon.png`, `login-background.jpg`
   - ❌ `image1.png`, `img.jpg`

3. **Tổ chức theo feature (nếu cần):**
   ```
   images/
   ├── icons/
   │   ├── auth/         # Auth-related icons
   │   ├── booking/      # Booking-related icons
   │   └── pet/          # Pet-related icons
   ```

4. **Luôn khai báo trong `pubspec.yaml`:**
   ```yaml
   assets:
     - assets/images/icons/
     - assets/images/illustrations/
   ```

---

## 🔍 Xem Chi Tiết

Xem hướng dẫn đầy đủ: [ASSETS_AND_THEME_GUIDE.md](../ASSETS_AND_THEME_GUIDE.md)

