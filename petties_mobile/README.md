# Petties Mobile App

**Mobile App cho Petties - Veterinary Appointment Booking Platform**

```
Version: 1.0.0 (Development)
Status:  🚧 In Development (Mobile not released)
Stack:   Flutter 3.5 | Dart | GoRouter | Provider
```

---

## 📋 Overview

Petties Mobile App là ứng dụng di động được xây dựng với **Flutter 3.5**, cung cấp giao diện mobile cho các role được hỗ trợ trong hệ thống Petties.

### Platform Support by Role

| Role | Mobile Support | Notes |
|------|----------------|-------|
| **PET_OWNER** | ✅ | Mobile only - Primary platform |
| **VET** | ✅ | Web + Mobile - Vet dashboard |
| **CLINIC_OWNER** | ❌ | Web only - Blocked on mobile |
| **CLINIC_MANAGER** | ❌ | Web only - Blocked on mobile |
| **ADMIN** | ❌ | Web only - Blocked on mobile |

---

## 📦 Application Identity

| Platform | Package/Bundle ID | Notes |
|----------|-------------------|-------|
| **Android** | `world.petties.mobile` | Play Store ID |
| **iOS** | `world.petties.mobile` | App Store ID |
| **macOS** | `world.petties.mobile` | Mac App Store |
| **Linux** | `world.petties.mobile` | Linux builds |

> **Note**: Dev và Prod dùng cùng Application ID. Flavors chỉ thay đổi URL endpoints.

---

## 🛠️ Tech Stack

### Core Technologies
- **Flutter 3.5** - Cross-platform framework
- **Dart** - Programming language

### State Management
- **Provider** - State management solution

### Navigation & Routing
- **GoRouter** - Declarative routing with guards
- **Role-based Routing** - Automatic redirect based on user role

### Storage
- **SharedPreferences** - Local key-value storage
- **Hive** - Fast NoSQL database (if needed)

### HTTP Client
- **Dio** - HTTP client for API calls
- **http** - Alternative HTTP client

### Other Dependencies
- **Firebase Core** - Firebase integration
- **Firebase Messaging** - Push notifications
- **Google Maps Flutter** - Maps integration
- **Image Picker** - Image selection
- **Geolocator** - Location services

---

## 📁 Project Structure

```
petties_mobile/
├── lib/
│   ├── config/              # Configuration
│   │   ├── constants/       # App constants
│   │   ├── routes/          # Route definitions (legacy)
│   │   └── theme/           # Theme configuration
│   ├── core/                # Core utilities
│   │   ├── error/           # Error handling
│   │   ├── network/         # API client
│   │   └── utils/           # Utilities
│   ├── data/                # Data layer
│   │   ├── models/          # Data models
│   │   ├── datasources/     # Data sources (remote/local)
│   │   └── repositories/    # Repository implementations
│   ├── domain/              # Domain layer
│   │   ├── entities/        # Business entities
│   │   ├── repositories/    # Repository interfaces
│   │   └── usecases/        # Business logic
│   ├── presentation/        # Presentation layer (legacy)
│   │   └── screens/         # Screen widgets
│   ├── providers/           # State providers
│   │   └── auth_provider.dart
│   ├── routing/             # Navigation & routing
│   │   ├── router_config.dart
│   │   └── app_routes.dart
│   ├── ui/                  # UI components
│   │   ├── auth/            # Authentication screens
│   │   ├── pet_owner/       # Pet owner screens
│   │   ├── vet/             # Vet screens
│   │   ├── clinic_owner/    # Clinic owner screens
│   │   └── core/            # Core widgets
│   └── main.dart            # App entry point
├── android/                 # Android configuration
├── ios/                     # iOS configuration
├── pubspec.yaml             # Dependencies
└── README.md                # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Flutter SDK 3.5+
- Dart SDK (included with Flutter)
- Android Studio / VS Code
- Android SDK / Xcode (for iOS)

### Installation

```bash
# 1. Navigate to mobile folder
cd petties_mobile

# 2. Get Flutter packages
flutter pub get

# 3. Run on emulator/device (Development)
flutter run --flavor dev --dart-define=FLAVOR=dev

# Or specify device
flutter run -d <device_id> --flavor dev --dart-define=FLAVOR=dev
```

### Build Commands

#### Development Build
```bash
# Run on emulator (uses localhost:8080)
flutter run --flavor dev --dart-define=FLAVOR=dev

# Build APK dev
flutter build apk --flavor dev --dart-define=FLAVOR=dev

