# Requirements Logging và Monitoring Petties

Ngày cập nhật: 2026-04-20  
Phạm vi: dev, test, prod  
Trạng thái: Đang áp dụng theo cấu hình chạy thực tế

## 1) Requirements của Logging và Monitoring

### 1.1 Requirements cho Logging

- Ghi nhận đầy đủ request/response cho Backend và AI service.
- Có khả năng truy vết theo requestId, traceId, userId, path, method.
- Tách log lỗi để điều tra nhanh sự cố.
- Có cơ chế xoay vòng log (rotation) để tránh đầy đĩa.
- Lưu audit event phục vụ điều tra bảo mật và nghiệp vụ.

### 1.2 Requirements cho Monitoring

- Quan sát được sức khỏe dịch vụ theo thời gian thực.
- Theo dõi tải hệ thống: request rate, error rate, latency p95, in-flight requests.
- Có dashboard tập trung để vận hành (Grafana).
- Có nguồn metric chuẩn để truy vấn sâu (Prometheus).
- Hỗ trợ nhận biết nhanh trạng thái: ổn định, cảnh báo, quá tải.

## 2) Giải pháp công nghệ và vai trò

### 2.1 Spring Boot Backend

- Công nghệ: Spring Boot + Logback + Actuator + Micrometer Prometheus.
- Vai trò:
  - Ghi application log và error log.
  - Expose metrics tại `/api/actuator/prometheus`.
  - Expose health tại `/api/actuator/health`.

File chính:
- `backend-spring/petties/src/main/resources/logback-spring.xml`
- `backend-spring/petties/src/main/resources/application.properties`
- `backend-spring/petties/src/main/resources/application-prod.properties`

### 2.2 AI Service FastAPI

- Công nghệ: FastAPI + middleware logging + prometheus-client.
- Vai trò:
  - Ghi request log, lỗi và context.
  - Expose metrics tại `/metrics`.
  - Expose health tại `/health`.

File chính:
- `petties-agent-serivce/app/config/logging_config.py`
- `petties-agent-serivce/app/middleware/logging_middleware.py`
- `petties-agent-serivce/app/monitoring/metrics.py`

### 2.3 Audit Log (MongoDB)

- Công nghệ: MongoDB collection `audit_logs`.
- Vai trò:
  - Lưu action HTTP dạng `API_<METHOD>` và business actions.
  - Hỗ trợ truy vấn điều tra theo thời gian, actor, action, status.

File chính:
- `backend-spring/petties/src/main/java/com/petties/petties/service/BackendAuditLogService.java`
- `petties-agent-serivce/app/services/audit_log_service.py`

### 2.4 Prometheus

- Công nghệ: Prometheus scrape metrics từ backend, ai-service, self.
- Vai trò:
  - Thu thập và lưu time-series metrics.
  - Là nguồn dữ liệu chính cho Grafana và System Logs tab Quá tải.

File chính:
- `monitoring/prometheus/prometheus.dev.yml`
- `monitoring/prometheus/prometheus.prod.yml`

### 2.5 Grafana

- Công nghệ: Grafana provisioning datasource + dashboard JSON.
- Vai trò:
  - Hiển thị dashboard vận hành tập trung.
  - Dashboard mặc định: `petties-observability`.

File chính:
- `monitoring/grafana/provisioning/datasources/prometheus.yml`
- `monitoring/grafana/provisioning/dashboards/dashboards.yml`
- `monitoring/grafana/provisioning/dashboards/json/petties-observability.json`

### 2.6 System Logs (Admin Web)

- Công nghệ: React page tích hợp backend logs + Prometheus metrics.
- Vai trò:
  - Quan sát nhanh theo tab Sức khỏe, Quá tải, An toàn, Log thô.
  - Mở nhanh Grafana, Prometheus, raw metrics.

File chính:
- `petties-web/src/pages/admin/logs/SystemLogsPage.tsx`

## 3) Xác minh triển khai thực tế (đã kiểm tra)

Thời điểm kiểm tra: 2026-04-20

Các lệnh đã chạy và kết luận:

1. `docker compose -f docker-compose.prod.yml --profile monitoring ps`
- Kết luận: `prometheus`, `grafana`, `backend`, `ai-service` đều `Up` và `healthy`.

