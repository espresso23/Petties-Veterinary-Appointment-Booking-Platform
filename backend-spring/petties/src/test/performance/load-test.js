import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');

const bookingDuration = new Trend('booking_duration');
const authDuration = new Trend('auth_duration');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const testUser = {
  email: 'staff@petties.vn',
  password: 'Staff@123',
};

let authToken = '';
let userId = '';
let clinicId = '';
let bookingId = '';

function getHeaders(token = '') {
  const h = {
    'Content-Type': 'application/json',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify(testUser),
    { headers: getHeaders() }
  );

  const body = JSON.parse(loginRes.body);
  return {
    token: body.result?.accessToken || body.accessToken || '',
    userId: body.result?.userId || body.userId || '',
  };
}

export default function (data) {
  const token = data.token;
  const headers = getHeaders(token);

  group('Auth APIs', () => {
    const res = http.get(`${BASE_URL}/api/v1/auth/me`, { headers });
    check(res, {
      'GET /auth/me status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  group('Clinic APIs', () => {
    const res = http.get(`${BASE_URL}/api/v1/clinics`, { headers });
    check(res, {
      'GET /clinics status 200': (r) => r.status === 200,
    });
    if (res.status === 200 && res.json) {
      const clinics = res.json().result || res.json();
      if (clinics && clinics.length > 0) {
        clinicId = clinics[0].id || clinics[0].clinicId || '';
      }
    }
    errorRate.add(res.status !== 200);
  });

  group('Service APIs', () => {
    if (clinicId) {
      const res = http.get(`${BASE_URL}/api/v1/services/clinic/${clinicId}`, { headers });
      check(res, {
        'GET /services/clinic/:id status 200': (r) => r.status === 200,
      });
      errorRate.add(res.status !== 200);
    }
  });

  group('Booking APIs', () => {
    const payload = JSON.stringify({
      clinicId: clinicId || '1',
      petId: '1',
      serviceId: '1',
      bookingDate: '2026-04-25',
      slotId: '1',
      notes: 'Load test booking',
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/bookings`, payload, { headers });
    bookingDuration.add(Date.now() - start);

    check(res, {
      'POST /bookings created or accepted': (r) =>
        r.status === 201 || r.status === 200 || r.status === 400,
    });
    errorRate.add(![201, 200, 400].includes(res.status));

    if (res.status === 201 || res.status === 200) {
      const body = res.json();
      bookingId = body.result?.id || body.id || '';
    }
  });

  group('Vet Shift APIs', () => {
    if (clinicId) {
      const today = new Date().toISOString().split('T')[0];
      const res = http.get(
        `${BASE_URL}/api/v1/vet-shifts/clinic/${clinicId}?date=${today}`,
        { headers }
      );
      check(res, {
        'GET /vet-shifts status 200': (r) => r.status === 200,
      });
      errorRate.add(res.status !== 200);
    }
  });

  group('Chat APIs', () => {
    const res = http.get(`${BASE_URL}/api/v1/chat/messages?conversationId=1&page=0&size=20`, { headers });
    check(res, {
      'GET /chat/messages status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'results/load-test-report.json': JSON.stringify(data, null, 2),
    'results/load-test-report.html': generateHTMLReport(data),
  };
}

function textSummary(data, opts) {
  let summary = '\n=== LOAD TEST SUMMARY ===\n\n';
  summary += `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `Failed Requests: ${data.metrics.http_req_failed.values.passes}\n`;
  summary += `Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n\n`;

  const duration = data.metrics.http_req_duration.values;
  summary += `Response Times:\n`;
  summary += `  Avg: ${duration.mean.toFixed(2)}ms\n`;
  summary += `  p50: ${duration['p(50)'].toFixed(2)}ms\n`;
  summary += `  p95: ${duration['p(95)'].toFixed(2)}ms\n`;
  summary += `  p99: ${duration['p(99)'].toFixed(2)}ms\n`;
  summary += `  Max: ${duration.max.toFixed(2)}ms\n`;

  return summary;
}

function generateHTMLReport(data) {
  const d = data.metrics;
  return `<!DOCTYPE html>
<html>
<head>
  <title>Load Test Report - Petties API</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #d97706; }
    table { border-collapse: collapse; width: 100%; max-width: 600px; }
    th, td { border: 2px solid #1c1917; padding: 12px; text-align: left; }
    th { background: #d97706; color: white; }
    tr:nth-child(even) { background: #f5f5f4; }
    .pass { color: green; font-weight: bold; }
    .fail { color: red; font-weight: bold; }
    .metric { font-size: 24px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Performance Test Report - Petties API</h1>
  <h2>Load Test Summary</h2>
  <div class="metric">
    <span class="${d.http_req_failed.values.rate < 0.05 ? 'pass' : 'fail'}">
      Error Rate: ${(d.http_req_failed.values.rate * 100).toFixed(2)}%
    </span>
  </div>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Requests</td><td>${d.http_reqs.values.count}</td></tr>
    <tr><td>Avg Response Time</td><td>${d.http_req_duration.values.mean.toFixed(2)} ms</td></tr>
    <tr><td>p50 Response Time</td><td>${d.http_req_duration.values['p(50)'].toFixed(2)} ms</td></tr>
    <tr><td>p95 Response Time</td><td>${d.http_req_duration.values['p(95)'].toFixed(2)} ms</td></tr>
    <tr><td>p99 Response Time</td><td>${d.http_req_duration.values['p(99)'].toFixed(2)} ms</td></tr>
    <tr><td>Max Response Time</td><td>${d.http_req_duration.values.max.toFixed(2)} ms</td></tr>
    <tr><td>Throughput</td><td>${d.http_reqs.values.rate.toFixed(2)} req/s</td></tr>
  </table>
  <h2>Thresholds Check</h2>
  <table>
    <tr><th>Threshold</th><th>Status</th></tr>
    <tr>
      <td>p(95) < 500ms</td>
      <td class="${d.http_req_duration.values['p(95)'] < 500 ? 'pass' : 'fail'}">
        ${d.http_req_duration.values['p(95)'] < 500 ? 'PASS' : 'FAIL'}
      </td>
    </tr>
    <tr>
      <td>p(99) < 1000ms</td>
      <td class="${d.http_req_duration.values['p(99)'] < 1000 ? 'pass' : 'fail'}">
        ${d.http_req_duration.values['p(99)'] < 1000 ? 'PASS' : 'FAIL'}
      </td>
    </tr>
    <tr>
      <td>Error Rate < 5%</td>
      <td class="${d.http_req_failed.values.rate < 0.05 ? 'pass' : 'fail'}">
        ${d.http_req_failed.values.rate < 0.05 ? 'PASS' : 'FAIL'}
      </td>
    </tr>
  </table>
</body>
</html>`;
}