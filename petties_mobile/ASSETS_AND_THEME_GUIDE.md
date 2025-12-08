# 📁 Hướng Dẫn Assets & Theme Configuration

Tài liệu hướng dẫn cách tổ chức và sử dụng assets (images, fonts, icons) và theme configuration trong Flutter mobile app.

---

## 📋 Mục Lục

- [Assets - Nơi Lưu Trữ](#assets---nơi-lưu-trữ)
- [Theme Configuration](#theme-configuration)
- [Cách Sử Dụng](#cách-sử-dụng)
- [Best Practices](#best-practices)

---

## 📦 Assets - Nơi Lưu Trữ

### 📁 Cấu Trúc Thư Mục

```
petties_mobile/
├── assets/                    # ✅ Thư mục assets (root level)
│   ├── images/               # Hình ảnh
│   │   ├── icons/            # Icons (PNG, SVG)
│   │   │   ├── logo.png
│   │   │   ├── pet-icon.svg
│   │   │   └── clinic-icon.svg
│   │   ├── illustrations/    # Illustrations
│   │   │   ├── empty-state.png
│   │   │   └── onboarding/
│   │   ├── avatars/          # Default avatars
│   │   └── backgrounds/      # Background images
│   │
│   ├── fonts/                # Custom fonts
│   │   ├── Roboto/
│   │   │   ├── Roboto-Regular.ttf
│   │   │   ├── Roboto-Bold.ttf
│   │   │   └── Roboto-Italic.ttf
│   │   └── CustomFont/
│   │
│   └── data/                 # JSON data files (optional)
│       └── app_config.json
│
└── pubspec.yaml              # ✅ Khai báo assets ở đây
```

---

### 🔧 Cấu Hình Assets trong `pubspec.yaml`

**Mở file:** `pubspec.yaml`

**Thêm vào section `flutter:`:**

```yaml
flutter:
  uses-material-design: true

  # Assets
  assets:
    - assets/images/
    - assets/images/icons/
    - assets/images/illustrations/
    - assets/images/avatars/
    - assets/images/backgrounds/
    - assets/data/

  # Custom Fonts
  fonts:
    - family: Roboto
      fonts:
        - asset: assets/fonts/Roboto/Roboto-Regular.ttf
        - asset: assets/fonts/Roboto/Roboto-Bold.ttf
          weight: 700
        - asset: assets/fonts/Roboto/Roboto-Italic.ttf
          style: italic
    - family: CustomFont
      fonts:
        - asset: assets/fonts/CustomFont/CustomFont-Regular.ttf
```

---

### ✅ Các Loại Assets Được Hỗ Trợ

#### 1. **Images**
- **PNG**: `.png` - Tốt cho icons, photos với transparency
- **JPEG**: `.jpg`, `.jpeg` - Tốt cho photos, không hỗ trợ transparency
- **SVG**: `.svg` - Vector graphics (cần package `flutter_svg`)
- **WebP**: `.webp` - Modern format, nhẹ hơn PNG/JPEG

#### 2. **Fonts**
- **TTF**: `.ttf` - TrueType fonts
- **OTF**: `.otf` - OpenType fonts

#### 3. **Data Files**
- **JSON**: `.json` - Configuration, mock data
- **XML**: `.xml` - (ít dùng)

---

### 📝 Cách Thêm Assets

#### Bước 1: Tạo Thư Mục

```bash
mkdir -p assets/images/icons
mkdir -p assets/images/illustrations
mkdir -p assets/images/avatars
mkdir -p assets/fonts
```

#### Bước 2: Copy Files Vào

```bash
# Copy images
cp logo.png assets/images/icons/
cp pet-icon.svg assets/images/icons/

# Copy fonts
cp Roboto-Regular.ttf assets/fonts/Roboto/
```

#### Bước 3: Cập Nhật `pubspec.yaml`

Thêm paths vào section `assets:` và `fonts:` (như trên)

#### Bước 4: Run `flutter pub get`

```bash
flutter pub get
```

---

## 🎨 Theme Configuration

### 📁 Nơi Lưu Trữ Theme Config

**Theme configuration được lưu trong:**

```
lib/
└── config/
    ├── theme/
    │   └── app_theme.dart       # ✅ Theme configuration chính
    │
    └── constants/
        ├── app_colors.dart      # ✅ Color palette
        ├── app_strings.dart     # ✅ Text constants (optional)
        └── app_constants.dart   # App-wide constants
```

---

### 🎨 Cấu Trúc Theme

#### 1. **Color Palette** (`lib/config/constants/app_colors.dart`)

**Mục đích:** Định nghĩa tất cả màu sắc dùng trong app

```dart
class AppColors {
  AppColors._();

  // Primary Colors
  static const Color primary = Color(0xFF6C63FF);
  static const Color primaryLight = Color(0xFF9B95FF);
  static const Color primaryDark = Color(0xFF4A42CC);

  // Secondary Colors
  static const Color secondary = Color(0xFFFF6B9D);

  // Neutral Colors
  static const Color black = Color(0xFF000000);
  static const Color white = Color(0xFFFFFFFF);
  static const Color grey = Color(0xFF9E9E9E);

  // Background Colors
  static const Color background = Color(0xFFF5F5F5);
  static const Color surface = Color(0xFFFFFFFF);

  // Status Colors
  static const Color success = Color(0xFF4CAF50);
  static const Color error = Color(0xFFF44336);
  static const Color warning = Color(0xFFFF9800);
  static const Color info = Color(0xFF2196F3);

  // Text Colors
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);

  // Border Colors
  static const Color border = Color(0xFFE0E0E0);
  static const Color divider = Color(0xFFEEEEEE);
}
```

---

#### 2. **Theme Configuration** (`lib/config/theme/app_theme.dart`)

**Mục đích:** Định nghĩa ThemeData cho light/dark themes

**Hiện tại có:**
- `AppTheme.lightTheme` - Light theme
- `AppTheme.darkTheme` - Dark theme (skeleton)

**Các components được config:**
- ColorScheme
- AppBarTheme
- ButtonThemes (Elevated, Outlined, Text)
- InputDecorationTheme
- CardTheme
- TextTheme
- DividerTheme

---

### 📐 Cấu Trúc Theme Files

```
lib/config/
├── theme/
│   └── app_theme.dart          # Main theme file
│
└── constants/
    ├── app_colors.dart         # Color definitions
    ├── app_strings.dart        # String constants (optional)
    └── app_constants.dart      # Other constants (API URLs, etc.)
```

**Tách biệt:**
- ✅ **Colors** → `app_colors.dart` (chỉ màu sắc)
- ✅ **Theme** → `app_theme.dart` (ThemeData với colors + styles)
- ✅ **Constants** → `app_constants.dart` (API URLs, timeouts, etc.)

---

## 💻 Cách Sử Dụng

### 1. Sử Dụng Assets (Images)

#### Image từ Assets

```dart
import 'package:flutter/material.dart';

// PNG/JPEG
Image.asset(
  'assets/images/icons/logo.png',
  width: 100,
  height: 100,
)

// SVG (cần flutter_svg package)
import 'package:flutter_svg/flutter_svg.dart';

SvgPicture.asset(
  'assets/images/icons/pet-icon.svg',
  width: 24,
  height: 24,
)

// Với error handling
Image.asset(
  'assets/images/icons/logo.png',
  width: 100,
  height: 100,
  errorBuilder: (context, error, stackTrace) {
    return const Icon(Icons.error);
  },
)
```

---

#### Image từ Network (với cache)

```dart
import 'package:cached_network_image/cached_network_image.dart';

CachedNetworkImage(
  imageUrl: 'https://example.com/image.jpg',
  placeholder: (context, url) => const CircularProgressIndicator(),
  errorWidget: (context, url, error) => const Icon(Icons.error),
)
```

---

### 2. Sử Dụng Colors

```dart
import 'package:petties_mobile/config/constants/app_colors.dart';

Container(
  color: AppColors.primary,
  child: Text(
    'Hello',
    style: TextStyle(color: AppColors.white),
  ),
)
```

---

### 3. Sử Dụng Theme

```dart
// Theme được apply tự động trong main.dart
// Sử dụng theme colors trong widgets:

Container(
  color: Theme.of(context).colorScheme.primary,
  child: Text(
    'Hello',
    style: Theme.of(context).textTheme.headlineMedium,
  ),
)

// Hoặc dùng AppColors trực tiếp
Container(
  color: AppColors.primary,
)
```

---

### 4. Sử Dụng Custom Fonts

```dart
TextStyle(
  fontFamily: 'Roboto',
  fontSize: 16,
  fontWeight: FontWeight.bold,
)

// Hoặc trong Theme
TextTheme(
  displayLarge: TextStyle(
    fontFamily: 'Roboto',
    fontSize: 32,
    fontWeight: FontWeight.bold,
  ),
)
```

---

## 🎯 Best Practices

### ✅ DO (Nên Làm)

#### Assets:

1. **Tổ chức theo loại:**
   ```
   assets/images/icons/       # Icons
   assets/images/illustrations/  # Illustrations
   assets/images/avatars/     # Avatars
   ```

2. **Đặt tên rõ ràng:**
   - ✅ `logo.png`, `pet-icon.svg`
   - ❌ `image1.png`, `img.svg`

3. **Optimize images:**
   - Compress PNG/JPEG trước khi thêm
   - Dùng WebP nếu có thể (nhẹ hơn)
   - Resize images về đúng kích thước cần dùng

4. **Khai báo trong pubspec.yaml:**
   ```yaml
   assets:
     - assets/images/        # Khai báo folder
     - assets/images/icons/  # Hoặc file cụ thể
   ```

---

#### Theme:

1. **Tập trung màu sắc:**
   - Tất cả màu định nghĩa trong `AppColors`
   - Không hardcode màu trong widgets

2. **Sử dụng Theme.of(context):**
   ```dart
   // ✅ Good
   Theme.of(context).colorScheme.primary
   Theme.of(context).textTheme.headlineMedium

   // ❌ Bad
   Color(0xFF6C63FF)
   TextStyle(fontSize: 20)
   ```

3. **Tạo custom themes khi cần:**
   ```dart
   // Nếu cần theme riêng cho một screen
   Theme(
     data: Theme.of(context).copyWith(
       primaryColor: Colors.blue,
     ),
     child: MyWidget(),
   )
   ```

---

### ❌ DON'T (Không Nên)

1. **Không hardcode colors:**
   ```dart
   // ❌ Bad
   Container(color: Color(0xFF6C63FF))
   
   // ✅ Good
   Container(color: AppColors.primary)
   ```

2. **Không để assets trong `lib/`:**
   ```
   // ❌ Bad
   lib/assets/images/logo.png
   
   // ✅ Good
   assets/images/icons/logo.png
   ```

3. **Không quên khai báo trong pubspec.yaml:**
   - Nếu không khai báo, Flutter sẽ không tìm thấy assets

4. **Không dùng paths tuyệt đối:**
   ```dart
   // ❌ Bad
   Image.asset('/Users/name/assets/logo.png')
   
   // ✅ Good
   Image.asset('assets/images/icons/logo.png')
   ```

---

## 📝 Checklist Khi Thêm Assets Mới

- [ ] Tạo thư mục phù hợp trong `assets/`
- [ ] Copy file vào đúng thư mục
- [ ] Cập nhật `pubspec.yaml` với path mới
- [ ] Chạy `flutter pub get`
- [ ] Test trên emulator/device
- [ ] Commit cả file assets và `pubspec.yaml`

---

## 🔍 Kiểm Tra Assets Đã Được Load

**Cách 1: Xem trong DevTools**
```bash
flutter pub global run devtools
# Mở tab "Network" để xem assets được load
```

**Cách 2: Error khi run**
```bash
flutter run
# Nếu asset không tìm thấy, sẽ có error:
# Unable to load asset: assets/images/logo.png
```

**Cách 3: Flutter Inspector**
- Trong VS Code/Android Studio
- Mở Flutter Inspector
- Xem widget tree và asset paths

---

## 🎨 Ví Dụ Hoàn Chỉnh

### Thêm Logo và Sử Dụng

**1. Tạo cấu trúc:**
```bash
mkdir -p assets/images/icons
```

**2. Copy logo:**
```bash
# Copy logo.png vào assets/images/icons/
```

**3. Cập nhật pubspec.yaml:**
```yaml
flutter:
  assets:
    - assets/images/icons/
```

**4. Sử dụng trong code:**
```dart
// lib/ui/core/widgets/app_logo.dart
import 'package:flutter/material.dart';

class AppLogo extends StatelessWidget {
  final double? width;
  final double? height;

  const AppLogo({super.key, this.width, this.height});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/icons/logo.png',
      width: width ?? 100,
      height: height ?? 100,
      errorBuilder: (context, error, stackTrace) {
        return const Icon(Icons.pets, size: 100);
      },
    );
  }
}
```

**5. Sử dụng trong app:**
```dart
// lib/ui/home/home_screen.dart
import '../core/widgets/app_logo.dart';

AppLogo(width: 150, height: 150)
```

---

## 🔗 Liên Kết

- [Flutter Assets Documentation](https://docs.flutter.dev/development/ui/assets-and-images)
- [Flutter Theme Documentation](https://docs.flutter.dev/cookbook/design/themes)
- [Flutter SVG Package](https://pub.dev/packages/flutter_svg)

---

## 📚 Tài Liệu Tham Khảo

### Flutter Assets Best Practices

1. **Image Optimization:**
   - Resize images về đúng kích thước
   - Compress PNG/JPEG
   - Consider WebP format

2. **Asset Loading:**
   - Assets được bundle vào app khi build
   - Không thể load assets từ network (phải dùng NetworkImage)
   - Assets paths phải khai báo trong pubspec.yaml

3. **Platform-Specific Assets:**
   - Android: `android/app/src/main/res/`
   - iOS: `ios/Runner/Assets.xcassets/`
   - Flutter assets: `assets/` (shared across platforms)

---

**Last Updated:** 2026