2. `docker compose -f docker-compose.prod.yml --profile monitoring logs --tail 120 prometheus`
- Kết luận: Prometheus khởi động thành công, đã load config.

3. `docker compose -f docker-compose.prod.yml --profile monitoring exec prometheus wget -qO- http://localhost:9090/api/v1/targets`
- Kết luận: 3 targets đều `up`: `backend`, `ai-service`, `prometheus`.

4. `docker compose -f docker-compose.prod.yml --profile monitoring exec prometheus wget -qO- http://backend:8080/api/actuator/prometheus | head`
- Kết luận: Backend metrics trả dữ liệu bình thường.

5. `docker compose -f docker-compose.prod.yml --profile monitoring exec prometheus wget -qO- http://ai-service:8000/metrics | head`
- Kết luận: AI metrics trả dữ liệu bình thường.

## 4) Vì sao Prometheus giao diện trống "không có gì hiển thị"

Nguyên nhân trong ảnh bạn gửi:
- Ô `Expression` đang để trống và chưa bấm truy vấn metric hợp lệ.
- Thông báo "Chưa có dữ liệu nào được truy vấn" nghĩa là chưa chạy query, không phải hệ thống không có metric.

Cách kiểm tra đúng ngay trên Prometheus UI (`http://localhost:9090`):

1. Dán query rồi bấm `Thực thi`:
- `up`
- `http_server_requests_seconds_count`
- `petties_ai_http_requests_total`

2. Kỳ vọng kết quả:
- `up` phải có value `1` cho `backend`, `ai-service`, `prometheus`.
- Hai metric còn lại tăng dần khi có traffic.

Nếu query vẫn rỗng:
- Vào `Trạng thái -> Targets` kiểm tra target có `UP` không.
- Nếu `DOWN`, kiểm tra lại endpoint metrics tương ứng.

## 5) Cách đọc nhanh trạng thái ổn định hay quá tải

| Chỉ số | Ổn định | Cảnh báo | Quá tải |
|---|---|---|---|
| Backend 5xx error rate | < 1% | 1% - 3% | > 3% trong 5 phút |
| Backend p95 latency | < 500ms | 500ms - 1000ms | > 1000ms trong 10 phút |
| AI error rate | < 2% | 2% - 5% | > 5% trong 5 phút |
| AI in-flight requests | Quanh baseline | > 2x baseline | > 3x baseline và tiếp tục tăng |

Quy tắc quyết định nhanh:
- Ổn định: tất cả chỉ số trong vùng ổn định.
- Cảnh báo: từ 2 chỉ số cùng vào vùng cảnh báo.
- Quá tải: bất kỳ chỉ số nào vào vùng quá tải đúng cửa sổ thời gian.

## 6) Runbook ngắn, làm thật

### 6.1 Khởi chạy stack monitoring

```bash
docker compose -f docker-compose.prod.yml --profile monitoring up -d --build
```

### 6.2 Kiểm tra service

```bash
docker compose -f docker-compose.prod.yml --profile monitoring ps
```

### 6.3 Kiểm tra targets

Mở:
- Prometheus: `http://localhost:9090`
- Trang Targets: `http://localhost:9090/targets`

### 6.4 Query tối thiểu để xác nhận có dữ liệu

- `up`
- `rate(http_server_requests_seconds_count[5m])`
- `histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket[5m])))`
- `rate(petties_ai_http_requests_total[5m])`
- `petties_ai_http_in_flight_requests`

### 6.5 Bảng tra cứu expression (nguồn metric và vai trò)

