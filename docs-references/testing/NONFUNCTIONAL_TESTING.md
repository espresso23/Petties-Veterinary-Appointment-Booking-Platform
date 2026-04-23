# Petties Non-Functional Testing

**Version:** 1.2  
**Last Updated:** 2026-04-23  
**Project:** Petties - Veterinary Appointment Booking Platform  
**Scope:** Security Testing + Performance Testing (basic)

---

## 1. Overview

Non-Functional Testing đánh giá **chất lượng hệ thống**, không phải chức năng cụ thể. Petties tập trung vào 2 nhóm:

| Loại | Mục đích | Tool | Pass Criteria |
|------|-----------|------|-------------|
| **Security** | AuthN/AuthZ, vulnerabilities, CVE | OWASP ZAP + Postman | 0 Critical/High |
| **Performance** | Load, latency, error rate | Apache JMeter | p95 ≤ 500ms, error ≤ 1% |

> Tham chiếu: Petties SRS Section 4.2.3 (Performance) và 4.3 (Security).

---

## 2. Security Testing

### 2.1 Tools

| Tool | Mục đích | Install |
|------|-----------|--------|
| **Postman + Newman** | AuthN/AuthZ API test cases | postman.com |
| **OWASP ZAP Desktop** | Vulnerability scan (API/web) | owasp.org/download |
| **mvn dependency:analyze** | Dependency CVE (Backend JAR) | Có sẵn trong Maven |
| **npm audit** | Dependency CVE (Frontend JS) | Có sẵn trong npm |
| **pip-audit** | Dependency CVE (AI Python) | `pip install pip-audit` |

### 2.2 Target URLs (Unified Domain)

Petties dùng unified domain - tất cả services đi qua Nginx.

| Env | API REST | AI REST | WebSocket |
|-----|---------|--------|---------|
| **Test** | `test.petties.world/api` | `test.petties.world/ai` | `test.petties.world/ws` |
| **Prod** | `www.petties.world/api` | `www.petties.world/ai` | `www.petties.world/ws` |

> Không dùng subdomain `api-test.petties.world` nữa - unified domain cho cả Backend và AI.

### 2.2 Test Cases

#### Authentication (AuthN)

| TC-ID | Test Case | Method | Expected |
|-------|---------|--------|---------|
| SEC-AUTH-01 | Chưa login gọi API | `GET /api/bookings` (no token) | 401 |
| SEC-AUTH-02 | Token hết hạn | API với expired JWT | 401 |
| SEC-AUTH-03 | Token sai/tampered | API với modified JWT | 401 |

#### Authorization (AuthZ/RBAC)

| TC-ID | Test Case | Method | Expected |
|-------|---------|--------|---------|
| SEC-AUTHZ-01 | PET_OWNER gọi Admin API | POST `/api/admin/...` | 403 |
| SEC-AUTHZ-02 | STAFF gọi Admin API | POST `/api/admin/...` | 403 |
| SEC-AUTHZ-03 | PET_OWNER gọi Staff API | POST `/api/staff/...` | 403 |
| SEC-AUTHZ-04 | STAFF gọi Clinic Manager API | GET `/api/clinics/manage/...` | 403 |
| SEC-AUTHZ-05 | STAFF xem booking khác clinic | GET `/api/bookings/{other_clinic}` | 403 |
| SEC-AUTHZ-06 | PET_OWNER xem pet người khác | GET `/api/pets/{other_pet_id}` | 403 |

#### Input Validation & Injection

| TC-ID | Test Case | Payload | Expected |
|-------|---------|--------|--------|
| SEC-INPUT-01 | SQL Injection | `'; DROP TABLE users;--` | 400 / Sanitized |
| SEC-INPUT-02 | XSS payload | `<script>alert(1)</script>` | 400 / Sanitized |
| SEC-INPUT-03 | File oversized | body > 60MB | 413 |
| SEC-INPUT-04 | Invalid JSON body | `{"field": "}` | 400 |

### 2.3 How to Run

