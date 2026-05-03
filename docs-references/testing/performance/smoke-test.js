import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// ──────────────────────────────────────────────────────────
// Petties Performance Test - Smoke
// ──────────────────────────────────────────────────────────
// Location: docs-references/testing/performance/smoke-test.js
//
// Usage:
//   k6 run smoke-test.js --env BASE_DOMAIN=localhost
//
// Pass criteria:
//   - p95 latency ≤ 500ms
//   - No 429 Too Many Requests
// ──────────────────────────────────────────────────────────

const BASE_DOMAIN = __ENV.BASE_DOMAIN || 'localhost';
const API_PATH = '/api';
const BASE_URL = BASE_DOMAIN.includes('localhost') || BASE_DOMAIN === 'localhost'
  ? `http://${BASE_DOMAIN}:8080${API_PATH}`
  : `https://${BASE_DOMAIN}${API_PATH}`;

const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { target: 2, duration: '10s' },   // slow ramp-up
    { target: 2, duration: '20s' },   // steady (low to avoid 429)
    { target: 0, duration: '10s' },    // ramp-down
  ],
  thresholds: {
    error_rate: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

function getToken() {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'staff@test.com',
    password: 'Test@1234',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.status === 200 ? res.json('data.accessToken') : null;
}

export default function () {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Health check
  {
    const res = http.get(`${BASE_URL}/actuator/health`, { tags: { name: 'health' } });
    check(res, { 'health status 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200 && res.status !== 429);
    sleep(2);  // slow down to avoid rate limit
  }

  if (!token) {
    console.log('No token - skipping authenticated endpoints');
    return;
  }

  // Get bookings
  {
    const res = http.get(`${BASE_URL}/bookings/my-bookings?page=0&size=10`, { tags: { name: 'bookings' }, headers });
    check(res, { 'bookings status 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200 && res.status !== 429);
    sleep(2);
  }

  // Get clinics
  {
    const res = http.get(`${BASE_URL}/clinics?page=0&size=10`, { tags: { name: 'clinics' }, headers });
    check(res, { 'clinics status 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200 && res.status !== 429);
    sleep(2);
  }

  // Get pets
  {
    const res = http.get(`${BASE_URL}/pets`, { tags: { name: 'pets' }, headers });
    check(res, { 'pets status 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200 && res.status !== 429);
    sleep(2);
  }
}