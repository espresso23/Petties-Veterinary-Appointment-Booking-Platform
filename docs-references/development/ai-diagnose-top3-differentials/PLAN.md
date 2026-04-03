# Kế hoạch hiển thị Top 3 chẩn đoán khả thi cho AI Diagnose

Last Updated: 2026-03-30

## Vấn đề hiện tại

Hiện tại AI Diagnose đã có khả năng trả về danh sách `top_differentials`, evidence nội bộ, gợi ý SOAP và gợi ý đơn thuốc, nhưng chưa có cơ chế hiển thị rõ ràng:

- 3 chẩn đoán khả thi nhất
- phần trăm tương ứng cho từng chẩn đoán
- ý nghĩa chính xác của phần trăm đó
- lý do vì sao AI xếp hạng chẩn đoán theo thứ tự như vậy

Ngoài ra, nếu dùng cụm từ `% độ chính xác` ngay trên UI thì có nguy cơ gây hiểu nhầm, vì:

- một request runtime đơn lẻ không thể tự sinh ra độ chính xác lâm sàng thực sự
- kết quả hiện tại là tổng hợp từ retrieval, case memory, vision, protocol và synthesis
- nếu chưa có calibration dựa trên tập EMR confirmed thì phần trăm này chỉ nên được hiểu là mức độ phù hợp hoặc mức độ tin cậy tương đối

## Hành vi mong muốn

Khi `STAFF` hoặc `ADMIN` nhập triệu chứng và chạy AI Diagnose ở chế độ phân tích đầy đủ, hệ thống cần:

- trả về đúng 3 chẩn đoán khả thi nhất
- sắp xếp theo mức độ phù hợp giảm dần
- hiển thị phần trăm cho từng chẩn đoán để bác sĩ dễ đọc nhanh
- hiển thị lý do hỗ trợ và bằng chứng liên quan cho từng chẩn đoán
- giữ disclaimer rõ ràng rằng đây là gợi ý AI, không thay thế chẩn đoán lâm sàng
- tránh dùng từ ngữ khiến người dùng hiểu nhầm rằng hệ thống đang hiển thị “độ chính xác y khoa” đã được kiểm định

## Quyết định đề xuất về mặt sản phẩm

Khuyến nghị dùng nhãn:

- `Khớp với dữ liệu đã được kiểm chứng (%)`

Không khuyến nghị dùng mặc định:

- `Độ chính xác (%)`

Lý do:

- bám sát hơn với kiến trúc retrieval-first hiện tại, nơi hệ thống đối chiếu ca mới với knowledge base và case memory đã được xác nhận
- tránh gây hiểu nhầm về xác suất đúng theo nghĩa lâm sàng
- dễ mở rộng sang confidence score hoặc calibrated score trong tương lai

## Phạm vi liên quan trong code

- `petties-agent-serivce/app/ai_diagnose/staff_diagnosis_service.py`
- `petties-agent-serivce/app/ai_diagnose/schemas.py`
- `petties-agent-serivce/app/ai_diagnose/diagnosis_protocol_service.py`
- `petties-agent-serivce/app/core/rag/case_memory.py`
- `petties-agent-serivce/app/core/rag/hybrid_engine.py`
- `petties-agent-serivce/app/core/vision/gemini_vision_adapter.py`
- `petties-web/src/components/emr/AIDiagnosisPanel.tsx`
- `petties-web/src/pages/staff/emr/CreateEmrPage.tsx`
- `docs-references/documentation/AI_DIAGNOSIS_RUNTIME_FLOW_VI.md`
- `docs-references/documentation/AI_EVALUATION_METRICS_FRAMEWORK.md`

## Khoảng trống hiện tại

### 1. Chưa có score phần trăm chuẩn hóa cho top differentials

Hệ thống có `top_differentials`, nhưng chưa có quy ước rõ ràng:

- score gốc đến từ đâu
- score nào được chọn để hiển thị UI
- cách chuyển score thành phần trăm dễ đọc

