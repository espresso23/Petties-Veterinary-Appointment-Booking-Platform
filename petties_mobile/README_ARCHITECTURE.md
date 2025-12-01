# Petties Mobile - Clean Architecture

Ứng dụng đặt lịch hẹn thú y được xây dựng với Flutter theo kiến trúc Clean Architecture.

## Cấu trúc dự án

```
lib/
├── config/
│   ├── constants/        # Hằng số ứng dụng (colors, strings, constants)
│   ├── routes/           # Cấu hình routing (GoRouter)
│   └── theme/            # Theme configuration
│
├── core/
│   ├── error/            # Exception và Failure handling
│   ├── network/          # API client, interceptors
│   └── utils/            # Utilities (validators, storage, datetime utils)
│
├── data/
│   ├── models/           # API response models
│   ├── datasources/      # Remote & local data sources
│   │   ├── remote/       # API calls
│   │   └── local/        # Local storage
│   └── repositories/     # Repository implementations
│
├── domain/
│   ├── entities/         # Business entities
│   ├── repositories/     # Abstract repositories
│   └── usecases/         # Business logic
│
├── presentation/
│   ├── screens/          # App screens
│   │   ├── auth/         # Authentication screens
│   │   ├── home/         # Home screen
│   │   └── ...           # Other screens
│   └── widgets/          # Reusable widgets
│
└── main.dart             # App entry point
```

## Tính năng chính

- ✅ Clean Architecture với tách biệt các layer rõ ràng
- ✅ Dependency Injection sẵn sàng
- ✅ Error handling với Either (dartz)
- ✅ API client với Dio và interceptors
- ✅ Local storage với SharedPreferences
- ✅ Routing với GoRouter
- ✅ Theme configuration
- ✅ Reusable widgets
- ✅ Form validation

## Bắt đầu

### Cài đặt dependencies

```bash
flutter pub get
```

### Chạy ứng dụng

```bash
flutter run
```

## Các layer trong Clean Architecture

### 1. Presentation Layer
- **Screens**: UI screens của ứng dụng
- **Widgets**: Reusable UI components
- Không chứa business logic

### 2. Domain Layer
- **Entities**: Business objects thuần túy
- **Repositories**: Abstract interfaces
- **UseCases**: Business logic của ứng dụng
- Không phụ thuộc vào framework hay thư viện bên ngoài

### 3. Data Layer
- **Models**: Data models với JSON serialization
- **DataSources**: Remote (API) và Local (cache) data sources
- **Repositories**: Implementation của domain repositories
- Chuyển đổi giữa models và entities

### 4. Core Layer
- **Error**: Exception và failure handling
- **Network**: API client và interceptors
- **Utils**: Utilities và helper functions

### 5. Config Layer
- **Constants**: App constants, colors, strings
- **Routes**: Routing configuration
- **Theme**: Theme configuration

## Packages đã sử dụng

- `dio` - HTTP client
- `go_router` - Routing
- `provider` - State management
- `dartz` - Functional programming (Either)
- `shared_preferences` - Local storage
- `firebase_core` & `firebase_messaging` - Firebase
- `logger` - Logging
- `intl` - Internationalization

## Tiếp theo

1. Implement các use cases cụ thể
2. Tạo providers cho state management
3. Kết nối với API backend
4. Implement Firebase authentication
5. Thêm các screens và features khác
