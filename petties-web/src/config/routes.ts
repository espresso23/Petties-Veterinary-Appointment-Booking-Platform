export const ROUTES = {
  home: '/',
  login: '/auth/login',

  // Admin routes
  admin: {
    dashboard: '/admin',
    profile: '/admin/profile',
    agents: '/admin/agents',
    tools: '/admin/tools',
    knowledge: '/admin/knowledge',
    playground: '/admin/playground',
    settings: '/admin/settings',
  },

  // Vet routes
  vet: {
    dashboard: '/vet',
    profile: '/vet/profile',
  },

  // Clinic Owner routes
  clinicOwner: {
    dashboard: '/clinic-owner',
    profile: '/clinic-owner/profile',
    clinics: '/clinic-owner/clinics',
  },

  // Clinic Manager routes
  clinicManager: {
    dashboard: '/clinic-manager',
    profile: '/clinic-manager/profile',
  },
} as const