### 2. Chưa tách bạch giữa độ chính xác và độ phù hợp

Nếu hiển thị `% độ chính xác`, người dùng có thể hiểu sai rằng:

- đây là xác suất đúng đã được kiểm chứng
- hệ thống đã được hiệu chuẩn như một mô hình chẩn đoán lâm sàng độc lập

Trong khi thực tế hiện tại đây chỉ nên là điểm xếp hạng tương đối.

### 3. Chưa có response schema rõ ràng cho frontend

Frontend chưa có contract rõ ràng cho từng differential item, ví dụ:

- `score_percent`
- `rank`
- `confidence_note`
- `supporting_reasons`

### 4. Chưa có quy tắc fallback khi evidence yếu

Nếu KB / Case Memory / KG không đủ mạnh thì hệ thống cần:

- vẫn có thể hiển thị top 3 nếu có cơ sở tối thiểu
- nhưng không được tạo cảm giác quá chắc chắn
- và không được hiển thị phần trăm theo kiểu overclaim

## Thiết kế đích

### Contract bổ sung để khóa nội dung theo chẩn đoán bác sĩ chọn

Để tránh gợi ý SOAP/Plan/đơn thuốc chung chung sau khi bác sĩ đã chọn 1 chẩn đoán, request cần bổ sung:

- `selected_diagnosis_code`
- `selected_diagnosis_label`

Khi hai trường này có mặt, backend sẽ ưu tiên chẩn đoán bác sĩ đã chọn làm `primary diagnosis` để sinh nội dung gợi ý nhất quán.

### Cấu trúc dữ liệu mong muốn cho mỗi chẩn đoán

```json
{
  "display_name_vi": "Viêm kết mạc hoặc nhiễm trùng mắt",
  "score_percent": 68,
  "rank": 1,
  "confidence_note": "Độ phù hợp cao dựa trên triệu chứng và ca tương tự",
  "supporting_reasons": [
    "Triệu chứng: đỏ mắt, chảy ghèn",
    "Có ca EMR đã xác nhận tương tự",
    "Evidence từ knowledge base phù hợp"
  ]
}
```

### Trạng thái nguồn suy luận cho toàn bộ khối kết quả

Để tránh hiển thị mơ hồ giữa trường hợp có grounding nội bộ và trường hợp chỉ còn fallback từ LLM, response nên có thêm metadata ở mức toàn khối kết quả:

```json
{
  "evidence_mode": "internal_grounded",
  "evidence_banner": "Đã đối chiếu dữ liệu nội bộ",
  "score_label": "Khớp với dữ liệu đã được kiểm chứng (%)"
}
```

Hoặc:

```json
{
  "evidence_mode": "llm_fallback",
  "evidence_banner": "AI suy luận tham khảo - chưa có dữ liệu nội bộ đủ gần",
  "score_label": "Mức độ phù hợp theo triệu chứng (%)"
}
```

### Cách hiển thị trên UI

- `Top 3 chẩn đoán khả thi nhất`
- badge trạng thái nguồn suy luận
- `Khớp với dữ liệu đã được kiểm chứng` khi có grounding nội bộ
- `Mức độ phù hợp theo triệu chứng` khi chỉ còn fallback từ LLM
- `Lý do AI gợi ý`
- `Bác sĩ cần đối chiếu thăm khám lâm sàng trước khi kết luận`

## Chiến lược tính điểm

### Giai đoạn 1 - Điểm hiển thị runtime

Trong giai đoạn đầu, `score_percent` được hiểu là:

- điểm phù hợp tương đối
- không phải độ chính xác lâm sàng thực sự

Nguồn để xếp hạng có thể tổng hợp từ:

- độ mạnh của evidence retrieval
- mức độ tương đồng từ case memory
- đóng góp từ Gemini Vision nếu có ảnh
- độ phù hợp với protocol
- thứ hạng sau bước synthesis

