# Source Code Management Rules - Team 5 Members

Quy tắc quản lý source code cho team Petties (5 người).

---

## Team Structure

| Role | Member | Responsibilities | Stack |
|------|--------|------------------|-------|
| **Team Leader** | Tân (SE181717) | Architecture, Code Review Final, Release Management | Full-stack |
| **Backend Dev 1** | Tuân (DE180807) | Auth, User, Security | Spring Boot |
| **Backend Dev 2** | Triết (DE180687) | Booking, Pet, Clinic | Spring Boot |
| **Frontend Dev** | Huyền (DE180773) | Web Application | React, TypeScript |
| **Mobile Dev** | Uyên (DE180893) | Mobile Application | Flutter |

---

## 1. Branch Protection Rules

### Branch Structure
```
main (production) ─── Protected, requires 2 approvals
  │
  └── develop (integration) ─── Protected, requires 1 approval
        │
        ├── feature/* ─── Individual work
        ├── bugfix/* ─── Bug fixes
        └── hotfix/* ─── Emergency fixes (from main)
```

### Protection Settings (GitHub)

**Main Branch:**
- Require PR before merging
- Require 2 approvals (bắt buộc Team Leader + 1 người khác)
- Require status checks to pass
- Require conversation resolution
- Do not allow force pushes
- Do not allow deletions

**Develop Branch:**
- Require PR before merging
- Require 1 approval
- Require status checks to pass
- Do not allow force pushes

---

## 2. Code Review Process

### Review Assignment Matrix

| PR Author | Primary Reviewer | Secondary Reviewer (nếu cần) |
|-----------|------------------|------------------------------|
| Tân | Tuân | Triết |
| Tuân | Tân | Triết |
| Triết | Tân | Tuân |
| Huyền | Tân | Tuân/Triết |
| Uyên | Tân | Huyền |

### Review Checklist

**Functional Review:**
- [ ] Code thực hiện đúng yêu cầu?
- [ ] Logic có đúng không?
- [ ] Edge cases được xử lý?
- [ ] Error handling đầy đủ?

**Code Quality:**
- [ ] Code readable và maintainable?
- [ ] Không có code duplicate?
- [ ] Naming conventions đúng?
- [ ] Comments cần thiết có đủ?

**Security:**
- [ ] Không hardcode credentials?
- [ ] Input validation đầy đủ?
- [ ] SQL injection/XSS được ngăn chặn?
- [ ] Sensitive data được bảo vệ?

**Performance:**
- [ ] Không có N+1 queries?
- [ ] Không có memory leaks?
- [ ] API response time hợp lý?

**Testing:**
- [ ] Unit tests pass?
- [ ] Test coverage đủ?
- [ ] Manual testing đã thực hiện?

### Review Timeline

| PR Size | Max Review Time |
|---------|-----------------|
| Small (< 100 lines) | 4 giờ |
| Medium (100-300 lines) | 8 giờ |
| Large (300-500 lines) | 24 giờ |
| Extra Large (> 500 lines) | Cần chia nhỏ PR |

---

## 3. Coding Standards

### 3.1 Java/Spring Boot

**Naming Conventions:**
```java
// Classes: PascalCase
public class UserService { }
public class BookingController { }

// Methods & Variables: camelCase
public void createUser() { }
private String username;
private String fullName;

// Constants: UPPER_SNAKE_CASE
public static final String JWT_SECRET = "secret";

// Packages: lowercase
package com.petties.petties.service;
```

**File Structure:**
```
src/main/java/com/petties/petties/
├── config/          # Configuration classes
├── controller/      # REST Controllers
├── service/         # Business logic
├── repository/      # Data access
├── model/           # Entity classes
├── dto/             # Data Transfer Objects
│   ├── request/     # Request DTOs
│   └── response/    # Response DTOs
├── exception/       # Custom exceptions
└── util/            # Utility classes
```

**Best Practices:**
```java
// DTO Validation - Sử dụng tiếng Việt cho message
public class CreatePetRequest {
    @NotBlank(message = "Tên thú cưng không được để trống")
    @Size(min = 2, max = 100, message = "Tên phải từ 2-100 ký tự")
    private String name;
}

// Service - Throw custom exceptions
public Pet getPetById(UUID id) {
    return petRepository.findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng"));
}

// Controller - Use ResponseEntity
@PostMapping
public ResponseEntity<PetResponse> createPet(@Valid @RequestBody CreatePetRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(petService.createPet(request));
}
```

### 3.2 React/TypeScript

**Naming Conventions:**
```typescript
// Components: PascalCase
const UserProfile: React.FC = () => { }
const BookingCard: React.FC<BookingCardProps> = () => { }

// Hooks: camelCase with 'use' prefix
const useAuth = () => { }
const useBookingList = () => { }

// Files: PascalCase for components
UserProfile.tsx
BookingCard.tsx

// Types/Interfaces: PascalCase
interface UserData { }
type BookingStatus = 'pending' | 'confirmed' | 'completed';
```

