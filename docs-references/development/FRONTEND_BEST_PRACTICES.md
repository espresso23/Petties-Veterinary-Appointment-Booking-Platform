# 📁 Chuẩn Cấu Trúc Frontend (React + Vite & Flutter)

Tài liệu này mô tả **cấu trúc thư mục chuẩn** cho web (React + Vite) và mobile (Flutter) trong dự án Petties. Mỗi thư mục có mô tả rõ ràng về mục đích và cách sử dụng, giúp team dễ dàng làm việc và maintain code.

---

## 🕸 React + Vite (Web)

### Cấu Trúc Thư Mục

```text
petties-web/
├── src/
│   ├── app/                    # Bootstrap & Core App Setup
│   │   └── providers.tsx       # Global providers (React Query, Zustand stores, etc.)
│   │
│   ├── pages/                  # Route-based Page Components
│   │   ├── auth/
│   │   │   └── LoginPage.tsx   # Login page
│   │   ├── home/
│   │   │   └── HomePage.tsx    # Home/Dashboard page
│   │   └── index.ts            # Export all pages
│   │
│   ├── components/             # Reusable UI Components
│   │   ├── common/             # Common components (Button, Input, Card, Modal, Table...)
│   │   ├── features/           # Feature-specific components
│   │   │   ├── auth/           # Auth-related components
│   │   │   ├── booking/        # Booking-related components
│   │   │   └── pet/            # Pet-related components
│   │   └── selects/            # Custom Select/Dropdown components
│   │
│   ├── layouts/                # Layout Wrappers
│   │   ├── MainLayout.tsx      # Layout cho main pages (có header, sidebar)
│   │   ├── AuthLayout.tsx      # Layout cho auth pages (minimal)
│   │   └── index.ts            # Export layouts
│   │
│   ├── services/               # API & External Services
│   │   ├── api/
│   │   │   └── client.ts       # Axios instance với interceptors (token, error handling)
│   │   ├── endpoints/          # API endpoint functions
│   │   │   ├── auth.ts         # Auth endpoints (login, register, logout...)
│   │   │   └── index.ts
│   │   └── websocket/          # WebSocket connections
│   │       └── index.ts
│   │
│   ├── store/                  # Global State Management (Zustand)
│   │   ├── authStore.ts        # Authentication state
│   │   └── index.ts            # Export stores
│   │
│   ├── hooks/                  # Custom React Hooks
│   │   ├── useAuth.ts          # Auth-related hooks
│   │   └── index.ts            # Export hooks
│   │
│   ├── types/                  # TypeScript Type Definitions
│   │   ├── api.ts              # API response types
│   │   ├── user.ts             # User-related types
│   │   └── index.ts            # Export types
│   │
│   ├── utils/                  # Utility Functions
│   │   ├── logger.ts           # Logging utilities
│   │   └── index.ts            # Export utils
│   │
│   ├── config/                 # Configuration Files
│   │   ├── env.ts              # Environment variables
│   │   └── routes.ts           # Route constants
│   │
│   ├── assets/                 # Static Assets
│   │   └── react.svg           # Images, icons, fonts
│   │
│   ├── styles/                 # Global Styles
│   │   └── global.css          # Global CSS, CSS variables, Tailwind entry
│   │
│   ├── App.tsx                 # Root Component - Router + Layout setup
│   └── main.tsx                # Entry Point - Mount React + Providers
│
├── public/                     # Static Public Files
│   └── (favicon, manifest.json, robots.txt)
│
├── .env / .env.example         # Environment Variables
├── vite.config.ts              # Vite Configuration (alias, plugins, proxy)
├── tsconfig.json               # TypeScript Configuration
├── package.json                # Dependencies & Scripts
└── Dockerfile                  # Production Build & Serve (Nginx)
```

---

### 📝 Chi Tiết Từng Thư Mục