### Giai đoạn 2 - Điểm đã hiệu chuẩn

Nếu sau này muốn hiển thị `độ tin cậy` gần với thực tế hơn thì cần:

- tập EMR confirmed làm ground truth
- đo top-1 hit rate, top-3 hit rate
- calibration theo dữ liệu lịch sử
- chỉ khi đó mới nên cân nhắc wording gần với `độ chính xác`

## Kế hoạch triển khai

### Phase 1. Chốt wording ở mức sản phẩm

Thống nhất trong team rằng UI sẽ dùng:

- `Khớp với dữ liệu đã được kiểm chứng (%)` khi có grounding nội bộ
- `Mức độ phù hợp theo triệu chứng (%)` khi chỉ còn fallback từ LLM

Không dùng:

- `Độ chính xác (%)`

### Phase 2. Mở rộng response schema

Cập nhật schema trong `schemas.py` để mỗi differential có thêm:

- `score_percent`
- `rank`
- `confidence_note`
- `supporting_reasons`

Và ở mức response tổng có thêm:

- `evidence_mode`
- `evidence_banner`
- `score_label`

Mục tiêu là frontend không phải tự suy diễn dữ liệu.

### Phase 3. Tính điểm trong staff diagnosis service

Trong `staff_diagnosis_service.py`:

- xác định score nền cho từng differential
- kết hợp tín hiệu từ retrieval / case memory / vision / protocol
- lấy đúng top 3
- chuẩn hóa score thành phần trăm dễ đọc
- áp dụng giới hạn để tránh con số gây overclaim
- xác định `evidence_mode` theo nguồn suy luận thực tế:
  - `internal_grounded` khi có KB / KG / Case Memory đủ để grounding
  - `llm_fallback` khi KB và Case Memory không đủ, còn lại chủ yếu là LLM fallback

### Phase 4. Thêm rule an toàn cho low-evidence cases

Nếu evidence nội bộ yếu:

- giảm mức khẳng định
- thêm confidence note mang tính cảnh báo
- không để phần trăm tạo cảm giác chắc chắn giả
- vẫn giữ quy tắc không tự kê đơn theo heuristic khi thiếu evidence

### Phase 5. Cập nhật frontend rendering

Trong `AIDiagnosisPanel`:

- hiển thị top 3 chẩn đoán
- hiển thị thứ hạng và phần trăm
- hiển thị lý do hỗ trợ
- hiển thị badge trạng thái nguồn suy luận
- đổi nhãn phần trăm theo `evidence_mode`
- hiển thị disclaimer rõ ràng bằng tiếng Việt
- đảm bảo không dùng wording sai nghĩa

Quy tắc UI đề xuất:

- nếu `evidence_mode = internal_grounded`
  - badge: `Đã đối chiếu dữ liệu nội bộ`
  - nhãn score: `Khớp với dữ liệu đã được kiểm chứng (%)`
- nếu `evidence_mode = llm_fallback`
  - badge: `AI suy luận tham khảo - chưa có dữ liệu nội bộ đủ gần`
  - nhãn score: `Mức độ phù hợp theo triệu chứng (%)`

### Phase 6. Cập nhật documentation

Cập nhật tài liệu để phản ánh đúng ý nghĩa của phần trăm:

- `docs-references/documentation/AI_DIAGNOSIS_RUNTIME_FLOW_VI.md`
- có thể bổ sung thêm vào `docs-references/documentation/AI_EVALUATION_METRICS_FRAMEWORK.md`

Làm rõ:

- đây là điểm phù hợp runtime
- không phải độ chính xác đã kiểm định trên tập lâm sàng
- có 2 trạng thái hiển thị user-facing khác nhau tùy theo nguồn suy luận

### Phase 7. Bổ sung test

Cần có test cho:

- chỉ giữ đúng 3 differential đầu
- score được chuẩn hóa đúng
- low-evidence case bị giảm mức khẳng định
- `evidence_mode` được xác định đúng
- label tiếng Việt hiển thị đúng
- frontend render đúng dữ liệu mới

