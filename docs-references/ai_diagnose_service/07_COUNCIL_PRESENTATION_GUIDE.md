# Hướng Dẫn Trình Bày Hội Đồng - AI Diagnose

> Last Updated: 2026-04-16
> Scope: chẩn đoán AI cho staff, tổng hợp SOAP có grounding, Case Memory, an toàn runtime, và bộ câu hỏi thường gặp cho hội đồng

---

## 1. Mở đầu trong 1 phút

Thông điệp gợi ý:

"Petties AI Diagnose là tính năng hỗ trợ lâm sàng cho staff trong màn hình EMR. Hệ thống không thay thế bác sĩ. Hệ thống truy xuất bằng chứng nội bộ từ Knowledge Base và Case Memory được đồng bộ từ EMR đã xác nhận, sau đó tạo gợi ý SOAP có ràng buộc và gợi ý xử trí để tăng tốc độ lập bệnh án và giảm rủi ro." 

---

## 2. Bài toán hệ thống giải quyết

- Staff thường phải viết SOAP thủ công từ thông tin rời rạc.
- Khó nhớ lại ca bệnh tương tự một cách ổn định khi áp lực thời gian cao.
- Chất lượng lập kế hoạch xử trí phụ thuộc mạnh vào trí nhớ cá nhân.
- AI Diagnose biến dữ liệu rời rạc thành bản nháp SOAP có cấu trúc, nhanh hơn và đồng đều hơn.

---

## 3. Giá trị cốt lõi

### 3.1 Giá trị lâm sàng

- Gợi ý chẩn đoán phân biệt dựa trên bằng chứng nội bộ.
- Tạo nháp SOAP theo cấu trúc bác sĩ đã quen dùng.
- Tái sử dụng pattern từ EMR đã xác nhận cho ca lặp lại.
- Hỗ trợ chuẩn hóa chất lượng lập bệnh án và đề xuất xử trí.

### 3.2 Giá trị an toàn

- Giới hạn bằng chứng nội bộ (internal-only evidence boundary).
- Ràng buộc SOAP theo từng phần (Subjective, Objective, Assessment, Plan).
- Không hardcode quy tắc đơn thuốc theo tên bệnh.
- Quyết định cuối cùng thuộc về bác sĩ (chẩn đoán, SOAP, đơn thuốc).

---

## 4. Câu chuyện runtime để trình bày

### 4.1 Luồng phân tích đầy đủ

1. Bác sĩ/staff nhập mô tả, SOAP draft, và có thể kèm ảnh.
2. AI truy xuất KB, KG, và ca EMR đã xác nhận từ Case Memory.
3. Nếu cần, luồng vision phân tích ảnh.
4. Hệ thống tạo grounding bundle cho Subjective, Objective, Assessment, Plan.
5. LLM sinh SOAP draft có ràng buộc và danh sách chẩn đoán phân biệt.

### 4.2 Luồng selected_only

1. Bác sĩ chọn 1 chẩn đoán trong danh sách phân biệt.
2. AI tái sử dụng context đã grounding (cache).
3. Hệ thống ưu tiên protocol học từ EMR xác nhận cho chẩn đoán đã chọn.
4. Gợi ý plan và đơn thuốc tập trung hơn.

### 4.3 Vòng lặp học từ EMR xác nhận

1. Bác sĩ sửa EMR và lưu bản cuối.
2. Spring Boot đẩy EMR đã xác nhận sang AI service.
3. AI trích xuất metadata runtime và mapping canonical/alias.
4. Case được lưu vào Case Memory để truy xuất cho các lần sau.

---

## 5. Kiến trúc giải thích ngắn gọn

### 5.1 Đầu vào

- Mô tả lâm sàng của bác sĩ
- SOAP draft hiện tại
- Context thú cưng
- Ảnh lâm sàng (tùy chọn)

### 5.2 Nguồn bằng chứng nội bộ

- Knowledge Base
- Case Memory từ EMR đã xác nhận

### 5.3 Đầu ra

- Chẩn đoán phân biệt
- SOAP suggestions có ràng buộc
- Gợi ý protocol học được
- Các nhắc nhở safety

---

## 6. Vì sao Case Memory quan trọng

Case Memory không còn là bản sao đầy đủ của EMR.

Case Memory chỉ giữ các trường phục vụ runtime:

- `text_content`
- `species`
- `chief_complaint`
- `clinical_notes`
- `display_name_vi`
- `final_diagnosis_text`
- `canonical_code`
- `mapping_status`
- `exam_at`
- `protocol_pattern`

Cách này giúp hệ thống dễ giải thích hơn, dễ audit hơn, và sát nhu cầu vận hành thực tế.

---

## 7. Q&A cho hội đồng (gợi ý trả lời)

### Q1. AI có thay thế bác sĩ không?

**Trả lời:** Không. AI chỉ hỗ trợ tổng hợp thông tin và gợi ý. Bác sĩ vẫn chốt chẩn đoán, SOAP và đơn thuốc.

### Q2. Tại sao hệ thống đáng tin hơn chatbot thông thường?