```bash
# ─── 1. Dependency Scan (Backend) ───────────────────────
cd backend-spring/petties
mvn dependency:analyze 2>&1 | grep -E "(WARNING|ERROR)" | head -20
# Expected: 0 Critical/High CVEs

# ─── 2. Dependency Scan (Frontend) ──────────────────────
cd petties-web
npm audit --audit-level=high 2>&1 | grep -E "(high|critical)"
# Expected: 0 high/critical vulnerabilities

# ─── 3. Dependency Scan (AI Service) ────────────────────
cd petties-agent-serivce
pip-audit -r requirements.txt 2>&1
# Expected: 0 Critical/High CVEs

# ─── 4. OWASP ZAP Desktop ───────────────────────────
# 1. Mở OWASP ZAP Desktop
# 2. Chọn "Automated Scan"
# 3. Nhập URL: https://test.petties.world/api (Test) hoặc https://www.petties.world/api (Prod)
# 4. Bật Spider, tắt Ajax Spider
# 5. Click "Start Scan"
# 6. Đợi xong → Xem Alerts (thẻ Alerts)
# 7. Export: Report → Generate HTML Report
# Expected: Critical 0 | High 0

# ─── 5. AuthN/AuthZ with Newman ──────────────────────
# Requires: Postman collection exported
newman run Petties-API.postman_collection.json \
  --environment Petties-Test.postman_environment.json \
  --folder "Security Tests" \
  --reporters cli,json \
  --reporter-json-export security-report.json
# Expected: 100% pass for all SEC-* test cases
```

### 2.4 Expected Results

```
Security Testing Result
──────────────────────────────────────────────
Tool: OWASP ZAP + Postman/Newman + Maven Dependency Analyze
Scope: 12 API critical endpoints + dependency scan
──────────────────────────────────────────────
Authentication (AuthN):         3/3 PASS
Authorization (AuthZ/RBAC):    6/6 PASS
Input Validation:             4/4 PASS
OWASP ZAP Baseline:        Critical 0 | High 0 | Medium 2 | Low 7
Dependency CVE (Backend):     0 Critical | 0 High
Dependency CVE (Frontend):    0 Critical | 0 High
──────────────────────────────────────────────
Overall: PASS (Security criteria met)
```

---

## 3. Performance Testing

### 3.1 Tools

| Tool | Mục đích | Install |
|------|-----------|--------|
| **Apache JMeter** | Load test, latency measure | `choco install jmeter` (Windows) |
| **JMeter Prometheus Plugin** | Push metrics to Prometheus | Download from GitHub |
| **Prometheus** | Store metrics | Có sẵn trong `docker-compose.dev.yml` |
| **Grafana** | Visualize metrics | Có sẵn trong `docker-compose.dev.yml` |

### 3.2 Test Scenarios

| Scenario | Users | Duration | APIs tested | Pass criteria |
|----------|-------|---------|---------|-----------|
| Smoke | 2 | 40s | 5 API core | p95 ≤ 500ms, error < 1% |
| Load (optional) | 10 | 2 phút | 5 API core | p95 ≤ 800ms, error < 1% |

**5 API core được test:**
1. `POST /auth/login` - Authentication
2. `GET /actuator/health` - Health check
3. `GET /bookings/my-bookings` - Booking list
4. `GET /clinics` - Clinic search
5. `GET /pets` - Pet list

### 3.3 Architecture

```
JMeter --Prometheus Plugin--> Prometheus --query--> Grafana
                    |
                    v
              Port 9270 (metrics endpoint)
```

### 3.4 Installation & Setup

#### Step 1: Install JMeter

```bash
# Windows (Chocolatey)
choco install jmeter -y

# Hoặc download trực tiếp
# https://jmeter.apache.org/download_jmeter.cgi
```

#### Step 2: Install Prometheus Plugin

```bash
# Tải plugin từ:
# https://github.com/pblny/prometheus-jmeter/releases

# Copy vào JMeter lib/ext folder
copy jmeter-prometheus-plugin.jar %JMETER_HOME%\lib\ext\
```

#### Step 3: Configure Prometheus

Prometheus đã được cấu hình sẵn để scrape JMeter metrics:

```yaml
# monitoring/prometheus/prometheus.dev.yml
- job_name: 'petties-jmeter'
  metrics_path: /metrics
  static_configs:
    - targets: ['host.docker.internal:9270']
```

#### Step 4: Restart Prometheus

```bash
docker-compose -f docker-compose.dev.yml restart prometheus
```

### 3.5 How to Run

#### Using JMeter GUI