# Build iOS dev
flutter build ios --flavor dev --dart-define=FLAVOR=dev
```

#### Production Build
```bash
# Run production (uses api.petties.world)
flutter run --flavor prod --dart-define=FLAVOR=prod

# Build APK production
flutter build apk --release --flavor prod --dart-define=FLAVOR=prod

# Build App Bundle (for Play Store)
flutter build appbundle --release --flavor prod --dart-define=FLAVOR=prod

# Build iOS (for App Store)
flutter build ios --release --flavor prod --dart-define=FLAVOR=prod
```

> 📘 Chi tiết đầy đủ về Flavors: [FLAVORS_SETUP.md](FLAVORS_SETUP.md)

---

## 📊 Feature Implementation Status

### ✅ Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication** | ✅ Done | Login screen with JWT handling |
| **Google Sign-In** | ✅ Done | Google OAuth integration (PET_OWNER auto-role) |
| **Role-based Routing** | ✅ Done | GoRouter with role guards |
| **Role Restrictions** | ✅ Done | ADMIN/CLINIC_MANAGER/CLINIC_OWNER blocked (web only) |
| **Auth Provider** | ✅ Done | JWT token management |
| **Home Screens** | ✅ Done | Pet Owner, Vet |
| **Flavors** | ✅ Done | Dev/Prod environment switching |

> 📘 Google Sign-In setup: [GOOGLE_SIGNIN_SETUP.md](GOOGLE_SIGNIN_SETUP.md)

### 🔄 In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| **Register Screen** | 🔄 Placeholder | UI skeleton only |

### ⚠️ Not Yet Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| **Booking Flow** | ⚠️ TODO | Not implemented |
| **Pet Management** | ⚠️ TODO | Not implemented |
| **Profile & Settings** | ⚠️ TODO | Not implemented |
| **Notifications** | ⚠️ TODO | Firebase integration |
| **Payment Integration** | ⚠️ TODO | Stripe SDK |
| **Chat Interface** | ⚠️ TODO | Not implemented |

---

## 🔐 Authentication & Routing

### Role-based Access

The app automatically redirects users based on their role after login:

- **PET_OWNER** → `/pet-owner/home`
- **VET** → `/vet/home`
- **CLINIC_OWNER** → Blocked (web only)
- **CLINIC_MANAGER** → Blocked (web only)
- **ADMIN** → Blocked (web only)

### Routing Guards

- **Unauthenticated users** → Redirected to `/login`
- **Authenticated users on login** → Redirected to role-specific home
- **Blocked roles** → Shown error message on login screen

---

## 🔌 API Integration

### Backend API (Spring Boot)

| Environment | Base URL | AI Service URL |
|-------------|----------|----------------|
| **Development** | `http://10.0.2.2:8080/api` | `http://10.0.2.2:8000` |
| **Production** | `https://api.petties.world/api` | `https://ai.petties.world` |

- **Authentication:** JWT Bearer token
- **Endpoints:**
  - `/auth/login` - Authentication ✅
  - `/auth/register` - Registration ⚠️ (Not implemented)
  - `/auth/me` - Current user info ✅
  - `/pets` - Pet management ⚠️ (Not implemented)
  - `/bookings` - Booking management ⚠️ (Not implemented)

### Environment Selection

URLs tự động chuyển đổi theo flavor:
- **dev**: Sử dụng localhost/emulator URLs
- **prod**: Sử dụng production URLs

### Platform-Specific URLs (Development)

| Platform | localhost alias |
|----------|----------------|
| **Android Emulator** | `10.0.2.2` |
| **iOS Simulator** | `localhost` |
| **Physical Device** | Dùng IP máy host (e.g., `192.168.1.100`) |

---

## 🧪 Testing

```bash
# Run unit tests
flutter test

# Run integration tests
flutter test integration_test/

# Run with coverage
flutter test --coverage
```

---

## 📚 Documentation

- [Architecture Guide](README_ARCHITECTURE.md) - Clean Architecture overview
- [Team Collaboration Guide](TEAM_COLLABORATION_GUIDE.md) - Git workflow, setup
- [Run on Emulator Guide](RUN_ON_EMULATOR.md) - Emulator setup instructions
- [Assets & Theme Guide](ASSETS_AND_THEME_GUIDE.md) - Design system
- [Main README](../README.md) - Project overview

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'feat: add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open Pull Request

---

**Last Updated:** December 14, 2025  
**Status:** 🚧 In Development (Mobile not released)