## Quy tắc tính phần trăm đề xuất

Cách đơn giản và dễ hiểu ban đầu:

1. tính raw score cho từng differential
2. lấy 3 differential mạnh nhất
3. chuẩn hóa tổng score về 100%
4. làm tròn hợp lý để hiển thị UI

Ví dụ:

- raw score: `0.81`, `0.26`, `0.12`
- normalized: `68%`, `22%`, `10%`

## Quy tắc an toàn

- phần trăm này chỉ là điểm gợi ý xếp hạng, không phải xác suất chẩn đoán đã được chứng minh
- không dùng câu như `AI chẩn đoán đúng 68%`
- luôn giữ disclaimer cho bác sĩ
- nếu context sai hoặc evidence rỗng thì flow phải fail-safe như hiện tại
- không dùng nhãn `Khớp với dữ liệu đã được kiểm chứng (%)` cho case chỉ còn fallback từ LLM

## Kế hoạch kiểm thử

### Backend

- unit test cho score normalization
- unit test cho top-3 truncation
- unit test cho low-evidence downgrade
- unit test cho response schema mới

### Frontend

- render test cho 3 differential cards
- test label tiếng Việt
- test trạng thái evidence yếu
- test danh sách lý do dài

### UAT

- ca có case memory mạnh
- ca cần vision
- ca evidence yếu
- ca mismatch context (`403`, `404`, `422`)

## Ví dụ đầu ra mong muốn

### Trường hợp có grounding nội bộ

- badge: `Đã đối chiếu dữ liệu nội bộ`
- `1. Viêm kết mạc hoặc nhiễm trùng mắt - 68% khớp với dữ liệu đã được kiểm chứng`
- `2. Loét giác mạc nghi ngờ - 22% khớp với dữ liệu đã được kiểm chứng`
- `3. Dị ứng hoặc kích ứng mắt - 10% khớp với dữ liệu đã được kiểm chứng`

### Trường hợp chỉ còn fallback từ LLM

- badge: `AI suy luận tham khảo - chưa có dữ liệu nội bộ đủ gần`
- `1. Viêm kết mạc hoặc nhiễm trùng mắt - 58% mức độ phù hợp theo triệu chứng`
- `2. Loét giác mạc nghi ngờ - 27% mức độ phù hợp theo triệu chứng`
- `3. Dị ứng hoặc kích ứng mắt - 15% mức độ phù hợp theo triệu chứng`

## Rủi ro

### 1. Người dùng hiểu nhầm phần trăm là xác suất y khoa

Giảm thiểu:

- dùng nhãn `Độ phù hợp`
- dùng nhãn `Khớp với dữ liệu đã được kiểm chứng`
- chỉ dùng nhãn này khi thực sự có grounding nội bộ
- đổi sang `Mức độ phù hợp theo triệu chứng` cho fallback LLM
- thêm disclaimer
- gắn kèm evidence và lý do

### 2. Case evidence yếu nhưng score vẫn nhìn quá chắc chắn

Giảm thiểu:

- thêm low-evidence downgrade
- thêm confidence note
- hạn chế wording quá mạnh

### 3. Frontend và backend không thống nhất contract

Giảm thiểu:

- định nghĩa schema rõ ràng
- snapshot test / response contract test

## Deliverables

- Response contract mới cho top 3 chẩn đoán
- Logic backend để tính và chuẩn hóa điểm
- Logic backend để xác định `internal_grounded` vs `llm_fallback`
- UI hiển thị top 3 chẩn đoán cùng phần trăm
- Documentation giải thích ý nghĩa phần trăm
- Test cho ranking, normalization và safe fallback

## Quyết định cần chốt

Chọn một trong các cách đặt nhãn sau:

