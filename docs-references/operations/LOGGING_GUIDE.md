# 📋 Petties Logging System Guide

**Mục đích:** Hướng dẫn cấu hình, sử dụng và debug logs cho Petties  
**Ngày cập nhật:** 22/03/2026  
**Phiên bản:** v1.0.0

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Cấu trúc Log Files](#2-cấu-trúc-log-files)
3. [Backend Spring Boot Logging](#3-backend-spring-boot-logging)
4. [AI Service FastAPI Logging](#4-ai-service-fastapi-logging)
5. [Cách Check Logs](#5-cách-check-logs)
6. [Log Format](#6-log-format)
7. [Correlation ID (Request Tracing)](#7-correlation-id-request-tracing)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Tổng quan

### 1.1 Kiến trúc Logging

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PETTIES LOGGING SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐           ┌──────────────┐           ┌────────────┐ │
│  │    Backend   │           │  AI Service  │           │   Frontend │ │
│  │  Spring Boot │           │    FastAPI    │           │   React    │ │
│  └──────┬───────┘           └──────┬───────┘           └─────┬──────┘ │
│         │                          │                         │        │
│         ▼                          ▼                         ▼        │
│  ┌──────────────┐           ┌──────────────┐           ┌──────────┐  │
│  │  Logback     │           │  Logging     │           │  Browser │  │
│  │  XML Config  │           │  Config.py   │           │  Console │  │
│  └──────┬───────┘           └──────┬───────┘           └──────────┘  │
│         │                          │                                   │
│         ▼                          ▼                                   │
│  ┌──────────────┐           ┌──────────────┐                          │
│  │   Console    │           │   Console    │     Real-time           │
│  │   (colored)  │           │   (colored)  │     monitoring          │
│  └──────────────┘           └──────────────┘                          │
│         │                          │                                   │
│         ▼                          ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                    Volume Mount (Docker)                     │     │
│  │                   ./logs/backend/*                           │     │
│  │                   ./logs/ai-service/*                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│         │                          │                                   │
│         ▼                          ▼                                   │
│  ┌──────────────┐           ┌──────────────┐                          │
│  │  petties-    │           │  agent_       │     Persistent           │
│  │  backend.log │           │  service.log  │     storage              │
│  └──────────────┘           └──────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Log Levels

| Level | Màu sắc | Sử dụng |
|-------|---------|---------|
| `DEBUG` | Xám | Chi tiết, LLM prompts, SQL queries |
| `INFO` | Xanh lá | Request/Response, initialization |
| `WARN` | Vàng | Fallback, skipped features |
| `ERROR` | Đỏ | API failures, exceptions |
| `CRITICAL` | Đỏ đậm | System down |

### 1.3 Files Changed (v1.0.0)

| File | Action | Purpose |
|------|--------|---------|
| `docker-compose.dev.yml` | Modified | Mount logs volume |
| `LoggingInterceptor.java` | **NEW** | Backend request/response logging |
| `WebMvcConfig.java` | Modified | Register logging interceptor |
| `logging_middleware.py` | **NEW** | AI service request/response logging |
| `main.py` (AI) | Modified | Add logging middleware |

---

## 2. Cấu trúc Log Files

### 2.1 Thư mục Logs

```
logs/
├── backend/                          # Backend Spring Boot logs
│   ├── petties-backend.log           # All logs (rotated)
│   ├── petties-backend.2026-03-22.0.log.gz
│   ├── petties-error.log            # WARN + ERROR only
│   ├── petties-error.2026-03-22.0.log.gz
│   └── petties-json.log             # Structured JSON (prod)
│
└── ai-service/                      # AI Service FastAPI logs
    ├── agent_service.log            # All logs (rotated)
    ├── agent_service.2026-03-22.0.log.gz
    └── agent_service_errors.log     # WARN + ERROR only
```

### 2.2 Rotation Policy

| Service | Max File Size | Retention | Total Cap |
|---------|--------------|-----------|-----------|
| Backend main | 10 MB | 30 days | 1 GB |
| Backend error | 10 MB | 60 days | 500 MB |
| Backend JSON | 20 MB | 7 days | 500 MB |
| AI Service main | 10 MB | 5 backups | - |
| AI Service error | 10 MB | 10 backups | - |

---

## 3. Backend Spring Boot Logging

### 3.1 Cấu hình File

**Location:** `backend-spring/petties/src/main/resources/logback-spring.xml`

### 3.2 Appenders

| Appender | Output | Level | Purpose |
|----------|--------|-------|---------|
| `CONSOLE` | stdout | All | Development debugging |
| `FILE` | `logs/petties-backend.log` | All | General logging |
| `ERROR_FILE` | `logs/petties-error.log` | WARN+ | Error tracking |
| `JSON_FILE` | `logs/petties-json.log` | All | Production analysis |

### 3.3 Logging by Profile

```xml
<!-- Development -->
<springProfile name="dev">
    com.petties: DEBUG
    org.hibernate.SQL: DEBUG
    org.springframework.web: DEBUG
</springProfile>

<!-- Production -->
<springProfile name="prod">
    com.petties: INFO
    org.hibernate.SQL: WARN
    org.springframework.security: WARN
</springProfile>
```

### 3.4 LoggingInterceptor

**Location:** `backend-spring/petties/src/main/java/com/petties/petties/config/LoggingInterceptor.java`

**Features:**
- Auto-generate Request ID (8 chars) nếu không có `X-Request-ID` header
- Log request method, path, IP, user
- Log response status, duration
- Mask sensitive query params (password, token, apiKey)
- Exclude actuator/health endpoints

### 3.5 Sử dụng Logging trong Code

```java
// Basic logging
log.info("Creating booking for clinic: {}", clinicId);
log.debug("User data: {}", userDto);
log.warn("Clinic not found: {}", clinicId);
log.error("Database error: {}", e.getMessage(), e);

// With MDC (Request Context)
MDC.put("bookingId", booking.getId());
log.info("Booking processed");
MDC.clear();
```

### 3.6 Actuator Endpoints

```bash
# Check logging level
curl http://localhost:8081/api/actuator/loggers/com.petties

# Change logging level (runtime)
curl -X POST http://localhost:8081/api/actuator/loggers/com.petties \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": "DEBUG"}'
```

---

## 4. AI Service FastAPI Logging

### 4.1 Cấu hình File

**Location:** `petties-agent-serivce/app/config/logging_config.py`

### 4.2 Handlers

| Handler | Output | Level | Purpose |
|---------|--------|-------|---------|
| Console | stdout | Configurable | Development |
| File | `logs/agent_service.log` | All | General logging |
| Error File | `logs/agent_service_errors.log` | WARN+ | Error tracking |

### 4.3 LoggingMiddleware

**Location:** `petties-agent-serivce/app/middleware/logging_middleware.py`

**Features:**
- Auto-generate Request ID (8 chars)
- Log HTTP method, path, query params
- Log client IP, User-Agent
- Log response status, duration
- Mask sensitive headers (Authorization, Cookie, API keys)
- Add `X-Request-ID` header to response

### 4.4 Sử dụng Logging trong Code

```python
from app.config.logging_config import get_logger

log = get_logger(__name__)

# Basic logging
log.info("Starting agent session: %s", session_id)
log.debug("LLM prompt: %s", prompt)
log.warning("Qdrant fallback to simple search")
log.error("Tool execution failed: %s", str(e))
log.exception("Unexpected error")  # Auto includes traceback
```

### 4.5 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Logging level |
| `LOG_FILE` | `./logs/agent_service.log` | Log file path |
| `ENABLE_JSON_LOGGING` | `false` (dev) / `true` (prod) | JSON format |

---

## 5. Cách Check Logs

### 5.1 Development (Docker)

```bash
# Xem logs backend real-time
tail -f logs/backend/petties-backend.log

# Xem logs AI service real-time
tail -f logs/ai-service/agent_service.log

# Xem error logs
tail -f logs/backend/petties-error.log
tail -f logs/ai-service/agent_service_errors.log

# Tìm request cụ thể (dùng Request ID)
grep "abc12345" logs/backend/*.log
grep "abc12345" logs/ai-service/*.log

# Tìm theo ngày
grep "2026-03-22" logs/backend/petties-backend.log

# Xem logs từ container (cách cũ - vẫn hoạt động)
docker logs petties-dev-backend
docker logs petties-dev-ai-service
```

### 5.2 Local Development (không Docker)

```bash
# Backend
cd backend-spring/petties
tail -f logs/petties-backend.log

# AI Service
cd petties-agent-serivce
tail -f logs/agent_service.log
```

### 5.3 Production (EC2)

```bash
# Backend logs
sudo tail -f /var/log/petties/backend.log

# AI Service logs
sudo tail -f /var/log/petties/ai-service.log

# Search logs
sudo grep "ERROR" /var/log/petties/backend.log | tail -50
sudo grep "req-abc123" /var/log/petties/*.log
```

### 5.4 Log Commands Cheatsheet

| Command | Purpose |
|---------|---------|
| `tail -f <file>` | Real-time monitoring |
| `grep "pattern" <file>` | Search pattern |
| `grep -r "pattern" <dir>` | Search recursive |
| `tail -n 100 <file>` | Last 100 lines |
| `wc -l <file>` | Count lines |
| `less <file>` | Paginated view |
| `tail -F <file>` | Follow + retry on rotate |

---

## 6. Log Format

### 6.1 Backend Console Format

```
2026-03-22 10:30:45.123 INFO  [http-nio-8080-exec-1] c.p.petties.controller - [abc12345] --> POST /api/v1/bookings (IP: 192.168.1.100, User: user-456)
2026-03-22 10:30:45.234 INFO  [http-nio-8080-exec-1] c.p.petties.controller - [abc12345] <-- POST /api/v1/bookings | Status: 201 | Duration: 111ms
```

### 6.2 Backend File Format

```
2026-03-22 10:30:45.123 INFO  [http-nio-8080-exec-1] c.p.petties.controller - [abc12345] --> POST /api/v1/bookings (IP: 192.168.1.100)
```

### 6.3 AI Service Console/File Format

```
2026-03-22 10:30:45 | INFO     | [abc12345] --> POST /api/v1/agents/chat | IP: 192.168.1.101 | Query: {'user_id': '***REDACTED***'}
2026-03-22 10:30:47 | INFO     | [abc12345] <-- POST /api/v1/agents/chat | Status: 200 | Duration: 1523.45ms
```

### 6.4 JSON Format (Production)

```json
{
  "timestamp": "2026-03-22T10:30:45.123456Z",
  "level": "INFO",
  "logger": "app.main",
  "message": "Starting Petties Agent Service",
  "module": "main",
  "function": "lifespan",
  "line": 29,
  "exception": null
}
```

### 6.5 MDC Fields (Backend)

| Field | Description |
|-------|-------------|
| `requestId` | Unique request identifier (8 chars) |
| `method` | HTTP method (GET, POST, etc.) |
| `path` | Request path |
| `query` | Query string (masked) |
| `userId` | User ID from header |
| `clientIp` | Client IP address |

---

## 7. Correlation ID (Request Tracing)

### 7.1 Concept

```
┌─────────┐    req-abc123    ┌─────────────┐    req-abc123    ┌──────────┐
│ Client  │ ────────────────▶│   Backend   │ ─────────────────▶│ AI Svc   │
└─────────┘                  └─────────────┘                  └──────────┘
     │                              │                                │
     │                              │                                │
     └──────────────────────────────┴────────────────────────────────┘
                    All logs tagged with same ID
```

### 7.2 Sử dụng Request ID

**Frontend (thêm vào request headers):**

```typescript
// axios interceptor
api.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = generateUUID().substring(0, 8);
  return config;
});
```

**Backend (đọc từ header hoặc tự generate):**

```java
// Tự động trong LoggingInterceptor
String requestId = request.getHeader("X-Request-ID");
if (requestId == null) {
    requestId = UUID.randomUUID().toString().substring(0, 8);
}
```

### 7.3 Trace Request Across Services

```bash
# Lấy Request ID từ response
curl -i http://localhost:8081/api/v1/bookings

# Response headers:
# X-Request-ID: abc12345

# Tìm logs với ID đó
grep "abc12345" logs/backend/*.log
grep "abc12345" logs/ai-service/*.log
```

---

## 8. Troubleshooting

### 8.1 Logs không hiển thị

```bash
# Kiểm tra volume mount
docker inspect petties-dev-backend | grep -A 10 "Mounts"

# Kiểm tra logs directory
ls -la logs/

# Tạo directory nếu chưa có
mkdir -p logs/backend logs/ai-service
```

### 8.2 Logs bị rotate quá nhanh

Tăng `maxFileSize` trong `logback-spring.xml`:

```xml
<maxFileSize>50MB</maxFileSize>  <!-- Thay 10MB -->
<maxHistory>14</maxHistory>      <!-- Giảm retention -->
```

### 8.3 Quá nhiều SQL logs

Tắt Hibernate SQL logging trong `logback-spring.xml`:

```xml
<!-- Development -->
<springProfile name="dev">
    <logger name="org.hibernate.SQL" level="WARN" />  <!-- Đổi từ DEBUG -->
</springProfile>
```

### 8.4 Performance Issues

Nếu logging gây chậm:

1. **Async Logging:** Backend đã dùng `AsyncAppender` (queue 512)
2. **Giảm log level:** Đổi sang `WARN` cho production
3. **Tắt console logging:** Trong prod, chỉ log file

```xml
<springProfile name="prod">
    <root level="INFO">
        <!-- Không có CONSOLE appender -->
        <appender-ref ref="ASYNC_FILE" />
        <appender-ref ref="JSON_FILE" />
    </root>
</springProfile>
```

### 8.5 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Logs mất sau restart | Không mount volume | Thêm `./logs/backend:/app/logs` vào docker-compose |
| Request ID không khớp | Frontend không gửi header | Thêm `X-Request-ID` vào axios interceptor |
| Sensitive data trong logs | Chưa mask params | Kiểm tra `SENSITIVE_PARAMS` trong interceptor |
| JSON logs trống | Enable JSON sai env | Set `enable_json_logging=(APP_ENV=="production")` |

---

## 9. Best Practices

### 9.1 Logging Guidelines

```
DO:
  ✅ Log request/response với Request ID
  ✅ Log errors với stack trace
  ✅ Mask sensitive data (passwords, tokens)
  ✅ Log at appropriate level (INFO for flow, DEBUG for details)
  ✅ Include relevant context (user ID, booking ID, etc.)

DON'T:
  ❌ Log full request/response bodies (use size limits)
  ❌ Log passwords, tokens, API keys
  ❌ Log at DEBUG level in production
  ❌ Log personally identifiable information (PII)
  ❌ Use println() instead of logger
```

### 9.2 Log Levels by Scenario

| Scenario | Level | Example |
|----------|-------|---------|
| Service startup/shutdown | INFO | "Starting Petties Agent Service v1.0.0" |
| Request received | INFO | "[req-abc] --> POST /api/v1/bookings" |
| Business logic | DEBUG | "Processing booking for clinic: 123" |
| External API call | INFO | "Calling OpenRouter API" |
| Fallback triggered | WARN | "Qdrant unavailable, using simple search" |
| User not found | WARN | "User not found: user-456" |
| Exception caught | ERROR | "Database connection failed: timeout" |
| System down | CRITICAL | "Cannot connect to database" |

---

## 10. Related Documents

| Document | Path |
|----------|------|
| Sentry Setup Guide | `docs-references/operations/SENTRY_SETUP_GUIDE.md` |
| Bug Monitoring Guide | `docs-references/operations/BUG_MONITORING_GUIDE.md` |
| Exception Handling Guide | `docs-references/development/exception/EXCEPTION_HANDLING_GUIDE.md` |

---

**Last updated:** 22/03/2026  
**Author:** Agent (Logging Enhancement v1.0.0)
