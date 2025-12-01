# Frontend Best Practices - Petties Web

## 📋 Overview

This document outlines best practices and recommendations for the Petties web frontend built with React + Vite.

## 🎯 Current Structure Analysis

### Existing Structure
```
petties-web/src/
├── components/
│   ├── common/
│   ├── features/
│   └── selects/
├── hooks/
├── services/
├── store/
├── types/
├── assets/
├── App.tsx
└── main.tsx
```

### Issues with Current Structure
- Missing `pages/` directory for route components
- Missing `layouts/` directory for shared layouts
- Missing `utils/` directory for helper functions
- Missing `config/` directory for app configuration
- No clear API client setup in services

## 🏗️ Recommended Structure

```
petties-web/
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── common/             # Generic components
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Card/
│   │   │   └── index.ts
│   │   ├── features/           # Feature-specific components
│   │   │   ├── PetCard/
│   │   │   ├── BookingForm/
│   │   │   ├── DoctorProfile/
│   │   │   └── index.ts
│   │   └── selects/            # Custom select components
│   │       ├── PetSelect/
│   │       └── DoctorSelect/
│   │
│   ├── pages/                  # Route-based pages
│   │   ├── Home/
│   │   │   ├── Home.tsx
│   │   │   └── index.ts
│   │   ├── Auth/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── index.ts
│   │   ├── Pets/
│   │   │   ├── PetList.tsx
│   │   │   ├── PetDetail.tsx
│   │   │   ├── PetForm.tsx
│   │   │   └── index.ts
│   │   ├── Bookings/
│   │   ├── Doctors/
│   │   ├── Dashboard/
│   │   └── NotFound.tsx
│   │
│   ├── layouts/                # Layout wrappers
│   │   ├── MainLayout.tsx      # Main app layout
│   │   ├── AuthLayout.tsx      # Authentication pages layout
│   │   ├── DashboardLayout.tsx # Dashboard layout with sidebar
│   │   └── index.ts
│   │
│   ├── services/               # API and external services
│   │   ├── api/
│   │   │   ├── client.ts       # Axios configuration
│   │   │   ├── interceptors.ts # Request/response interceptors
│   │   │   └── index.ts
│   │   ├── endpoints/
│   │   │   ├── auth.ts         # Auth API calls
│   │   │   ├── pets.ts         # Pets API calls
│   │   │   ├── bookings.ts     # Bookings API calls
│   │   │   └── index.ts
│   │   └── websocket.ts        # WebSocket client
│   │
│   ├── store/                  # State management (Zustand)
│   │   ├── auth.store.ts       # Authentication state
│   │   ├── pet.store.ts        # Pets state
│   │   ├── booking.store.ts    # Bookings state
│   │   ├── ui.store.ts         # UI state (modals, toasts)
│   │   └── index.ts
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts          # Authentication hook
│   │   ├── usePets.ts          # Pets data hook
│   │   ├── useBookings.ts      # Bookings data hook
│   │   ├── useDebounce.ts      # Debounce hook
│   │   ├── useIntersection.ts  # Intersection observer
│   │   └── index.ts
│   │
│   ├── types/                  # TypeScript definitions
│   │   ├── api.types.ts        # API response types
│   │   ├── models.ts           # Domain models
│   │   ├── enums.ts            # Enums
│   │   └── index.ts
│   │
│   ├── utils/                  # Utility functions
│   │   ├── formatters.ts       # Date, currency formatters
│   │   ├── validators.ts       # Form validation
│   │   ├── constants.ts        # Constants
│   │   ├── helpers.ts          # Helper functions
│   │   └── index.ts
│   │
│   ├── config/                 # App configuration
│   │   ├── env.ts              # Environment variables
│   │   ├── routes.ts           # Route constants
│   │   └── index.ts
│   │
│   ├── assets/                 # Static assets
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   │
│   ├── styles/                 # Global styles
│   │   ├── globals.css
│   │   └── tailwind.css
│   │
│   ├── App.tsx                 # Root component
│   └── main.tsx                # Entry point
│
├── public/                     # Public static files
│   ├── favicon.ico
│   └── robots.txt
│
├── .env                        # Environment variables
├── .env.example                # Environment template
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── Dockerfile
└── .dockerignore
```

## 📝 Best Practices

### 1. Component Organization

