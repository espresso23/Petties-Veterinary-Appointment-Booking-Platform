# 👥 Hướng Dẫn Làm Việc Nhóm với Flutter (Mac + Windows)

Guide ngắn gọn để team làm việc hiệu quả khi có cả Mac và Windows developers.

---

## 📋 Mục Lục

- [1. Git Configuration](#1-git-configuration)
- [2. IDE Setup](#2-ide-setup)
- [3. File Paths & Dependencies](#3-file-paths--dependencies)
- [4. Common Issues](#4-common-issues)
- [5. Best Practices](#5-best-practices)

---

## 1. Git Configuration

### ✅ Line Endings (Quan trọng nhất!)

**Windows:**
```bash
git config --global core.autocrlf true
```

**Mac/Linux:**
```bash
git config --global core.autocrlf input
```

**Trong project (tất cả members):**
Tạo file `.gitattributes` trong root project:
```gitattributes
# Auto detect text files and perform LF normalization
* text=auto

# Source code
*.dart text eol=lf
*.yaml text eol=lf
*.yml text eol=lf
*.json text eol=lf
*.md text eol=lf

# Build files (binary)
*.apk binary
*.ipa binary
*.app binary
```

### ✅ Git Ignore

Đảm bảo `.gitignore` bao gồm:
```
# Flutter
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
build/
**/android/.gradle/
**/android/.idea/
**/android/app/debug
**/android/app/profile
**/android/app/release
**/ios/.symlinks/
**/ios/Pods/
**/ios/.generated/
**/ios/Flutter/Flutter.framework
**/ios/Flutter/Flutter.podspec

# IDE
.idea/
.vscode/
*.iml
*.ipr
*.iws

# OS
.DS_Store (Mac)
Thumbs.db (Windows)
desktop.ini (Windows)
```

---

## 2. IDE Setup

### ✅ VS Code (Khuyến nghị cho cả team)

**Extensions cần cài:**
- Flutter
- Dart
- Error Lens
- Flutter Widget Snippets

**Settings (`settings.json`):**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "Dart-Code.dart-code",
  "[dart]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "Dart-Code.dart-code",
    "editor.tabSize": 2,
    "editor.insertSpaces": true
  },
  "files.eol": "\n",  // Use LF for all files
  "files.encoding": "utf8",
  "dart.lineLength": 100
}
```

### ✅ Android Studio (Optional)

**Settings:**
- File → Settings → Editor → Code Style → Dart
- Set "Hard wrap at" = 100
- Enable "Enable EditorConfig support"

---

## 3. File Paths & Dependencies

### ⚠️ Không hardcode paths!

**❌ SAI:**
```dart
final path = 'C:/Users/Name/Documents/file.txt';  // Windows only
final path = '/Users/name/Documents/file.txt';    // Mac only
```

**✅ ĐÚNG:**
```dart
import 'package:path_provider/path_provider.dart';

final directory = await getApplicationDocumentsDirectory();
final path = '${directory.path}/file.txt';  // Works on all platforms
```

### ✅ Package Dependencies

**Luôn dùng relative paths trong `pubspec.yaml`:**
```yaml
dependencies:
  # ✅ Good - uses pub.dev
  dio: ^5.7.0
  
  # ❌ Avoid - local paths
  # my_package:
  #   path: /Users/name/packages/my_package  # Mac only
```

---

## 4. Common Issues

### 🔧 Issue 1: Build Errors trên Mac/Windows khác nhau

**Nguyên nhân:** Different Gradle/Kotlin cache paths

**Giải pháp:**
```bash
# Khi gặp build errors, clean trước:
flutter clean
flutter pub get
cd android
./gradlew clean  # Mac/Linux
.\gradlew clean  # Windows
cd ..
flutter run
```

### 🔧 Issue 2: "Command not found" hoặc "File not found"

**Nguyên nhân:** Different PATH configuration

**Giải pháp:**
- **Windows:** Đảm bảo Flutter đã thêm vào PATH
- **Mac:** Đảm bảo đã cấu hình trong `.zshrc` hoặc `.bash_profile`

```bash
# Mac (.zshrc or .bash_profile)
export PATH="$PATH:$HOME/flutter/bin"

# Windows: Thêm vào System Environment Variables
```

### 🔧 Issue 3: iOS Build chỉ chạy trên Mac

**Giải pháp:**
- **Windows developers:** Chỉ build Android
- **Mac developers:** Build cả iOS và Android
- **CI/CD:** Dùng GitHub Actions với Mac runner cho iOS

### 🔧 Issue 4: File Permissions

**Mac/Linux:** Có thể cần `chmod +x`
**Windows:** Không cần

**Giải pháp:** Không commit executable permissions vào Git

---

## 5. Best Practices

### ✅ 1. Luôn format code trước khi commit

```bash
# Format toàn bộ code
flutter format .

# Analyze code
flutter analyze
```

**Hoặc cấu hình pre-commit hook:**
```bash
# .git/hooks/pre-commit
#!/bin/sh
flutter format .
git add .
```

### ✅ 2. Đồng bộ dependencies

```bash
# Sau khi pull code từ Git
flutter pub get

# Kiểm tra packages outdated
flutter pub outdated
```

### ✅ 3. Test trên cả 2 platforms

- **Windows devs:** Test trên Android emulator
- **Mac devs:** Test trên cả Android và iOS simulator
- **Review code:** Check cả 2 platforms trước khi merge

### ✅ 4. Environment Variables

**Không commit files có chứa paths cụ thể:**

**❌ SAI:**
```dart
// config.dart
const apiUrl = 'http://localhost:8080';  // Windows localhost
```

**✅ ĐÚNG:**
```dart
// config.dart
const apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://localhost:8080',
);
```

**Hoặc dùng `.env` files:**
```bash
# .env.example (commit vào Git)
API_URL=http://localhost:8080

# .env (không commit, mỗi dev tạo riêng)
API_URL=http://10.0.2.2:8080  # Android emulator
```

### ✅ 5. Code Review Checklist

Trước khi merge PR, check:

- [ ] Code đã format (`flutter format .`)
- [ ] Không có linter errors (`flutter analyze`)
- [ ] Không hardcode paths
- [ ] Test trên ít nhất 1 platform
- [ ] Không commit `.env` hoặc credentials
- [ ] Line endings consistent (LF)

---

## 📝 Quick Reference

### Commands cho tất cả members:

```bash
# 1. Pull code mới
git pull
flutter pub get

# 2. Format code
flutter format .

# 3. Check linter
flutter analyze

# 4. Clean build (khi có lỗi)
flutter clean
flutter pub get

# 5. Build & Run
flutter run
```

### Commands chỉ cho Mac:

```bash
# Build iOS
flutter build ios

# Run on iOS Simulator
open -a Simulator
flutter run
```

### Commands chỉ cho Windows:

```bash
# Build Android APK
flutter build apk

# List emulators
flutter devices
```

---

## 🚨 Important Notes

1. **Không commit `build/` folder** - Đã có trong `.gitignore`
2. **Không commit `*.iml`, `.idea/`, `.vscode/`** - IDE-specific files
3. **Luôn dùng `pub.dev` packages** - Tránh local paths
4. **Test trên real device/emulator** - Không chỉ test trên máy mình
5. **Communicate về breaking changes** - Nếu thay đổi dependencies lớn

---

## 📚 Resources

- [Flutter Platform Channels](https://docs.flutter.dev/platform-integration/platform-channels)
- [Flutter Environment Variables](https://docs.flutter.dev/deployment/environment-variables)
- [Git Attributes](https://git-scm.com/docs/gitattributes)

---

**Chúc team làm việc hiệu quả! 🚀**

