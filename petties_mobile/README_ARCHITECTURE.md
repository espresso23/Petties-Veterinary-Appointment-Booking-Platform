# Petties Mobile - Architecture

Ứng dụng đặt lịch hẹn thú y được xây dựng với Flutter.

## Cấu trúc dự án

```
lib/
├── config/
│   ├── constants/        # Hằng số ứng dụng (colors, strings, constants)
│   ├── env/              # Environment configuration
│   └── theme/            # Theme configuration
│
├── core/
│   ├── error/            # Exception handling
│   ├── network/          # Network utilities
│   └── utils/            # Core utilities
│
├── data/
│   ├── models/           # API response/request models
│   ├── datasources/      # Remote & local data sources
│   ├── services/         # API services (auth, api_client, etc.)
│   └── repositories/     # Repository implementations
│
├── providers/            # State management (Provider/ChangeNotifier)
│
├── routing/              # GoRouter configuration
│   ├── app_routes.dart   # Route constants
│   └── router_config.dart # Router setup
│
├── ui/                   # User Interface
│   ├── auth/             # Authentication screens
│   ├── core/             # Shared UI components
│   ├── home/             # Home screens
│   ├── onboarding/       # Onboarding flow
│   ├── pet_owner/        # Pet owner screens
│   └── vet/              # Veterinarian screens
│
├── utils/                # Utility classes
│   ├── storage_service.dart
│   └── validators.dart
│
└── main.dart             # App entry point
```

## Các layer

### 1. UI Layer (`ui/`)
- **Screens**: App screens với Neobrutalism design
- **Core widgets**: Reusable UI components
- Sử dụng Provider để truy cập state

### 2. Provider Layer (`providers/`)
- **AuthProvider**: Quản lý authentication state
- Business logic kết nối UI và Data layer

### 3. Data Layer (`data/`)
- **Models**: Data models với JSON serialization
- **Services**: API calls (AuthService, ApiClient)
- **Repositories**: Data access abstraction

### 4. Core Layer (`core/`)
- **Error**: Exception handling
- **Utils**: Storage, validators, helpers

### 5. Config Layer (`config/`)
- **Constants**: App constants, colors, strings
- **Env**: Environment-specific configuration
- **Theme**: Material theme configuration

## Packages chính

- `dio` - HTTP client
- `go_router` - Routing
- `provider` - State management
- `shared_preferences` - Local storage
- `firebase_core` & `google_sign_in` - Authentication
