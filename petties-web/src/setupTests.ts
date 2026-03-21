import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Mock localStorage
const localStorageMock = (function () {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] || null,
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  enumerable: true,
  writable: true
})

// Setup after each test case
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// Mock window.matchMedia (needed for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
interface MockIntersectionObserver {
  disconnect: () => void
  observe: () => void
  takeRecords: () => IntersectionObserverEntry[]
  unobserve: () => void
}

; (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class IntersectionObserver implements MockIntersectionObserver {
  disconnect() { }
  observe() { }
  takeRecords() {
    return []
  }
  unobserve() { }
}

// Extend Vitest expect with jest-dom matchers
export { expect }