**File Structure:**
```
src/
├── components/
│   ├── common/       # Shared components (Button, Input, Modal)
│   └── features/     # Feature-specific components
│       ├── auth/
│       ├── booking/
│       └── pet/
├── pages/            # Route pages
├── services/         # API calls
│   ├── api/
│   └── endpoints/
├── store/            # State management (Zustand)
├── hooks/            # Custom hooks
├── types/            # TypeScript types
├── utils/            # Utility functions
└── config/           # Configuration
```

**Best Practices:**
```typescript
// Type everything
interface BookingFormProps {
  petId: string;
  onSubmit: (data: BookingData) => void;
  isLoading?: boolean;
}

// Use functional components with hooks
const BookingForm: React.FC<BookingFormProps> = ({ petId, onSubmit, isLoading = false }) => {
  const [formData, setFormData] = useState<BookingData>(initialData);

  // ...
};

// API calls in services, not components
// services/endpoints/booking.ts
export const bookingApi = {
  create: (data: CreateBookingRequest) => apiClient.post('/bookings', data),
  getById: (id: string) => apiClient.get(`/bookings/${id}`),
};
```

### 3.3 Flutter/Dart

**Naming Conventions:**
```dart
// Classes: PascalCase
class UserService { }
class BookingScreen { }

// Methods & Variables: camelCase
void createBooking() { }
String username;

// Files: snake_case
user_service.dart
booking_screen.dart

// Constants: lowerCamelCase or SCREAMING_CAPS
const defaultPadding = 16.0;
const API_BASE_URL = 'http://localhost:8080';
```

**File Structure:**
```
lib/
├── ui/               # UI Layer (Feature-based)
│   ├── core/widgets/ # Shared widgets
│   ├── auth/         # Auth screens
│   ├── home/         # Home screens
│   └── booking/      # Booking screens
├── domain/           # Business Logic (Pure Dart)
│   ├── entities/     # Domain entities
│   ├── repositories/ # Repository interfaces
│   └── usecases/     # Use cases
├── data/             # Data Layer
│   ├── models/       # DTOs
│   ├── datasources/  # API/Local data sources
│   ├── repositories/ # Repository implementations
│   └── services/     # API services
├── providers/        # State management
├── config/           # Configuration
└── utils/            # Utilities
```

**Best Practices:**
```dart
// Use const constructors
const EdgeInsets.all(16.0);
const Text('Hello');

// Null safety
String? nullableValue;
final nonNullValue = nullableValue ?? 'default';

// Provider pattern
class AuthProvider extends ChangeNotifier {
  User? _user;

  User? get user => _user;

  Future<void> login(String username, String password) async {
    // ...
    notifyListeners();
  }
}
```

---

## 4. Commit Message Convention

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(booking): add reschedule functionality` |
| `fix` | Bug fix | `fix(auth): resolve token refresh issue` |
| `docs` | Documentation | `docs: update API documentation` |
| `style` | Code style (formatting) | `style: fix indentation in UserService` |
| `refactor` | Code refactoring | `refactor(pet): simplify validation logic` |
| `test` | Add/update tests | `test(booking): add unit tests for scheduler` |
| `chore` | Maintenance | `chore: update dependencies` |
| `perf` | Performance improvement | `perf(api): optimize database queries` |

### Scope (Optional)
- `auth` - Authentication
- `booking` - Booking system
- `pet` - Pet management
- `user` - User management
- `clinic` - Clinic management
- `payment` - Payment system
- `api` - API general
- `ui` - UI components
- `mobile` - Mobile app

### Examples
```bash
# Good
git commit -m "feat(booking): implement appointment scheduling"
git commit -m "fix(auth): resolve JWT token expiration handling"
git commit -m "refactor(pet): extract validation to separate service"

# Bad
git commit -m "update"
git commit -m "fix bug"
git commit -m "wip"
git commit -m "asdfasdf"
```

---

## 5. Pull Request Guidelines

### PR Title Format
```
[TYPE] Short description (max 72 chars)

Examples:
[FEAT] Add pet vaccination tracking
[FIX] Resolve booking time conflict issue
[REFACTOR] Simplify authentication flow
```

### PR Description Template
```markdown
## Summary
Brief description of what this PR does.

## Changes
- Change 1
- Change 2
- Change 3

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Refactoring
- [ ] Documentation
- [ ] Other (describe):

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] All tests passing

## Screenshots (if UI changes)
Before | After
--- | ---
image | image

## Checklist
- [ ] Code follows project conventions
- [ ] No hardcoded values
- [ ] Error handling implemented
- [ ] Documentation updated (if needed)

## Related Issues
Closes #123
```

### PR Size Guidelines

| Size | Lines Changed | Recommendation |
|------|---------------|----------------|
| XS | < 50 | Quick review |
| S | 50-100 | Normal review |
| M | 100-300 | Detailed review |
| L | 300-500 | Split if possible |
| XL | > 500 | Must split into smaller PRs |

---

## 6. File Organization Rules

### Không commit vào Git
```gitignore
# Environment
.env
.env.local
.env.*.local