| Expression | Lấy từ metric nào | Nguồn sinh metric | Vai trò vận hành |
|---|---|---|---|
| `up` | `up` | Prometheus tự sinh theo trạng thái scrape target | Xác nhận target `UP/DOWN` |
| `rate(http_server_requests_seconds_count[5m])` | `http_server_requests_seconds_count` | Spring Boot Actuator + Micrometer tại `/api/actuator/prometheus` | Theo dõi request rate backend |
| `histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket[5m])))` | `http_server_requests_seconds_bucket` | Spring Boot Actuator + Micrometer histogram | Đo độ trễ backend p95 |
| `rate(petties_ai_http_requests_total[5m])` | `petties_ai_http_requests_total` | FastAPI metrics trong `app/monitoring/metrics.py` | Theo dõi request rate AI service |
| `rate(petties_ai_http_errors_total[5m]) / clamp_min(rate(petties_ai_http_requests_total[5m]), 1)` | `petties_ai_http_errors_total`, `petties_ai_http_requests_total` | FastAPI metrics trong `app/monitoring/metrics.py` | Tỷ lệ lỗi AI service |
| `histogram_quantile(0.95, sum(rate(petties_ai_http_request_duration_seconds_bucket[5m])) by (le))` | `petties_ai_http_request_duration_seconds_bucket` | FastAPI Histogram trong `app/monitoring/metrics.py` | Đo độ trễ AI p95 |
| `petties_ai_http_in_flight_requests` | `petties_ai_http_in_flight_requests` | FastAPI Gauge trong `app/monitoring/metrics.py` | Số request AI đang xử lý tại thời điểm hiện tại |

Ghi chú:
- Các expression cho AI ở bảng trên đang đồng bộ với dashboard `petties-observability` trong Grafana.
- Nếu query trả rỗng, kiểm tra lại `Targets` trước khi kết luận hệ thống mất dữ liệu.

## 7) Danh sách endpoint vận hành cần nhớ

- Backend health: `http://localhost:8081/api/actuator/health`
- Backend metrics: `http://localhost:8081/api/actuator/prometheus`
- AI health: `http://localhost:8000/health`
- AI metrics: `http://localhost:8000/metrics`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

## 8) Biến môi trường quan trọng

- `VITE_GRAFANA_URL`
- `VITE_PROMETHEUS_URL`
- `GRAFANA_ADMIN_USER`
- `GRAFANA_ADMIN_PASSWORD`
- `GRAFANA_HOST_PORT`
- `PROMETHEUS_HOST_PORT`
- `AUDIT_LOG_RETENTION_DAYS`
- `ENABLE_PROMETHEUS`

## 9) Bulk Delete Audit Logs (Admin)

Tính năng đã implement trên trang Admin System Logs (tab Log thô):
- Xóa nhiều bản ghi theo selected rows.
- Xóa bản ghi theo khoảng thời gian.
- Áp dụng theo phạm vi nguồn: `ALL`, `BACKEND`, `AI`.

Lưu ý an toàn:
- Chỉ ADMIN mới thực hiện được.
- Xóa là hard delete, không thể hoàn tác.

### 9.1 API backend đã có

- `DELETE /admin/system-logs/backend/bulk`
  - Body:
    - `eventIds: string[]`
    - `source: ALL | BACKEND | AI`
- `DELETE /admin/system-logs/backend/time-range`
  - Body:
    - `fromTime: ISO-8601`
    - `toTime: ISO-8601`
    - `source: ALL | BACKEND | AI`

### 9.2 Quy trình thao tác nhanh trên UI

1. Vào Admin -> System Logs -> tab `Log thô`.
2. Chọn nguồn log (`Tất cả`, `Backend`, `AI Service`) nếu cần.
3. Chọn nhiều dòng bằng checkbox hoặc `Chọn toàn trang`.
4. Bấm `Xóa bản ghi đã chọn` và xác nhận.
5. Hoặc nhập `Từ thời gian` và `Đến thời gian`, bấm `Xóa theo khoảng thời gian` và xác nhận.
6. Sau khi xóa thành công, màn hình tự tải lại trang 1 với bộ lọc hiện tại.

### 9.3 Kết quả trả về

- API trả `deleted_count` để xác nhận số bản ghi đã xóa thực tế.
- Nếu payload không hợp lệ (ví dụ `fromTime > toTime`), hệ thống trả lỗi 400 với message phù hợp.

## 10) Kết luận vận hành

- Monitoring stack đang chạy và scrape metrics bình thường.
- Prometheus UI trống trong ảnh là do chưa nhập query, không phải mất dữ liệu hệ thống.
- Có thể dùng ngay các query ở mục 6.4 để xác nhận dữ liệu và theo dõi tải thực tế.