- `Khớp với dữ liệu đã được kiểm chứng (%)` - dùng khi có grounding nội bộ
- `Mức độ phù hợp theo triệu chứng (%)` - dùng khi chỉ còn LLM fallback
- `Độ tin cậy (%)`
- `Độ chính xác (%)` - không khuyến nghị nếu chưa có calibration

## Canonical Contract (Implemented 2026-03-30)

Phần này là contract đang chạy thực tế, ưu tiên hơn các wording cũ ở các section phía trên.

### Request 1 - Analyze ban đầu (chưa chọn bệnh)

```json
{
  "pet_id": "pet-123",
  "booking_id": "booking-456",
  "species": "dog",
  "doctor_description": "Vùng da đỏ, rụng lông, chảy mủ",
  "symptoms": ["da đỏ", "ngứa", "chảy mủ"],
  "image_urls": ["https://..."],
  "image_analysis_mode": "full",
  "soap_draft": {
    "subjective": "...",
    "objective": "...",
    "assessment": "",
    "plan": ""
  }
}
```

### Request 2 - Analyze sau khi bác sĩ chọn 1 bệnh

```json
{
  "previous_request_id": "req-from-first-analyze",
  "synthesis_mode": "selected_only",
  "pet_id": "pet-123",
  "booking_id": "booking-456",
  "species": "dog",
  "doctor_description": "Vùng da đỏ, rụng lông, chảy mủ",
  "symptoms": ["da đỏ", "ngứa", "chảy mủ"],
  "image_urls": ["https://..."],
  "image_analysis_mode": "full",
  "selected_diagnosis_code": "pyoderma",
  "selected_diagnosis_label": "Viêm da do vi khuẩn (Pyoderma)",
  "soap_draft": {
    "subjective": "...",
    "objective": "...",
    "assessment": "Viêm da do vi khuẩn (Pyoderma)",
    "plan": ""
  }
}
```

`selected_only` là mode tối ưu token cho lượt 2:
- Không chạy lại retrieval/vision full pipeline.
- Reuse context từ request trước qua `previous_request_id`.
- Chỉ dựng nội dung theo chẩn đoán đã chọn (assessment/plan/prescription).

### Response chính

```json
{
  "evidence_mode": "internal_grounded",
  "evidence_banner": "Đã đối chiếu dữ liệu nội bộ",
  "score_label": "Độ tự tin (%)",
  "top_differentials": [
    {
      "canonical_code": "pyoderma",
      "display_name_vi": "Viêm da do vi khuẩn (Pyoderma)",
      "rank": 1,
      "score_percent": 38,
      "score_basis": "matching_internal",
      "confidence_note": "Độ tự tin: 38%",
      "supporting_reasons": ["..."]
    }
  ],
  "soap_suggestions": {
    "subjective_draft": "...",
    "objective_draft": "...",
    "assessment_draft": "",
    "plan_draft": ""
  }
}
```

### Rule hiển thị theo flow

- Analyze lần 1 (chưa chọn bệnh): hiển thị Top 3 + độ tự tin + Objective draft; không mở Assessment/Plan/Prescription draft.
- Analyze lần 2 (đã chọn bệnh): gọi mode `selected_only` để sinh Assessment/Plan/Prescription bám chẩn đoán đã chọn.
- Plan draft có bước lọc anti-generic: nếu nội dung chung chung hoặc không bám bệnh đã chọn thì fallback về plan nội bộ theo bệnh đã chọn.

### Ý nghĩa phần trăm

- `score_percent` là điểm tương đối trong Top 3 của cùng request (chuẩn hóa tổng = 100), không phải xác suất y khoa tuyệt đối.

## Token Optimization (Implemented)

### Trước tối ưu
- Lần 1: `full`
- Lần 2 sau khi chọn bệnh: `full` lại từ đầu

### Sau tối ưu
- Lần 1: `full`
- Lần 2 sau khi chọn bệnh: `selected_only`

### Tác động dự kiến
- Giảm token cho lượt 2 do không gọi lại full context building.
- Giảm độ trễ khi staff bấm "Chọn chẩn đoán này".