#### `src/app/`
**Mục đích:** Bootstrap và setup core cho ứng dụng

**Chứa:**
- Global providers (React Query, Zustand stores, Theme providers)
- Error boundaries
- Router helpers

**Ví dụ:**
```tsx
// app/providers.tsx
export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

---

#### `src/pages/`
**Mục đích:** Các component đại diện cho routes/screens

**Quy tắc:**
- Mỗi route = 1 file page
- Tổ chức theo feature: `auth/`, `home/`, `dashboard/`, etc.
- Pages chỉ là container, logic nằm trong hooks hoặc components

**Ví dụ:**
```tsx
// pages/auth/LoginPage.tsx
export function LoginPage() {
  const { login } = useAuth();
  return <LoginForm onSubmit={login} />;
}
```

---

#### `src/components/`
**Mục đích:** Reusable UI components

**Cấu trúc:**
- `common/` - Components dùng chung (Button, Input, Card, Modal, Table)
- `features/` - Components dành riêng cho một feature (AuthForm, BookingCard)
- `selects/` - Custom Select/Dropdown components

**Ví dụ:**
```tsx
// components/common/Button.tsx
export function Button({ children, onClick }) {
  return <button onClick={onClick}>{children}</button>;
}

// components/features/auth/LoginForm.tsx
export function LoginForm({ onSubmit }) {
  // Auth-specific form logic
}
```

---

#### `src/services/`
**Mục đích:** Gọi API và external services

**Cấu trúc:**
- `api/client.ts` - Axios instance với interceptors (token, error handling)
- `endpoints/` - API endpoint functions theo domain (auth.ts, pet.ts, booking.ts)
- `websocket/` - WebSocket connections

**Ví dụ:**
```tsx
// services/api/client.ts
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// services/endpoints/auth.ts
export const authApi = {
  login: (data) => apiClient.post('/auth/login', data),
  register: (data) => apiClient.post('/auth/register', data),
};
```

---

#### `src/store/`
**Mục đích:** Global state management (Zustand)

**Quy tắc:**
- Mỗi domain = 1 store file (authStore.ts, petStore.ts)
- Stores quản lý state và actions

**Ví dụ:**
```tsx
// store/authStore.ts
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  login: async (credentials) => {
    const response = await authApi.login(credentials);
    set({ user: response.data.user, token: response.data.token });
  },
}));
```

---

#### `src/hooks/`
**Mục đích:** Custom React hooks để tái sử dụng logic

**Ví dụ:**
```tsx
// hooks/useAuth.ts
export function useAuth() {
  const { user, login, logout } = useAuthStore();
  return { user, login, logout, isAuthenticated: !!user };
}
```

---

#### `src/types/`
**Mục đích:** TypeScript type definitions

**Quy tắc:**
- Types cho API responses
- Types cho models (User, Pet, Booking)
- Export từ `index.ts`

**Ví dụ:**
```tsx
// types/api.ts
export interface AuthResponse {
  token: string;
  user: User;
}

// types/user.ts
export interface User {
  id: string;
  username: string;
  email: string;
}
```

---

#### `src/config/`
**Mục đích:** Configuration files

**Chứa:**
- `env.ts` - Environment variables wrapper
- `routes.ts` - Route constants

**Ví dụ:**
```tsx
// config/env.ts
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  wsUrl: import.meta.env.VITE_WS_URL,
};