**Trả lời:** Vì luồng chẩn đoán dựa trên bằng chứng nội bộ (KB, KG, Case Memory từ EMR xác nhận) và có ràng buộc output theo từng phần SOAP.

### Q3. Hệ thống giảm hallucination như thế nào?

**Trả lời:** Dùng grounding bundle và quy tắc SOAP theo section. Nếu thiếu bằng chứng, hệ thống trả về cách diễn đạt an toàn thay vì suy diễn vô căn cứ.

### Q4. Tại sao không dùng web search mở?

**Trả lời:** Trong ngữ cảnh cần sự ổn định và kiểm soát, chẩn đoán staff ưu tiên dữ liệu nội bộ để đảm bảo tính nhất quán và khả năng truy vết.

### Q5. Hệ thống học từ ca thực tế thế nào?

**Trả lời:** Chỉ EMR đã xác nhận mới được đồng bộ vào Case Memory. Mỗi ca xác nhận là đầu vào học hợp lệ cho truy xuất và tổng hợp lần sau.

### Q6. Có dùng quality penalty để hạ điểm ca EMR đã xác nhận không?

**Trả lời:** Không. Runtime retrieval đang dùng similarity và bằng chứng protocol. Ca đã xác nhận được xem là đầu vào hợp lệ.

### Q7. Nếu nhãn bệnh chưa map được thì sao?

**Trả lời:** Hệ thống thử autonomous canonicalization trước. Nếu confidence cao thì map hoặc tạo canonical mới; nếu confidence thấp thì giữ provisional để an toàn.

### Q8. Vì sao cần selected_only?

**Trả lời:** Để phù hợp workflow bác sĩ. Sau khi bác sĩ chọn chẩn đoán khả nghi, hệ thống tập trung hóa plan/thuốc dựa trên context đã grounding, không phải tính lại từ đầu.

### Q9. Bảo mật và riêng tư bệnh nhân được kiểm soát ra sao?

**Trả lời:** Case Memory chỉ giữ payload tối thiểu cho runtime, không mirror toàn bộ EMR gốc.

### Q10. Nếu bằng chứng yếu thì hệ thống phản hồi gì?

**Trả lời:** Hệ thống ưu tiên hướng bảo thủ (insufficient evidence/needs more data), không tạo kết luận vượt quá dữ liệu có sẵn.

### Q11. Sau schema cleanup, dữ liệu cũ đồng bộ lại thế nào?

**Trả lời:** Có luồng re-sync admin-only từ EMR confirmed để tái tạo Case Memory theo schema runtime hiện hành.

### Q12. Có cần admin duy trì alias thủ công mỗi ngày không?

**Trả lời:** Không. Mô hình vận hành hướng tới tự động canonicalization; admin tập trung monitor metrics và xử lý bất thường.

### Q13. Có cần thêm bảng mới để hỗ trợ canonicalization không?

**Trả lời:** Không bắt buộc. Thiết kế hiện tại tái sử dụng `disease_catalog` và `disease_aliases`.

### Q14. Đã có thể gọi là "tự học hoàn toàn" trong production chưa?

**Trả lời:** Đã tự động hóa ingestion + mapping/canonicalization có gate, nhưng vẫn trình bày trung thực là rollout có kiểm soát. Phần cần bổ sung là dashboard xu hướng dài hạn để chứng minh bằng số liệu.

### Q15. Nếu taxonomy baseline là tĩnh, vì sao hệ thống vẫn cải thiện?

**Trả lời:** Vì tăng trưởng runtime nằm ở DB catalog (`disease_catalog`, `disease_aliases`) sau khi đồng bộ EMR xác nhận, không phụ thuộc vào việc file taxonomy tăng kích thước.

### Q16. AI có thể tạo bệnh mới sai và làm bẩn dữ liệu không?

**Trả lời:** Có gate confidence + fallback provisional. Nếu confidence chưa đạt, hệ thống không ép tạo canonical mới.

### Q17. Nếu nhiều bác sĩ dùng cách viết khác nhau cho cùng một bệnh?

**Trả lời:** Lớp alias sẽ chuẩn hóa về 1 canonical code, giúp truy xuất và gợi ý ổn định dần theo thời gian.

### Q18. Làm sao đảm bảo không vỡ kiến trúc khi thêm logic học?

**Trả lời:** Vẫn giữ một pattern RAG: retrieve nội bộ -> LLM synthesis -> structured response. Logic học chỉ bổ sung metadata và mapping quality.

### Q19. Admin có được sửa bảng bệnh thủ công mỗi ngày không?

**Trả lời:** Không cần. Vai trò admin là monitor, review bất thường, và prune case memory khi cần.

### Q20. Làm sao chứng minh tiềm năng tương lai, không chỉ snapshot hiện tại?

**Trả lời:** Bằng bộ KPI định kỳ trên holdout benchmark cố định, báo cáo trend mapped/provisional, và tác động đến tốc độ + mức chấp nhận của bác sĩ.

---

## 8. Các quan ngại thường gặp và giảm thiểu

