# Petties Logging and Monitoring Setup (Current State)

Last Updated: 2026-04-20
Status: Active (code-aligned)

Vietnamese manual:
- docs-references/operations/LOGGING_MONITORING_MANUAL_VI.md

## Scope

This document describes the current, production-aligned setup for:
- Application logging (Backend Spring Boot, AI Service FastAPI)
- Audit log storage and retrieval
- Metrics monitoring (Prometheus + Grafana)
- Admin System Logs UI integration

This document reflects the code in:
- backend-spring/petties/
- petties-agent-serivce/
- petties-web/
- docker-compose.dev.yml
- docker-compose.prod.yml

## Environment Matrix

| Environment | FE | BE | AI | Monitoring | Typical command |
|---|---|---|---|---|---|
| dev | localhost:5173 | localhost:8081/api | localhost:8000 | localhost:9090 (Prom), localhost:3001 (Grafana) | docker compose -f docker-compose.dev.yml up -d --build |
| test | test.petties.world | api-test.petties.world | api-test AI route | Optional via monitoring profile | docker compose -f docker-compose.prod.yml --env-file .env.test --profile monitoring up -d --build |
| prod | www.petties.world | api.petties.world | api.petties.world/ai | Optional via monitoring profile | docker compose -f docker-compose.prod.yml --env-file .env.prod --profile monitoring up -d --build |

## 1) Backend Logging (Spring Boot)

Source files:
- backend-spring/petties/src/main/resources/logback-spring.xml
- backend-spring/petties/src/main/resources/application.properties
- backend-spring/petties/src/main/resources/application-prod.properties

### 1.1 Log destinations

Configured appenders:
- Console: colored logs
- Rolling file: logs/petties-backend.log
- Error rolling file (WARN+): logs/petties-error.log
- JSON rolling file (prod): logs/petties-json.log
- Async file wrapper: ASYNC_FILE

Retention and rotation:
- Main backend log: 10MB/file, 30 days, 1GB cap
- Error log: 10MB/file, 60 days, 500MB cap
- JSON log: 20MB/file, 7 days, 500MB cap

### 1.2 Context-enriched fields

Pattern includes request context in MDC fields:
- requestId
- traceId
- method
- path
- userId
- clientIp
- status
- latencyMs

### 1.3 Runtime log controls

Actuator loggers endpoint is exposed in dev config:
- /api/actuator/loggers

Actuator exposure currently includes:
- health, info, metrics, loggers, prometheus

## 2) Backend Audit Logs (MongoDB)

Source files:
- backend-spring/petties/src/main/java/com/petties/petties/service/BackendAuditLogService.java
- backend-spring/petties/src/main/java/com/petties/petties/service/SystemLogService.java
- backend-spring/petties/src/main/java/com/petties/petties/controller/SystemLogController.java
- backend-spring/petties/src/main/resources/application.properties

### 2.1 Storage model

Collection:
- audit_logs

Key indexes are created on startup:
- event_id (unique)
- occurred_at
- actor.user_id + occurred_at
- action + occurred_at
- resource fields + occurred_at
- result.status + occurred_at
- correlation.request_id
- expire_at (TTL)

Retention:
- Controlled by AUDIT_LOG_RETENTION_DAYS (default 365)

### 2.2 Admin query endpoint

Backend endpoint:
- GET /api/admin/system-logs/backend

Authorization:
- ADMIN role required (@PreAuthorize hasRole('ADMIN'))

## 3) AI Service Logging (FastAPI)

Source files:
- petties-agent-serivce/app/config/logging_config.py
- petties-agent-serivce/app/middleware/logging_middleware.py
- petties-agent-serivce/app/config/settings.py

### 3.1 Logging handlers

Configured handlers:
- Console handler
- Rotating file handler (10MB, 5 backups)
- Error rotating file handler (10MB, 10 backups)

Log file path is configurable via:
- LOG_FILE (default ./logs/agent_service.log)
- LOG_LEVEL (default INFO)

Structured JSON logging:
- Supported by JSONFormatter
- Typically enabled in production paths through setup_logging(... enable_json_logging=True)

### 3.2 Request/response logging middleware

LoggingMiddleware records:
- request_id (generated or passed via header)
- trace_id
- HTTP method/path
- masked query params
- client IP
- user agent
- response status
- latency

Sensitive data masking:
- Headers: authorization, cookie, api key variants
- Query params: password/token/secret/api key patterns

Audit event writing:
- Middleware writes events into audit log service for API actions

## 4) AI Service Metrics