// config/routes.ts
export const routes = {
  home: '/',
  login: '/auth/login',
  register: '/auth/register',
};
```

---

## 📱 Flutter (Mobile App)

### Cấu Trúc Thư Mục

```text
petties_mobile/
├── lib/
│   ├── ui/                     # UI Layer - Tổ chức theo Feature
│   │   ├── core/               # Core UI Components
│   │   │   └── widgets/        # Reusable widgets (Button, TextField, EmptyState, LoadingOverlay)
│   │   ├── auth/               # Auth Feature Screens
│   │   │   ├── login_screen.dart
│   │   │   └── register_screen.dart
│   │   ├── home/               # Home Feature Screens
│   │   │   └── home_screen.dart
│   │   └── ...                 # Khi có feature mới (bookings/, pets/, vets/) thì thêm tại đây
│   │
│   ├── data/                   # Data Layer - Data Access Implementation
│   │   ├── datasources/        # Data Sources
│   │   │   ├── remote/         # Remote Data Source (API)
│   │   │   │   └── auth_remote_datasource.dart
│   │   │   └── local/          # Local Data Source (Cache, Database)
│   │   │       └── auth_local_datasource.dart
│   │   ├── models/             # Data Models (DTOs - Request/Response)
│   │   │   ├── auth_response.dart
│   │   │   ├── user_response.dart
│   │   │   └── base_model.dart
│   │   ├── repositories/       # Repository Implementations
│   │   │   └── auth_repository_impl.dart
│   │   └── services/           # API Services
│   │       ├── api_client.dart      # Dio instance
│   │       ├── api_interceptor.dart # Dio interceptors
│   │       └── auth_service.dart    # Auth API service
│   │
│   ├── providers/              # State Management (Provider)
│   │   └── auth_provider.dart  # AuthProvider - Quản lý auth state
│   │
│   ├── core/                   # Core Utilities & Error Handling
│   │   ├── error/              # Exceptions & Failures
│   │   │   └── exceptions.dart
│   │   ├── network/            # Network utilities
│   │   └── utils/              # General utilities
│   │
│   ├── config/                 # Configuration
│   │   ├── constants/          # Constants
│   │   │   ├── app_colors.dart      # Color palette
│   │   │   ├── app_constants.dart   # App-wide constants (API URLs, timeouts)
│   │   │   └── app_strings.dart     # String constants
│   │   ├── env/                # Environment variables
│   │   └── theme/              # Theme Configuration
│   │       └── app_theme.dart       # Light/Dark themes
│   │
│   ├── routing/                # Navigation & Routing
│   │   ├── app_routes.dart     # Route constants
│   │   └── router_config.dart  # GoRouter configuration
│   │
│   ├── utils/                  # Shared Utilities
│   │   ├── storage_service.dart    # Local storage wrapper
│   │   ├── validators.dart         # Validation functions
│   │   ├── datetime_utils.dart     # Date/time helpers
│   │   └── permission_helper.dart  # Permission handling
│   │
│   └── main.dart               # Entry Point
│
├── assets/                     # Static Assets
│   ├── images/                 # Images
│   │   ├── icons/              # Icons (PNG, SVG)
│   │   ├── illustrations/      # Illustrations
│   │   ├── avatars/            # Default avatars
│   │   ├── backgrounds/        # Background images
│   │   ├── logo/               # Logo files
│   │   └── photos/             # Photo images
│   ├── fonts/                  # Custom fonts
│   ├── lottie/                 # Lottie animations
│   └── data/                   # JSON data files
│
├── test/                       # Tests
│   └── widget_test.dart
│
├── android/ ios/ web/ ...      # Native platform folders (auto-generated)
├── pubspec.yaml                # Dependencies + Assets Declaration
└── README.md                   # Project Documentation
```

---

### 📝 Chi Tiết Từng Thư Mục

#### `lib/ui/`
**Mục đích:** UI Layer - Tổ chức theo Feature (Feature-based organization)

**Cấu trúc:**
- `core/widgets/` - Reusable widgets (Button, TextField, EmptyState, LoadingOverlay)
- `auth/` - Auth screens (LoginScreen, RegisterScreen)
- `home/` - Home screens
- Khi có feature mới: thêm `bookings/`, `pets/`, `vets/`, etc.

**Quy tắc:**
- Mỗi feature = 1 thư mục
- Screens trong feature folder
- Shared widgets trong `core/widgets/`

**Ví dụ:**
```dart
// ui/core/widgets/custom_button.dart
class CustomButton extends StatelessWidget {
  // Reusable button widget
}