# Credentials
*.pem
*.key
credentials.json
google-services.json
GoogleService-Info.plist

# IDE
.idea/
.vscode/
*.iml

# Build
target/
build/
dist/
node_modules/
.gradle/

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db
```

### Bắt buộc có trong repo
```
project/
├── README.md              # Project overview
├── .gitignore            # Git ignore rules
├── .env.example          # Environment template
├── docker-compose.yml    # Docker setup
└── docs-references/      # Documentation
```

---

## 7. Communication Rules

### Daily Standup (15 phút)
- **Thời gian:** 9:00 AM
- **Format:**
  1. Hôm qua làm gì?
  2. Hôm nay làm gì?
  3. Có blockers không?

### PR Communication
- **Khi tạo PR:** Tag reviewer trong description
- **Khi review xong:** Comment "LGTM" (Looks Good To Me) hoặc request changes
- **Khi có conflict:** Ping author trong Slack/Discord

### Channels
| Channel | Purpose |
|---------|---------|
| #general | Thông báo chung |
| #dev | Technical discussions |
| #pr-reviews | PR notifications |
| #bugs | Bug reports |

---

## 8. Conflict Resolution

### Code Conflict
1. Người tạo PR có trách nhiệm resolve conflicts
2. Nếu conflict phức tạp, họp nhanh với người liên quan
3. Sau khi resolve, request re-review

### Design/Architecture Conflict
1. Mô tả 2 options rõ ràng
2. Team vote hoặc Team Leader quyết định
3. Document decision trong PR

### Deadline Conflict
1. Báo sớm (ít nhất 2 ngày trước deadline)
2. Team Leader reassign hoặc adjust scope
3. Update project board

---

## 9. Code Ownership

### Module Ownership

| Module | Primary Owner | Backup |
|--------|---------------|--------|
| Auth & Security | Tuân | Tân |
| Booking System | Triết | Tuân |
| Pet Management | Triết | Tuân |
| User Management | Tuân | Triết |
| Payment | Tuân | Tân |
| Web Frontend | Huyền | Tân |
| Mobile App | Uyên | Huyền |
| AI Service | Tân | Tuân |
| DevOps/Infra | Tân | Tuân |

### Ownership Responsibilities
- Review tất cả PRs liên quan đến module
- Maintain documentation
- Handle bugs và issues
- Onboard người mới vào module

---

## 10. Release Process

### Version Numbering
```
v{major}.{minor}.{patch}

major: Breaking changes, major features
minor: New features, backward compatible
patch: Bug fixes, small improvements

Examples:
v0.1.0 - Initial release
v0.1.1 - Bug fixes
v0.2.0 - New feature added
v1.0.0 - Production ready
```

### Release Checklist
- [ ] All features merged to develop
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Create release branch
- [ ] QA testing completed
- [ ] PR to main created
- [ ] 2 approvals received
- [ ] Merged to main
- [ ] Tagged release
- [ ] Deploy to production
- [ ] Verify deployment
- [ ] Announce release

### Hotfix Process
```
1. Create hotfix branch from main
   git checkout main
   git checkout -b hotfix/critical-bug

2. Fix the issue
   git commit -m "hotfix: fix critical bug"

3. Create PR to main (2 approvals)

4. After merge to main, back-merge to develop
   git checkout develop
   git merge main
```

---

## 11. Security Rules

### Credentials Management
- KHÔNG BAO GIỜ commit credentials vào Git
- Sử dụng `.env` files (đã được gitignore)
- Production credentials chỉ Team Leader và DevOps access
- Rotate credentials định kỳ (mỗi 3 tháng)

### Code Security
- Validate tất cả user input
- Sử dụng parameterized queries (không string concatenation)
- Escape output để tránh XSS
- Sử dụng HTTPS cho tất cả API calls
- Implement rate limiting

### Access Control
- Principle of least privilege
- Review access permissions hàng tháng
- Revoke access ngay khi member rời team

---

## 12. Performance Guidelines

### Backend
- API response time < 200ms (simple queries)
- API response time < 500ms (complex queries)
- Database queries should be optimized (use indexes)
- Implement pagination for list endpoints

### Frontend
- First Contentful Paint < 1.5s
- Time to Interactive < 3s
- Lighthouse score > 80
- Bundle size monitoring

### Mobile
- App launch time < 2s
- Smooth scrolling (60fps)
- Memory usage monitoring
- Battery consumption optimization

---

## Quick Reference Card

```
BRANCHES:
  main ← develop ← feature/*

COMMIT:
  feat|fix|docs|style|refactor|test|chore(scope): message

PR SIZE:
  < 500 lines, ideally < 300 lines

REVIEW TIME:
  Small: 4h | Medium: 8h | Large: 24h

APPROVALS:
  main: 2 | develop: 1

FORBIDDEN:
  - Force push to main/develop
  - Commit credentials
  - Skip code review
  - Merge without tests passing
```

---

**Last Updated:** 2025-12-14
**Maintained By:** Petties Team