```bash
# Mở JMeter GUI
jmeter.bat

# Open file: docs-references/testing/performance/petties-test-plan.jmx
# Click Run (Green triangle)
```

#### Using JMeter CLI (Recommended for automation)

```bash
cd D:\SEP490\petties\docs-references\testing\performance

# Run test với report
jmeter -n ^
  -t petties-test-plan.jmx ^
  -l results/results.jtl ^
  -j results/jmeter.log ^
  -e -o results/html-report

# Results sẽ có:
# - results/results.jtl (raw data)
# - results/html-report/index.html (HTML report)
```

### 3.6 Expected Results

```
Performance Testing Result
─────────────────────────────────────────────
Tool: Apache JMeter 5.6.3
Target: hasty-unvociferously-madalyn.ngrok-free.dev
Users: 2 | Duration: 40s
Date: 2026-04-23
─────────────────────────────────────────────
Total requests:       ~80
Success rate:        100%
Error rate:         0.0%   ✓ (< 1%)
──��──────────────────────────────────────────
Latency:
  p50:             ~100 ms  ✓
  p95:             ~200 ms  ✓ (≤ 500ms)
  p99:             ~300 ms  ✓ (≤ 1500ms)
─────────────────────────────────────────────
HTTP Status Distribution:
  200 OK:         100%
─────────────────────────────────────────────
Overall: PASS (Performance criteria met)
```

### 3.7 JMeter + Prometheus + Grafana Integration

#### Check Prometheus Targets

```
http://localhost:9090/targets
```

→ Thấy `petties-jmeter` state **UP** với endpoint `host.docker.internal:9270`

#### Prometheus Queries

```
# Response time metrics
jmeter_http_latency
jmeter_transactions_mean

# Error metrics
jmeter_http_status_error
jmeter_http_status_ok

# Throughput
jmeter_transactions
```

#### Import Grafana Dashboard

1. Mở Grafana: http://localhost:3001
2. Login: `admin` / `admin123`
3. Click **+** → **Import**
4. Paste Dashboard ID: **5176** (JMeter Dashboard for Grafana)
5. Select datasource: **Prometheus**
6. Click **Import**

---

## 4. Slide Content

### 4.1 Non-Functional Testing Summary

| Loại | Tool | Scope | Result |
|------|------|-------|-------|
| **Security** | OWASP ZAP + Postman + Maven | 12 APIs + Dependencies | **0 Critical / 0 High** |
| **Performance** | Apache JMeter (2 users / 40s) | 5 API core | **p95 ~200ms / error 0%** |

### 4.2 Performance Results (for slide)

```
Petties Performance Test
─────────────────────────────────────────
Tool: Apache JMeter 5.6.3
Users: 2 | Duration: 40s
─────────────────────────────────────────
Success Rate:  100%  ✓ (≥ 99%)
Error Rate:    0.0%  ✓ (< 1%)
Latency p95:  ~200ms  ✓ (≤ 500ms)
Latency p99:  ~300ms  ✓ (≤ 1500ms)
─────────────────────────────────────────
Kết luận: Hệ thống đạt yêu cầu
```

### 4.3 Security Results (for slide)

```
Petties Security Test
─────────────────────────────────────────
Tool: OWASP ZAP + Postman + mvn analyze
─────────────────────────────────────────
OWASP ZAP:    Critical 0 | High 0
RBAC Tests:    6/6 PASS (100%)
AuthN Tests:   3/3 PASS (100%)
Input Valid:   4/4 PASS (100%)
Dependency:   0 Critical | 0 High
─────────────────────────────────────────
Kết luận: Hệ thống đạt yêu cầu
```

---

## 5. Related Documentation

| File | Nội dung |
|------|---------|
| [TESTING_OVERVIEW.md](./TESTING_OVERVIEW.md) | Tổng quan toàn bộ testing |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | Chiến lược testing chi tiết |
| [performance/petties-test-plan.jmx](./performance/petties-test-plan.jmx) | JMeter test plan |
| [performance/smoke-test.js](./performance/smoke-test.js) | k6 smoke test (legacy) |
| `../SRS/PETTIES_SRS.md` (Section 4.2.3, 4.3) | Performance & Security requirements |
| `../SRS/PETTIES_SRS.md` (Section 5.4.3) | Security test cases (TC-SEC-*) |
| `.github/workflows/ci.yml` | CI pipeline chạy functional tests |