// ui/auth/login_screen.dart
class LoginScreen extends StatelessWidget {
  // Login screen UI
}
```

---



#### `lib/data/`
**Mục đích:** Data Access - Implementation của data layer

**Cấu trúc:**
- `datasources/`
  - `remote/` - API calls (AuthRemoteDataSource)
  - `local/` - Local storage/cache (AuthLocalDataSource)
- `models/` - Data models (DTOs) với `@JsonSerializable`
- `repositories/` - Repository implementations (AuthRepositoryImpl)
- `services/` - API services (ApiClient, ApiInterceptor, AuthService)

**Quy tắc:**
- Models có annotations (`@JsonSerializable`, `@JsonKey`)
- Repository implementations implement domain repository interfaces
- Services wrap API calls

**Ví dụ:**
```dart
// data/models/auth_response.dart
@JsonSerializable()
class AuthResponse {
  final String accessToken;
  final String refreshToken;
  // DTO with JSON serialization
}

// data/datasources/remote/auth_remote_datasource.dart
class AuthRemoteDataSource {
  Future<AuthResponse> login(String username, String password) {
    // Make API call
  }
}

// data/repositories/auth_repository_impl.dart
class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  
  @override
  Future<Either<Failure, User>> login(String username, String password) {
    // Implement domain interface
  }
}
```

---

#### `lib/providers/`
**Mục đích:** State Management (Provider pattern)

**Quy tắc:**
- Mỗi feature = 1 provider (AuthProvider, PetProvider)
- Providers extend `ChangeNotifier`
- Providers gọi services/repositories và notify listeners

**Ví dụ:**
```dart
// providers/auth_provider.dart
class AuthProvider extends ChangeNotifier {
  User? _user;
  bool _isLoading = false;
  
  User? get user => _user;
  bool get isLoading => _isLoading;
  
  Future<void> login(String username, String password) async {
    _isLoading = true;
    notifyListeners();
    
    // Call service/repository
    _user = await authService.login(username, password);
    
    _isLoading = false;
    notifyListeners();
  }
}
```

---

#### `lib/config/`
**Mục đích:** Configuration files

**Cấu trúc:**
- `constants/`
  - `app_colors.dart` - Color palette (tất cả màu sắc)
  - `app_constants.dart` - App-wide constants (API URLs, timeouts, pagination)
  - `app_strings.dart` - String constants (labels, messages)
- `theme/`
  - `app_theme.dart` - ThemeData cho light/dark themes

**Ví dụ:**
```dart
// config/constants/app_colors.dart
class AppColors {
  static const Color primary = Color(0xFF6C63FF);
  static const Color secondary = Color(0xFFFF6B9D);
  // All colors defined here
}

// config/constants/app_constants.dart
class AppConstants {
  static const String baseUrl = 'http://10.0.2.2:8080/api';
  static const int connectTimeout = 30000;
}

// config/theme/app_theme.dart
class AppTheme {
  static ThemeData lightTheme = ThemeData(
    primaryColor: AppColors.primary,
    // Theme configuration
  );
}
```

---

#### `lib/routing/`
**Mục đích:** Navigation & Routing (GoRouter)

**Cấu trúc:**
- `app_routes.dart` - Route constants
- `router_config.dart` - GoRouter configuration với redirect logic

**Ví dụ:**
```dart
// routing/app_routes.dart
class AppRoutes {
  static const String root = '/';
  static const String login = '/auth/login';
  static const String home = '/home';
}

