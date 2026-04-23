# Prometheus + Grafana Monitoring Setup

Last Updated: 2026-04-20

## Scope

This document describes the metrics-based monitoring stack for Petties:
- Spring Boot backend metrics at `/api/actuator/prometheus`
- AI service metrics at `/metrics`
- Prometheus scraping both services
- Grafana dashboard provisioning for operational visibility

## Implemented Components

## 1) Backend Spring Boot
- Added `micrometer-registry-prometheus` dependency in `backend-spring/petties/pom.xml`.
- Enabled Prometheus endpoint in `application.properties`:
  - `management.endpoints.web.exposure.include=health,info,metrics,loggers,prometheus`
  - `management.prometheus.metrics.export.enabled=true`
- Enabled histogram/SLO buckets for HTTP requests:
  - `management.metrics.distribution.percentiles-histogram.http.server.requests=true`
  - `management.metrics.distribution.slo.http.server.requests=100ms,250ms,500ms,1s,2s,5s`
- Production profile now exposes Prometheus endpoint:
  - `management.endpoints.web.exposure.include=health,info,prometheus`

## 2) AI Service FastAPI
- Added native Prometheus instrumentation module:
  - `petties-agent-serivce/app/monitoring/metrics.py`
- Instrumented request metrics in middleware:
  - request count
  - request duration histogram
  - in-flight gauge
  - error count (status >= 400)
- Added endpoint `/metrics` in `petties-agent-serivce/app/main.py`.
- Metrics endpoint can be disabled using `ENABLE_PROMETHEUS=false`.

## 3) Docker Compose Integration

### Development (`docker-compose.dev.yml`)
- Added `prometheus` service (port `9090`)
- Added `grafana` service (port `3001`)
- Added persistent volumes:
  - `prometheus_dev_data`
  - `grafana_dev_data`

### Production (`docker-compose.prod.yml`)
- Added optional monitoring profile services:
  - `prometheus` (localhost bind, default port `9090`)
  - `grafana` (localhost bind, default port `3001`)
- Profile name: `monitoring`
- Added persistent volumes:
  - `prometheus_data`
  - `grafana_data`

## 4) Config Files
- Prometheus scrape config:
  - `monitoring/prometheus/prometheus.dev.yml`
  - `monitoring/prometheus/prometheus.prod.yml`
- Grafana provisioning:
  - `monitoring/grafana/provisioning/datasources/prometheus.yml`
  - `monitoring/grafana/provisioning/dashboards/dashboards.yml`
  - `monitoring/grafana/provisioning/dashboards/json/petties-observability.json`

## Run Guide

## Development

Start full stack with monitoring:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Access endpoints:
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
- Backend metrics: `http://localhost:8081/api/actuator/prometheus`
- AI metrics: `http://localhost:8000/metrics`

Grafana default credentials (from compose env):
- User: `admin`
- Password: `admin123`

## Production/Test with optional monitoring profile

```bash
docker compose -f docker-compose.prod.yml --profile monitoring up -d --build
```

Optional env overrides:
- `PROMETHEUS_HOST_PORT`
- `GRAFANA_HOST_PORT`
- `GRAFANA_ADMIN_USER`
- `GRAFANA_ADMIN_PASSWORD`

## Recommended Alert Rules (Prometheus/Grafana)

- Backend 5xx error rate > 3% for 5m
- Backend p95 latency > 1s for 10m
- AI error rate > 5% for 5m
- AI in-flight requests above threshold for 5m
- Hikari active connections near max pool for 5m

## Notes

- The Admin System Logs page can still be used for audit and incident forensics.
- Prometheus/Grafana is the source of truth for overload and SLO-based monitoring.
- Keep Discord alerts linked to metric rules for actionable incidents.