Source files:
- petties-agent-serivce/app/monitoring/metrics.py
- petties-agent-serivce/app/main.py
- petties-agent-serivce/app/middleware/logging_middleware.py

Exposed endpoint:
- GET /metrics (disabled only if ENABLE_PROMETHEUS=false)

Metric families:
- petties_ai_http_requests_total
- petties_ai_http_request_duration_seconds (histogram)
- petties_ai_http_in_flight_requests
- petties_ai_http_errors_total

Cardinality protection:
- Path normalization for UUID and numeric segments

## 5) Backend Metrics (Micrometer/Prometheus)

Source files:
- backend-spring/petties/pom.xml
- backend-spring/petties/src/main/resources/application.properties
- backend-spring/petties/src/main/resources/application-prod.properties

Enabled components:
- micrometer-registry-prometheus dependency
- prometheus actuator exposure
- HTTP server request histogram and SLO buckets

Prometheus endpoint:
- GET /api/actuator/prometheus

## 6) Prometheus and Grafana Stack

Source files:
- docker-compose.dev.yml
- docker-compose.prod.yml
- monitoring/prometheus/prometheus.dev.yml
- monitoring/prometheus/prometheus.prod.yml
- monitoring/grafana/provisioning/datasources/prometheus.yml
- monitoring/grafana/provisioning/dashboards/dashboards.yml
- monitoring/grafana/provisioning/dashboards/json/petties-observability.json

### 6.1 Scrape targets

Prometheus scrapes:
- prometheus:9090
- backend:8080 at /api/actuator/prometheus
- ai-service:8000 at /metrics

### 6.2 Grafana provisioning

Auto-provisioned:
- Data source: Petties-Prometheus
- Dashboard: petties-observability (UID: petties-observability)

### 6.3 Ports

Dev defaults:
- Prometheus: 9090
- Grafana: 3001

Prod/test profile defaults (localhost bind):
- Prometheus: 9090 (override: PROMETHEUS_HOST_PORT)
- Grafana: 3001 (override: GRAFANA_HOST_PORT)

## 7) Admin System Logs UI Integration

Source file:
- petties-web/src/pages/admin/logs/SystemLogsPage.tsx

### 7.1 Functional tabs

Current tabs:
- Health
- Load
- Security
- Raw Logs

### 7.2 Load metrics source

Load tab uses Prometheus exposition data from:
- Backend /api/actuator/prometheus
- AI /metrics

Fallback behavior:
- If metrics endpoints are unavailable, UI falls back to log-derived indicators and shows warning context.

### 7.3 Direct observability links in UI

System Logs header includes direct buttons:
- Open Petties Observability dashboard (deep link)
- Open Grafana
- Open Prometheus
- Open backend raw metrics

Optional FE env overrides:
- VITE_GRAFANA_URL
- VITE_PROMETHEUS_URL

## 8) Setup Steps (Practical)

### 8.1 Development (full local stack)

1. Start stack:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

2. Verify services:

```bash
docker compose -f docker-compose.dev.yml ps
```

3. Check endpoints:

```bash
curl http://localhost:8081/api/actuator/health
curl http://localhost:8081/api/actuator/prometheus
curl http://localhost:8000/health
curl http://localhost:8000/metrics
curl http://localhost:9090/-/ready
```

4. Open dashboards:
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090

### 8.2 Test/Production with monitoring profile

```bash
docker compose -f docker-compose.prod.yml --env-file .env.test --profile monitoring up -d --build
# or
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile monitoring up -d --build
```

## 9) Smoke Test Checklist

- Backend health endpoint returns UP.
- Backend prometheus endpoint returns text/plain metrics.
- AI health endpoint returns healthy JSON.
- AI /metrics endpoint returns Prometheus metrics.
- Prometheus targets page shows backend and ai-service as UP.
- Grafana can query Petties-Prometheus data source.
- Dashboard uid petties-observability loads panels.
- Admin System Logs page can open Grafana/Prometheus links directly.
- System Logs Load tab shows metrics source as Prometheus (or explicit fallback warning).

## 10) Known Operational Notes

- Spring Security currently permits /actuator/**; restrict exposure at network or gateway layer in production if needed.
- Monitoring profile in docker-compose.prod.yml is optional and must be explicitly enabled.
- Legacy docs may contain outdated architecture snippets; this document is the canonical current-state setup reference.

## Related Documents

- docs-references/operations/PROMETHEUS_GRAFANA_MONITORING_SETUP.md
- docs-references/operations/SENTRY_SETUP_GUIDE.md
- docs-references/operations/LOGGING_GUIDE.md
- docs-references/operations/LOGGING_MONITORING_MANUAL_VI.md
