# Petties Mobile App

**Mobile App cho Petties - Veterinary Appointment Booking Platform**

```
Version: 1.0.0 (Development)
Status:  In Development (Not Yet Deployed)
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
| **CLINIC_OWNER** | ✅ | Web + Mobile - Clinic management |
| **ADMIN** | ❌ | Web only - Blocked on mobile |
| **CLINIC_MANAGER** | ❌ | Web only - Blocked on mobile |

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

# 3. Run on emulator/device
flutter run

# Or specify device
flutter run -d <device_id>
```

### Build

```bash
# Build APK (Android)
flutter build apk

# Build IPA (iOS)
flutter build ios

# Build App Bundle (Android - for Play Store)
flutter build appbundle
```

---

## 📊 Feature Implementation Status

### ✅ Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication** | ✅ Done | Login screen with JWT handling |
| **Role-based Routing** | ✅ Done | GoRouter with role guards |
| **Role Restrictions** | ✅ Done | ADMIN/CLINIC_MANAGER blocked |
| **Auth Provider** | ✅ Done | JWT token management |
| **Home Screens** | ✅ Done | Pet Owner, Vet, Clinic Owner |

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
- **CLINIC_OWNER** → `/clinic-owner/home`
- **ADMIN** → Blocked (redirected to login with error message)
- **CLINIC_MANAGER** → Blocked (redirected to login with error message)

### Routing Guards

- **Unauthenticated users** → Redirected to `/login`
- **Authenticated users on login** → Redirected to role-specific home
- **Blocked roles** → Shown error message on login screen

---

## 🔌 API Integration

### Backend API (Spring Boot)
- **Base URL:** `http://localhost:8080/api` (development)
- **Authentication:** JWT Bearer token
- **Endpoints:**
  - `/auth/login` - Authentication ✅
  - `/auth/register` - Registration ⚠️ (Not implemented)
  - `/auth/me` - Current user info ✅
  - `/pets` - Pet management ⚠️ (Not implemented)
  - `/bookings` - Booking management ⚠️ (Not implemented)

### Development Notes

- **Android Emulator:** Use `10.0.2.2` instead of `localhost` for API calls
- **iOS Simulator:** Use `localhost` directly
- **Physical Device:** Use your machine's IP address (same WiFi network)

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

**Last Updated:** December 8, 2025  
**Status:** 🚧 In Development - Not Yet Deployed
