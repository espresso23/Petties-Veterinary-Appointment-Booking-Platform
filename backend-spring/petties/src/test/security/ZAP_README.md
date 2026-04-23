# ZAP Security Testing for Petties API

## Prerequisites
1. Install ZAP Desktop: https://www.zaproxy.org/download/
2. Or use Docker: `docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:8080`

## Quick Start

### Option A: ZAP Desktop (GUI)
1. Open ZAP Desktop
2. Go to Tools > Options > API > Enable API
3. Set API Key: `petties-test-key` (or generate random)
4. Right-click on Sites > Add to Context
5. Start Active Scan

### Option B: Command Line
```bash
# Baseline scan (quick)
zap-baseline.py -t http://localhost:8080 -l INFO -r report.html

# Full scan with auth
zap-api-scan.py -t openapi -f html -o report.html -w -l INFO \
  -c zap-auth-header.config \
  -t http://localhost:8080/v3/api-docs
```

## API Security Test Checklist

### Authentication
- [ ] JWT token validation (expired, invalid, missing)
- [ ] Refresh token flow
- [ ] Login rate limiting (brute force protection)
- [ ] Logout/invalidate token

### Authorization
- [ ] Role-based access (STAFF vs PET_OWNER vs ADMIN)
- [ ] Resource ownership (user can only access own data)
- [ ] Privilege escalation attempts

### Input Validation
- [ ] SQL injection (', ", ;--, UNION SELECT)
- [ ] XSS in string parameters
- [ ] Invalid JSON body
- [ ] Missing required fields
- [ ] Type coercion attacks

### Business Logic
- [ ] Booking manipulation (modify other user's booking)
- [ ] Price tampering
- [ ] Race conditions in booking slots

### Headers & Config
- [ ] CORS configuration
- [ ] Security headers (X-Frame-Options, CSP, etc.)
- [ ] Rate limiting headers

## Running Tests

### 1. Passive Scan (Replay API Collection)
```bash
# Export Postman collection, import to ZAP
zap-cli session create
zap-cli target https://localhost:8080
zap-cli spider http://localhost:8080
zap-cli active-scan http://localhost:8080/api
zap-cli report -o zap-report.html -f html
```

### 2. Authenticated Scan
```bash
# Create context with authentication
zap-cli context import auth-context.yaml
zap-cli context enable
zap-cli active-scan http://localhost:8080
```

### 3. Custom Security Test Script
```bash
python zap-security-test.py --target http://localhost:8080 --token-file token.txt
```

## Expected Results
- High: SQL Injection, Authentication bypass
- Medium: Information disclosure, Missing security headers
- Low: X-Content-Type-Options missing, etc.
- Informational: CORS misconfiguration