// routing/router_config.dart
class AppRouterConfig {
  static GoRouter createRouter(AuthProvider authProvider) {
    return GoRouter(
      routes: [
        GoRoute(path: AppRoutes.login, builder: ...),
        GoRoute(path: AppRoutes.home, builder: ...),
      ],
      redirect: (context, state) {
        // Redirect logic based on auth state
      },
    );
  }
}
```

---

#### `lib/utils/`
**Mục đích:** Utility functions

**Chứa:**
- `storage_service.dart` - Local storage wrapper (SharedPreferences)
- `validators.dart` - Validation functions
- `datetime_utils.dart` - Date/time helpers
- `permission_helper.dart` - Permission handling

**Ví dụ:**
```dart
// utils/storage_service.dart
class StorageService {
  Future<void> setString(String key, String value) async {
    await SharedPreferences.getInstance().then((prefs) {
      prefs.setString(key, value);
    });
  }
}
```

---

#### `assets/`
**Mục đích:** Static assets

**Cấu trúc:**
- `images/` - Images (icons, illustrations, avatars, backgrounds, logo, photos)
- `fonts/` - Custom fonts (TTF, OTF)
- `lottie/` - Lottie animations (JSON)
- `data/` - JSON data files

**Quan trọng:**
- Phải khai báo trong `pubspec.yaml`
- Sau khi thêm assets, chạy `flutter pub get`

**Ví dụ `pubspec.yaml`:**
```yaml
flutter:
  assets:
    - assets/images/icons/
    - assets/images/illustrations/
    - assets/lottie/
