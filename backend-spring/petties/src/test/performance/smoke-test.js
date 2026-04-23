import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const testUser = {
  email: 'staff@petties.vn',
  password: 'Staff@123',
};

function getHeaders(token = '') {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify(testUser),
    { headers: getHeaders() }
  );
  const body = JSON.parse(res.body);
  return { token: body.result?.accessToken || body.accessToken || '' };
}

export default function (data) {
  const headers = getHeaders(data.token);

  check(http.get(`${BASE_URL}/api/v1/clinics`, { headers }), {
    'GET /clinics': (r) => r.status === 200,
  });

  check(http.get(`${BASE_URL}/api/v1/auth/me`, { headers }), {
    'GET /auth/me': (r) => r.status === 200,
  });

  check(http.get(`${BASE_URL}/api/v1/services`, { headers }), {
    'GET /services': (r) => r.status === 200 || r.status === 404,
  });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    stdout: `=== SMOKE TEST ===
Errors: ${data.metrics.errors.values.rate * 100}%
p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
`,
  };
}