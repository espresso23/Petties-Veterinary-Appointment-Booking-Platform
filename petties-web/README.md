# Petties Web Frontend

**Web Frontend cho Petties - Veterinary Appointment Booking Platform**

```
Version: 1.0.0
Status:  ✅ Deployed (Production)
Stack:   React 19 | Vite | TypeScript | Tailwind CSS v4
```

---

## 📋 Overview

Petties Web Frontend là ứng dụng web được xây dựng với **React 19**, **Vite**, và **TypeScript**, cung cấp giao diện quản trị và sử dụng cho các role khác nhau trong hệ thống Petties.

### Platform Support by Role

| Role | Web Support | Notes |
|------|-------------|-------|
| **ADMIN** | ✅ | Web only - Full admin dashboard |
| **CLINIC_MANAGER** | ✅ | Web only - Clinic management |
| **CLINIC_OWNER** | ✅ | Web only - Clinic owner dashboard |
| **VET** | ✅ | Web + Mobile - Vet dashboard |
| **PET_OWNER** | ❌ | Mobile only |

---

## 🛠️ Tech Stack

### Core Technologies
- **React 19** - UI library
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Utility-first CSS framework

### State Management & Routing
- **Zustand** - Global state management
- **React Router v7** - Declarative routing

### HTTP Client
- **Axios** - HTTP client for API calls

### UI Components
- **Heroicons** - Icon library
- **Custom Components** - Built with Tailwind CSS

---

## 📁 Project Structure

```
petties-web/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── admin/           # Admin-specific components
│   │   ├── common/          # Shared components
│   │   └── selects/         # Custom select components
│   ├── pages/               # Route-based page components
│   │   ├── admin/           # Admin dashboard pages
│   │   ├── auth/            # Authentication pages
│   │   ├── vet/             # Vet dashboard
│   │   ├── clinic-owner/    # Clinic owner dashboard
│   │   └── clinic-manager/  # Clinic manager dashboard
│   ├── layouts/             # Layout wrappers
│   │   ├── AdminLayout.tsx
│   │   ├── AuthLayout.tsx
│   │   └── DashboardLayout.tsx
│   ├── services/            # API calls and integrations
│   │   ├── api/            # API client configuration
│   │   └── agentService.ts # AI Service API client
│   ├── store/               # Zustand state stores
│   │   └── authStore.ts
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   ├── config/              # App configuration
│   ├── App.tsx              # Root component with routing
│   └── main.tsx             # Application entry point
├── public/                  # Static public assets
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── Dockerfile               # Production Docker image
└── .dockerignore
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm hoặc yarn

### Installation

```bash
# 1. Navigate to web folder
cd petties-web

# 2. Install dependencies
npm install

# 3. Copy environment variables (if needed)
# Create .env file with:
# VITE_API_URL=http://localhost:8080
# VITE_AI_SERVICE_URL=http://localhost:8000
```

### Development

```bash
# Start development server
npm run dev

# Open browser
# http://localhost:5173
```

### Build for Production

```bash
# Build production bundle
npm run build

# Preview production build
npm run preview
```

---

## 📊 Feature Implementation Status

### ✅ Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication** | ✅ Done | Login page, JWT handling |
| **Google Sign-In** | ✅ Done | OAuth 2.0, auto-assign CLINIC_OWNER role |
| **Admin Dashboard** | ✅ Done | Overview with service health |
| **Agent Management** | ✅ Done | CRUD agents, prompt editor |
| **Tool Registry** | ✅ Done | Enable/disable, scan (code-based tools only) |
| **Knowledge Base** | ✅ Done | Document upload UI |
| **System Settings** | ✅ Done | OpenRouter config, API keys |
| **Role-based Routing** | ✅ Done | React Router with guards |

> 📘 **Note:** PET_OWNER accounts are blocked from web login (mobile only). Google Sign-In on web automatically creates CLINIC_OWNER accounts.

### 🔄 In Progress

| Feature | Status | Notes |
|---------|--------|-------|
| **User Dashboards** | 🔄 Skeleton | Vet, Clinic Owner, Clinic Manager |
| **Playground UI** | 🔄 Skeleton | Agent testing interface |
| **Routing Examples Manager** | 🔄 UI Only | Needs backend API |

### ⚠️ Not Yet Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| **Booking Flow UI** | ⚠️ TODO | Not implemented |
| **Pet Management UI** | ⚠️ TODO | Not implemented |
| **Real-time Chat UI** | ⚠️ TODO | WebSocket integration |
| **Payment Integration** | ⚠️ TODO | Stripe checkout |
| **Profile & Settings** | ⚠️ TODO | User profile management |

---

## 🎨 Design System

### Warm Neutrals Design System

Petties Web sử dụng design system với màu sắc warm neutrals:
- Primary colors: Warm beiges và soft browns
- Accent colors: Veterinary-themed greens và blues
- Typography: Clear, readable fonts
- Components: Consistent spacing và styling

---

## 🔌 API Integration

### Backend API (Spring Boot)
- **Development Base URL:** `http://localhost:8080/api`
- **Production Base URL:** `https://api.petties.world/api`
- **Authentication:** JWT Bearer token
- **Endpoints:**
  - `/auth/login` - Authentication ✅
  - `/auth/google` - Google Sign-In ✅
  - `/auth/me` - Current user info ✅
  - `/pets` - Pet management (⚠️ Not implemented)
  - `/bookings` - Booking management (⚠️ Not implemented)

### AI Service API (FastAPI)
- **Development Base URL:** `http://localhost:8000/api/v1`
- **Production Base URL:** `https://ai.petties.world/api/v1`
- **Authentication:** JWT Bearer token (admin only)
- **Endpoints:**
  - `/agents` - Agent management ✅
  - `/tools` - Tool registry ✅
  - `/knowledge` - Knowledge base ✅
  - `/settings` - System settings ✅
  - `/chat` - Chat API 🔄

---

## 🧪 Testing

```bash
# Run tests (when configured)
npm run test

# Run tests in watch mode
npm run test:watch
```

---

## 📚 Documentation

- [Main README](../README.md) - Project overview
- [Setup Guide](../docs-references/SETUP_GUIDE.md) - Detailed setup instructions
- [Development Workflow](../docs-references/DEVELOPMENT_WORKFLOW.md) - Workflow guide
- [Frontend Best Practices](../docs-references/FRONTEND_BEST_PRACTICES.md) - Coding standards

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'feat: add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open Pull Request

---

**Last Updated:** December 14, 2025  
**Status:** ✅ Deployed (Production)