```

---

## 💡 Nguyên Tắc Chung

### 1. **Feature-Based UI, Layer-Based Data/Domain**

**Web:**
- UI tổ chức theo feature: `components/features/auth/`, `pages/auth/`
- Services/Store tổ chức theo layer: `services/api/`, `store/authStore.ts`

**Mobile:**
- UI tổ chức theo feature: `ui/auth/`, `ui/home/`
- Data/Domain tổ chức theo layer: `data/repositories/`, `domain/usecases/`

**Lợi ích:**
- Dễ scale khi có feature mới
- Dễ phân công việc (frontend dev làm UI, backend dev làm data layer)
- Dễ test và maintain

---

### 2. **Config/Env/Routes Tách Riêng**

**Không hard-code:**
- ❌ `const url = 'http://localhost:8080/api'` trong component
- ✅ `const url = env.apiBaseUrl` từ `config/env.ts`

**Lợi ích:**
- Dễ thay đổi config giữa dev/staging/prod
- Centralized configuration
- Type-safe với TypeScript

---

### 3. **Assets/Styles/Utils Độc Lập**

**Tái sử dụng:**
- Assets có thể share giữa web & mobile (nếu cùng brand)
- Utils có thể được copy và adapt cho cả 2 platforms

**Lợi ích:**
- Consistent branding
- Giảm duplicate code

---

### 4. **Mỗi Thư Mục Đúng Một Trách Nhiệm**

**Single Responsibility Principle:**
- `components/` - Chỉ chứa UI components
- `services/` - Chỉ chứa API calls
- `store/` - Chỉ chứa state management
- `utils/` - Chỉ chứa utility functions

**Lợi ích:**
- Dev mới nhìn vào biết phải thêm code ở đâu
- Dễ tìm và sửa code
- Giảm coupling

---

### 5. **Service/API Chuẩn Hóa**

**Web (Axios):**
- Interceptors cho token, error handling
- Centralized error handling

**Mobile (Dio):**
- Interceptors cho token, error handling
- Centralized error handling

**Lợi ích:**
- Consistent API calls
- Centralized token management
- Better error handling

---

### 6. **Đơn Giản Cho v0.0.1**

**Không over-engineer:**
- Chỉ dùng `main.dart` duy nhất (không phân biệt dev/staging/prod entry points)
- Firebase init đã comment - bật lại khi cần
- Không tối ưu premature (build tính năng trước, optimize sau)

**Lợi ích:**
- Dễ setup và chạy
- Không phức tạp không cần thiết
- Focus vào build features

---

### 7. **Layered Architecture (Mobile)**

**Flow:**
```
UI → Provider → Data
```

- **UI**: Widgets & Screens
- **Provider**: State Management & Business Logic (Bridge)
- **Data**: API Calls & Storage

**Lợi ích:**
- Simplified: Giảm boilerplate code
- Provider Pattern: Quản lý state hiệu quả
- Separation of Concerns: UI tách biệt với Data

---

## 📚 Best Practices

### Web (React + Vite)

1. **Component Organization:**
   - Small, focused components
   - Extract logic vào hooks
   - Use TypeScript cho type safety

2. **State Management:**
   - Local state → `useState`
   - Shared state → Zustand stores
   - Server state → React Query

3. **API Calls:**
   - Tất cả API calls qua `services/endpoints/`
   - Không gọi API trực tiếp trong components
   - Use interceptors cho token/error handling

4. **Routing:**
   - Route constants trong `config/routes.ts`
   - Use React Router
   - Protected routes với wrapper

---

### Mobile (Flutter)

1. **Widget Organization:**
   - Small, reusable widgets
   - Extract logic vào providers/use cases
   - Use const constructors khi có thể

2. **State Management:**
   - Local state → `StatefulWidget`
   - Shared state → Provider
   - Complex state → Combine providers

3. **API Calls:**
   - Tất cả API calls qua `data/services/`
   - Use interceptors cho token/error handling
   - Handle errors trong provider layer

4. **Navigation:**
   - Route constants trong `routing/app_routes.dart`
   - Use GoRouter
   - Protected routes với redirect logic

5. **Layered Architecture:**
   - Data Layer: Models (DTOs), Services, Repositories
   - Provider Layer: Business Logic & State
   - UI Layer: Screens & Widgets

---

## ✅ Checklist Khi Thêm Feature Mới

### Web:
- [ ] Tạo page trong `pages/[feature]/`
- [ ] Tạo components trong `components/features/[feature]/`
- [ ] Tạo API endpoints trong `services/endpoints/[feature].ts`
- [ ] Tạo store trong `store/[feature]Store.ts` (nếu cần)
- [ ] Tạo types trong `types/[feature].ts`
- [ ] Tạo hooks trong `hooks/use[Feature].ts` (nếu cần)
- [ ] Thêm routes trong `config/routes.ts`
- [ ] Update `App.tsx` với routes mới

### Mobile:
- [ ] Tạo screens trong `ui/[feature]/`
- [ ] Tạo widgets trong `ui/core/widgets/` (nếu reusable)
- [ ] Tạo entities trong `domain/entities/[feature].dart`
- [ ] Tạo repository interface trong `domain/repositories/[feature]_repository.dart`
- [ ] Tạo use cases trong `domain/usecases/[feature]_usecases.dart`
- [ ] Tạo models trong `data/models/[feature]_response.dart`
- [ ] Tạo datasources trong `data/datasources/remote/[feature]_remote_datasource.dart`
- [ ] Tạo repository implementation trong `data/repositories/[feature]_repository_impl.dart`
- [ ] Tạo service trong `data/services/[feature]_service.dart`
- [ ] Tạo provider trong `providers/[feature]_provider.dart`
- [ ] Thêm routes trong `routing/app_routes.dart`
- [ ] Update `router_config.dart` với routes mới

---

## 🔗 Liên Kết Tài Liệu

### Web:
- [petties-web/README.md](../../petties-web/README.md) - Web project documentation

### Mobile:
- [petties_mobile/README.md](../../petties_mobile/README.md) - Mobile project documentation
- [petties_mobile/README_ARCHITECTURE.md](../../petties_mobile/README_ARCHITECTURE.md) - Architecture details
- [petties_mobile/ASSETS_AND_THEME_GUIDE.md](../../petties_mobile/ASSETS_AND_THEME_GUIDE.md) - Assets & Theme guide

---

**Last Updated:** 2026  
**Maintained By:** Petties Team
