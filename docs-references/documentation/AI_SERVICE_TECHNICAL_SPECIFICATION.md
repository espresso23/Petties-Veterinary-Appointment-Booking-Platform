# Tài liệu Kỹ thuật - AI Agent Service (Petties)

**Phiên bản:** 1.4  
**Cập nhật:** 2026-03-17  
**Tham chiếu:** `AI_DIAGNOSIS_FEATURE_PLAN.md`, `AI_DIAGNOSIS_PROGRESS.md`

---

## 1. Tổng quan

AI Agent Service là microservice FastAPI chịu trách nhiệm:

- chat trợ lý AI cho Pet Owner và các role nội bộ
- truy xuất knowledge base nội bộ bằng RAG
- gọi business tools qua FastMCP
- tổng hợp dữ liệu từ knowledge base, EMR và các nguồn nội bộ đáng tin cậy

Kiến trúc hiện tại **không còn dùng custom AI Diagnose stack cũ** như:

- `vision_model`
- Label Studio workflow cũ
- vision feedback loop theo thumbs up/down
- admin UI AI Diagnose cũ

---

## 2. Quy tắc theo role

### 2.1 Pet Owner

- Có thể dùng `web_search` như fallback khi knowledge base nội bộ chưa đủ.
- Mục tiêu là tư vấn phổ thông và hướng dẫn chăm sóc, không thay thế chẩn đoán lâm sàng.

### 2.2 Staff / Doctor flow

- Không được dùng `web_search` cho luồng chẩn đoán bệnh.
- Chỉ được dựa trên:
  - knowledge base nội bộ
  - EMR confirmed
  - case memory sinh từ EMR confirmed
  - các nguồn nội bộ đáng tin cậy khác nếu có
- Nếu hệ thống không có dữ liệu phù hợp thì phải trả lời rõ:
  - `Hiện chưa có thông tin về bệnh này trong hệ thống tri thức nội bộ.`

---

## 3. Tooling hiện tại

### 3.1 Tool đang hoạt động

- `pet_knowledge_search`
- `web_search`
- `get_user_pets`
- `search_clinics_nearby`
- `get_clinic_services`
- `check_available_slots`
- `create_booking_for_user`
- `get_patient_summary`
- `get_emr_history`
- `check_vaccination_status`

### 3.2 Tool đã loại khỏi runtime chính

- `analyze_pet_image` của hướng AI Diagnose cũ

Tool này không còn được seed mặc định, không còn nằm trong whitelist runtime, và không còn là một capability active của hệ thống.

---

## 4. Kiến trúc dữ liệu hiện tại

### 4.1 Knowledge base

- Lưu trong Qdrant
- Dùng cho RAG và grounding câu trả lời

### 4.2 EMR confirmed

- Là nguồn dữ liệu lâm sàng chính cho doctor flow
- Là nguồn ưu tiên để sinh case memory mới
- Là nguồn nhãn đáng tin cậy cho các vòng cải thiện chất lượng sau này

### 4.3 Case memory

- Không còn lấy trọng tâm từ thumbs up/down như hướng cũ
- Hướng mới là tái sử dụng dữ liệu từ EMR confirmed

---

## 5. Định hướng chẩn đoán qua ảnh mới

AI chẩn đoán qua ảnh sẽ đi theo hướng:

1. bác sĩ gửi ảnh + mô tả lâm sàng
2. Gemini Vision phân tích visual findings
3. output được map về canonical disease labels
4. agent đối chiếu với knowledge base và EMR/case memory
5. agent tổng hợp top bệnh liên quan nhất

Phần này là **kiến trúc mới đang ở giai đoạn thiết kế**, chưa phải runtime production hiện tại.

---

## 6. Những gì đã bị loại bỏ

Các thành phần sau đã bị loại khỏi runtime/dev flow để tránh nhiễu:

- route backend AI Diagnose cũ
- package `app/core/vision_model`
- Label Studio integration cũ
- vision labeling service cũ
- vision feedback schema cũ
- web admin page/service cho AI Diagnose cũ
- docker compose dev service của Label Studio

---

## 7. Tài liệu nguồn sự thật hiện tại

Khi làm việc với hướng AI diagnosis mới, ưu tiên tham chiếu:

- [AI_DIAGNOSIS_FEATURE_PLAN.md](/D:/SEP490/petties/docs-references/documentation/AI_DIAGNOSIS_FEATURE_PLAN.md)
- [AI_DIAGNOSIS_PROGRESS.md](/D:/SEP490/petties/docs-references/documentation/AI_DIAGNOSIS_PROGRESS.md)

Hai tài liệu trên phản ánh kiến trúc mới:

- doctor flow không dùng web search
- EMR confirmed là nguồn dữ liệu chính
- Gemini Vision là hướng image understanding mới