#### Folder Structure per Component
```typescript
// components/common/Button/
├── Button.tsx          // Main component
├── Button.test.tsx     // Unit tests
├── Button.stories.tsx  // Storybook (optional)
└── index.ts            // Export

// index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

#### Component Template
```typescript
// components/common/Button/Button.tsx
import { FC, ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={clsx(
        'btn',
        `btn-${variant}`,
        `btn-${size}`,
        isLoading && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
};
```

### 2. State Management with Zustand

```typescript
// store/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'doctor' | 'admin';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### 3. API Client Setup

```typescript
// services/api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

```typescript
// services/endpoints/pets.ts
import { apiClient } from '../api/client';
import type { Pet, CreatePetDTO, UpdatePetDTO } from '@/types';

export const petService = {
  getAllPets: async (): Promise<Pet[]> => {
    const response = await apiClient.get('/pets');
    return response.data;
  },

  getPetById: async (id: string): Promise<Pet> => {
    const response = await apiClient.get(`/pets/${id}`);
    return response.data;
  },

  createPet: async (data: CreatePetDTO): Promise<Pet> => {
    const response = await apiClient.post('/pets', data);
    return response.data;
  },

  updatePet: async (id: string, data: UpdatePetDTO): Promise<Pet> => {
    const response = await apiClient.put(`/pets/${id}`, data);
    return response.data;
  },

  deletePet: async (id: string): Promise<void> => {
    await apiClient.delete(`/pets/${id}`);
  },
};
```

### 4. Custom Hooks

```typescript
// hooks/usePets.ts
import { useState, useEffect } from 'react';
import { petService } from '@/services/endpoints/pets';
import type { Pet } from '@/types';

export const usePets = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPets = async () => {
    try {
      setIsLoading(true);
      const data = await petService.getAllPets();
      setPets(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPets();
  }, []);

  return { pets, isLoading, error, refetch: fetchPets };
};
```

### 5. Routing Setup

```typescript
// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout, AuthLayout, DashboardLayout } from '@/layouts';
import { Home, Login, Register, PetList, PetDetail, NotFound } from '@/pages';
import { useAuthStore } from '@/store/auth.store';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Private routes */}
        <Route
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route path="/pets" element={<PetList />} />
          <Route path="/pets/:id" element={<PetDetail />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### 6. Environment Variables

```typescript
// config/env.ts
export const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Petties',
  ENVIRONMENT: import.meta.env.MODE,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
```

```bash
# .env.example
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
VITE_APP_NAME=Petties
```

### 7. TypeScript Types

```typescript
// types/models.ts
export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pet {
  id: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  ownerId: string;
  photos: string[];
  medicalHistory?: MedicalRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  petId: string;
  doctorId: string;
  scheduledAt: string;
  status: BookingStatus;
  serviceType: ServiceType;
  location: Location;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  USER = 'USER',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
}

export enum BookingStatus {
 
}


## 🎨 Styling Guidelines

### Using Tailwind CSS

```typescript
// Use clsx for conditional classes
import clsx from 'clsx';

<button
  className={clsx(
    'px-4 py-2 rounded-lg transition-colors',
    variant === 'primary' && 'bg-blue-500 text-white hover:bg-blue-600',
    variant === 'secondary' && 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    isDisabled && 'opacity-50 cursor-not-allowed'
  )}
>
  Click me
</button>
```

## 🧪 Testing

```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<Button isLoading>Click me</Button>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

## 📦 Recommended Packages

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.9.6",
    "zustand": "^5.0.9",
    "axios": "^1.13.2",
    "@tanstack/react-query": "^5.0.0",
    "date-fns": "^4.1.0",
    "clsx": "^2.1.1",
    "zod": "^3.23.0",
    "react-hook-form": "^7.53.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "typescript": "~5.9.3",
    "vite": "npm:rolldown-vite@7.2.5",
    "@vitejs/plugin-react": "^5.1.1",
    "tailwindcss": "^4.1.17",
    "autoprefixer": "^10.4.22",
    "postcss": "^8.5.6",
    "eslint": "^9.39.1",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
```

## ✅ Checklist

- [ ] Organize components by feature and shared/common
- [ ] Implement proper TypeScript types for all data
- [ ] Set up Zustand stores for global state
- [ ] Create API client with interceptors
- [ ] Implement custom hooks for data fetching
- [ ] Add proper error handling
- [ ] Implement loading states
- [ ] Add form validation with react-hook-form + zod
- [ ] Implement authentication guards
- [ ] Add environment variable configuration
- [ ] Set up proper routing
- [ ] Implement code splitting
- [ ] Add unit tests for components
- [ ] Configure ESLint and Prettier
- [ ] Add accessibility (a11y) support
- [ ] Implement responsive design
- [ ] Add error boundaries
- [ ] Set up CI/CD pipeline

---

**Last Updated**: December 1, 2025