| Quan ngại | Vấn đề | Cách giảm thiểu |
|---|---|---|
| Hallucinated SOAP | LLM có thể suy diễn quá mức | Grounding bundle, section constraints, internal-only evidence |
| Gợi ý đơn thuốc sai | Gợi ý AI khác với phác đồ bác sĩ | Bác sĩ review cuối, safety checks, học protocol từ EMR confirmed |
| Mapping quality yếu | Nhãn bệnh EMR không đồng nhất | catalog + alias mapping + provisional fallback |
| Lệ thuộc admin hàng ngày | CRUD thủ công không scale | autonomous canonicalization |
| Payload case memory quá nhiều | Khó giải thích runtime | runtime-only schema |
| Ảnh không phù hợp | Ảnh không phải clue chính | vision optional, fallback text-first |
| Mất cache selected_only | Cache hết hạn | safe fallback, không hỏng workflow |

### Edge cases cần nêu rõ khi phản biện

| Edge case | Có thể xảy ra | Hành vi hiện tại | Bước hardening tiếp theo |
|---|---|---|---|
| Nhãn bệnh mới confidence sát ngưỡng | Không chắc map hay create | fallback provisional | cảnh báo cụm provisional lặp lại |
| EMR thiếu SOAP trường trọng yếu | bằng chứng retrieval yếu | output bảo thủ + gợi ý bổ sung | điểm đánh giá EMR completeness trước sync |
| Tín hiệu mâu thuẫn giữa nguồn | KB và case memory khác hướng | giữ differential + confidence note | UI diagnostics cho disagreement |
| 1 phòng khám đổi thuật ngữ đột ngột | nguy cơ bùng nổ alias | alias normalization + guardrails | anomaly monitor theo clinic |
| Sync EMR trùng lặp | duplicate case | dedup threshold khi upsert | idempotency audit dashboard |
| Protocol pattern cũ | gợi ý điều trị lỗi thời | selected-only vẫn để bác sĩ chốt cuối | freshness scoring theo độ mới |
| Tải hệ thống tăng đột biến | tăng latency retrieval/sync | async pipeline + graceful fallback | queue backpressure + SLO dashboard |

---

## 9. Trình tự demo khuyến nghị

1. Mở trang EMR.
2. Nhập mô tả lâm sàng ngắn.
3. Chạy full analysis.
4. Trình bày differential + SOAP draft có grounding.
5. Chọn 1 chẩn đoán.
6. Trình bày selected_only giúp tập trung plan.
7. Lưu EMR.
8. Giải thích cách EMR xác nhận được đưa vào Case Memory cho lần sau.

---

## 10. Phương án dự phòng nếu demo gặp sự cố

- Nếu bước image lỗi: tiếp tục với text-only grounded retrieval và nêu rõ vision là optional.
- Nếu selected_only mất cache: nêu rõ hệ thống fallback an toàn về runtime thông thường.
- Nếu ca bệnh chưa có protocol học được: nêu rõ hệ thống fallback grounded drafting, không giả lập bằng chứng.

---

## 11. Câu chốt kết bài trình bày

"Giá trị cốt lõi của Petties AI Diagnose không nằm ở sinh nội dung tự do, mà nằm ở pipeline hỗ trợ lâm sàng có kiểm soát: biến bằng chứng nội bộ và kinh nghiệm EMR đã xác nhận thành gợi ý SOAP có grounding, trong khi vẫn giữ quyền quyết định cho bác sĩ và giới hạn an toàn rõ ràng." 

---

## 12. Bộ bằng chứng để chứng minh cải thiện dài hạn

### 12.1 KPI tối thiểu (báo cáo theo tháng)

- `mapped_rate` (tỉ lệ EMR confirmed map được canonical)
- `provisional_rate` (kỳ vọng giảm dần)
- `catalog_growth` (số canonical mới)
- `alias_growth` (độ phủ đồng nghĩa)
- `retrieval_hit_rate@k` (độ liên quan case memory)
- `doctor_edit_distance` (khoảng cách AI SOAP draft -> SOAP cuối)

### 12.2 KPI chấp nhận và an toàn

- `% gợi ý được bác sĩ chấp nhận`
- `% đơn thuốc cần sửa lớn`
- `% lượt chạy thiếu input quan trọng`
- `% phiên fallback bảo thủ` (insufficient evidence)

### 12.3 Cách khẳng định "càng nhiều EMR càng tốt"

Không khẳng định bằng cảm tính, chỉ khẳng định bằng phép đo lặp lại:

1. Cố định bộ holdout EMR benchmark (không đưa vào học).
2. Đánh giá định kỳ hàng tháng cùng một protocol.
3. Vẽ trend mapped/provisional và top-k agreement.
4. Đối chiếu xu hướng với catalog+alias growth từ EMR confirmed sync.
5. Công bố delta và confidence interval trong governance review.

### 12.4 Tuyên bố governance

"Autonomous learning được kích hoạt, nhưng mọi tuyên bố về tiến bộ chỉ được chấp nhận khi KPI trend cải thiện trên bộ holdout cố định và chỉ số an toàn lâm sàng không xấu đi." 
