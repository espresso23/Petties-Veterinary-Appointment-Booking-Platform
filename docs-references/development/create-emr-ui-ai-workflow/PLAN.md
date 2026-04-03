# Kế hoạch chỉnh sửa giao diện CreateEmrPage theo workflow lâm sàng có AI hỗ trợ

Last Updated: 2026-03-30

## Problem Statement

`CreateEmrPage` hiện tại đang đi theo cấu trúc lai giữa:

- biểu mẫu SOAP truyền thống
- panel AI hỗ trợ đặt ở sidebar riêng
- các thẻ gợi ý AI dạng inline cho từng trường

Điều này dẫn đến một số vấn đề về trải nghiệm:

- giao diện chưa phản ánh đúng workflow thực tế tại phòng khám
- phần AI Diagnose tạo cảm giác như một công cụ tách rời hoặc gần với mô hình hỏi - đáp
- dữ liệu đầu vào phục vụ chẩn đoán chưa được sắp theo thứ tự lâm sàng tự nhiên
- `Hình ảnh lâm sàng` và `Chỉ số sinh tồn` chưa nằm ngay sau `Triệu chứng`, trong khi đây là các đầu vào rất quan trọng cho AI chẩn đoán
- `Hình ảnh lâm sàng` chưa được đặt đủ gần `Chẩn đoán`, làm giảm khả năng quan sát và đối chiếu nhanh của bác sĩ
- các nhãn `Subjective`, `Assessment`, `Plan` chưa bám sát cách staff/bác sĩ thao tác nhanh trong một ca khám thực tế

Ngoài ra, mục tiêu sản phẩm hiện tại là:

- không thiết kế AI Diagnose theo kiểu chatbot hỏi - đáp
- AI chỉ đóng vai trò hỗ trợ ra quyết định lâm sàng
- bác sĩ nhập thông tin trước, sau đó bấm đúng một nút `AI chẩn đoán`
- AI phân tích toàn bộ dữ liệu đã nhập và trả về các chẩn đoán khả thi cùng nhận định
- không còn block `Chat AI bệnh án` hoặc panel `Hỗ trợ AI chẩn đoán` riêng trên màn hình

## Expected Behavior

Trang `CreateEmrPage` sau khi chỉnh sửa cần hỗ trợ hai flow rõ ràng trên cùng một màn hình:

### 1. Flow thường

Bác sĩ vẫn có thể tạo bệnh án hoàn toàn thủ công theo giao diện mới, không bị phụ thuộc vào AI.

### 2. Flow AI hỗ trợ cho phòng khám có gói VIP

Bác sĩ nhập dữ liệu ca bệnh, sau đó bấm đúng một nút:

- `AI chẩn đoán`

Sau cú bấm này, AI sẽ:

- đọc `Triệu chứng`
- đọc `Hình ảnh lâm sàng`
- đọc `Chỉ số sinh tồn`
- phân tích tổng hợp
- trả về `Top 3 chẩn đoán khả thi`
- hiển thị nhận định / đánh giá ngắn cho ca bệnh

Tiếp theo:

- bác sĩ chọn 1 chẩn đoán phù hợp nhất
- hệ thống mới chuyển sang bước gợi ý đơn thuốc
- bác sĩ chỉnh tay đơn thuốc nếu cần rồi lưu bệnh án

Về vị trí hiển thị:

- nút `AI chẩn đoán` nằm ngay trong block `Triệu chứng`
- kết quả AI hiển thị inline ngay sau block `Triệu chứng`
- không tạo panel AI riêng ở sidebar

### 3. Step flow tinh gọn

Toàn bộ màn hình nên hoàn thành trong 3 bước ngắn, tránh kéo quá dài:

1. `Triệu chứng và ảnh lâm sàng`
2. `Chẩn đoán và khách quan`
3. `Điều trị và hoàn tất`

Step tracker cần hiển thị theo chiều ngang, giống timeline thao tác, với trạng thái active/done/pending rõ ràng.

## Scope

### In Scope

- chỉnh sửa layout và wording của `CreateEmrPage`
- sắp xếp lại các khối giao diện theo workflow lâm sàng
- đổi vai trò hiển thị của AI Diagnose trong UI
- chuẩn hóa luồng tương tác để AI là một hành động `one-click analysis`
- tổ chức `CreateEmrPage` theo step flow 3 bước
- giữ khả năng tạo EMR thủ công khi không dùng AI
- cập nhật plan và documentation liên quan đến UI flow
- bỏ block `Chat AI bệnh án` và block/panel `Hỗ trợ AI chẩn đoán` riêng khỏi `CreateEmrPage`

### Out of Scope

- không thay đổi database schema
- không thay đổi entity hoặc migration
- không thay đổi contract backend bắt buộc cho EMR lưu trữ ở giai đoạn này
- không thiết kế lại AI thành chatbot hoặc conversational diagnosis flow
- không thêm form xét nghiệm có cấu trúc DB-level trong giai đoạn đầu

## DB Impact Confirmation

Kế hoạch này là **UI-only**.

Điều đó có nghĩa là:

- không tạo migration mới
- không thêm cột, bảng, enum hoặc quan hệ mới
- không thay đổi cấu trúc `CreateEmrRequest` bắt buộc ở backend trong giai đoạn này
- không thay đổi schema lưu EMR ở Spring Boot hoặc AI Service

Nếu giao diện mới cần thêm trạng thái tạm như:

- chẩn đoán AI đang được chọn
- badge nguồn suy luận
- trạng thái đã bấm `AI chẩn đoán`

thì các giá trị này chỉ tồn tại ở tầng UI state hoặc mapping payload tạm thời ở frontend, chưa phải dữ liệu cần lưu DB.

## Relevant Code Areas

- `petties-web/src/pages/staff/emr/CreateEmrPage.tsx`
- `petties-web/src/components/emr/AIDiagnosisPanel.tsx`
- `petties-web/src/components/emr/AISuggestionInlineCard.tsx`
- `petties-web/src/services/agentService.ts`
- `petties-web/src/services/emrService.ts`
- `docs-references/documentation/AI_DIAGNOSIS_RUNTIME_FLOW_VI.md`
- `docs-references/development/ai-diagnose-top3-differentials/PLAN.md`

## Current Gaps

### 1. Cấu trúc giao diện chưa đi theo workflow khám bệnh tự nhiên

Hiện tại các khối đang phân tán theo 3 cột với trọng tâm chưa rõ ràng. Đặc biệt:

- `Hình ảnh lâm sàng` nằm khá xa khỏi `Triệu chứng`
- `Chỉ số sinh tồn / Objective` nằm ở cột phải thay vì theo ngay sau dữ liệu triệu chứng
- `Hình ảnh lâm sàng` chưa nằm cạnh `Chẩn đoán` để hỗ trợ đối chiếu trực quan
- AI panel là một cột riêng, tạo cảm giác độc lập khỏi form chính

### 2. Ngôn ngữ giao diện chưa phù hợp hoàn toàn với thao tác phòng khám

Các nhãn hiện tại như:

- `S - Chủ quan`
- `A - Đánh giá`
- `P - Kế hoạch`

không tối ưu cho mục tiêu thao tác nhanh và rõ của staff khi cần nhập thông tin để AI chẩn đoán.

Ngoài ra, cách tách `Đơn thuốc` ra xa `Plan` cũng chưa phản ánh tốt luồng điều trị thực tế sau khi bác sĩ chốt chẩn đoán.

### 3. Vai trò của AI chưa được mô hình hóa đúng

AI Diagnose hiện có nguy cơ bị nhìn như:

- một panel hỏi - đáp
- một khu vực gợi ý rời rạc
- một phần bổ sung bên lề

Trong khi vai trò đúng mong muốn là:

- bác sĩ nhập dữ liệu ca bệnh
- bấm một nút `AI chẩn đoán`
- nhận kết quả phân tích lâm sàng để hỗ trợ ra quyết định

### 4. Chưa tách rõ hai chế độ dùng AI và không dùng AI

Trang hiện tại chưa thể hiện rõ rằng:

- bác sĩ có thể nhập và lưu thủ công nếu không dùng AI
- AI chỉ là lớp hỗ trợ bổ sung, không chiếm quyền điều khiển luồng nhập EMR

## UX Principles

Thiết kế mới cần tuân theo các nguyên tắc sau:

- `Clinical-first`: đi theo quy trình khám bệnh, không đi theo logic kỹ thuật của hệ thống
- `AI as assistant, not chat`: AI là nút hỗ trợ phân tích, không phải chatbot
- `Minimal disruption`: bác sĩ vẫn dùng form chính, AI chỉ thêm đúng lúc cần
- `Manual override always available`: bác sĩ luôn có thể bỏ qua AI hoặc chỉnh tay toàn bộ
- `No schema pressure`: UI mới không ép thay đổi database ở giai đoạn này
- `Short flow`: toàn bộ quá trình tạo EMR chỉ nên cần 2-3 bước thao tác lớn

## Proposed Information Architecture

### Phiên bản không dùng AI

1. Thông tin thú cưng
2. Tóm tắt bệnh án gần đây / bệnh sử
3. Bước 1: Triệu chứng và ảnh lâm sàng
4. Bước 2: Chẩn đoán và khách quan
5. Bước 3: Kế hoạch điều trị, đơn thuốc, ghi chú, hẹn tái khám

### Phiên bản có AI

1. Thông tin thú cưng
2. Tóm tắt bệnh án gần đây / bệnh sử
3. Bước 1: Triệu chứng + Ảnh lâm sàng + nút `AI chẩn đoán` nếu clinic có VIP
4. Bước 2: Kết quả AI, Chẩn đoán được chọn / tự nhập, Khách quan
5. Bước 3: Kế hoạch điều trị, Đơn thuốc gợi ý / chỉnh tay, Ghi chú, Hẹn tái khám

## Target UI Structure

### Nhóm dữ liệu đầu vào chẩn đoán

Đây là nhóm cần gom lại liên tiếp và đặt ở trọng tâm trang:

- `Triệu chứng`
- `AI chẩn đoán` (nút inline)
- `Kết quả AI chẩn đoán`
- `Hình ảnh lâm sàng`
- `Chẩn đoán`
- `Chỉ số sinh tồn và khám lâm sàng`

Lý do:

- đây là 3 nguồn dữ liệu trực tiếp mà AI chẩn đoán cần dùng
- bác sĩ dễ hiểu hơn vì mọi đầu vào chẩn đoán nằm cùng một cụm
- giao diện không bị chia cắt giữa cột giữa và cột phải như hiện tại
- `Hình ảnh lâm sàng` và `Chẩn đoán` được đặt gần nhau để bác sĩ dễ đối chiếu trực quan

### Khối AI hỗ trợ

Không dùng cấu trúc chat và không có panel riêng. Chỉ có:

- 1 nút `AI chẩn đoán` nằm ngay trong block `Triệu chứng`
- 1 khối kết quả hiển thị inline ngay sau `Triệu chứng`

Khối kết quả gồm:

- trạng thái nguồn suy luận
- 3 chẩn đoán khả thi nhất
- phần trăm theo quy tắc hiển thị đã chốt
- nhận định / đánh giá ngắn cho ca bệnh
- hành động `Chọn chẩn đoán này`

### Khối chẩn đoán

Khối này trở thành nơi hiển thị:

- chẩn đoán bác sĩ tự nhập thủ công nếu không dùng AI
- hoặc chẩn đoán bác sĩ chọn từ kết quả AI

### Khối kế hoạch điều trị và đơn thuốc

Khối này gồm 2 phần gần nhau nhưng không gộp nhãn thành một:

- `Kế hoạch điều trị`
- `Đơn thuốc`

Trong đó phần đơn thuốc vẫn cho chỉnh tay như hiện tại, nhưng khi có AI thì bổ sung:

- nút sinh / nhận đơn thuốc gợi ý theo chẩn đoán đã chọn

## Terminology Changes

Đề xuất đổi wording giao diện như sau:

| Cũ | Mới |
|---|---|
| `S - Chủ quan` | `Triệu chứng` |
| `O - Khách quan` | `Chỉ số sinh tồn và khám lâm sàng` |
| `A - Đánh giá` | `Chẩn đoán` |
| `P - Kế hoạch` | `Kế hoạch điều trị` |

Lưu ý:

- không xóa hoàn toàn ý nghĩa SOAP ở mức dữ liệu nội bộ nếu backend vẫn cần
- nhưng UI cho staff cần dùng ngôn ngữ thực tế phòng khám hơn là thuật ngữ kỹ thuật SOAP

## Proposed Interaction Model

### Trường hợp không dùng AI

1. Staff nhập dữ liệu bình thường
2. Staff tự điền `Chẩn đoán`
3. Staff tự kê `Đơn thuốc`
4. Lưu bệnh án

### Trường hợp dùng AI

1. Staff nhập `Triệu chứng`
2. Staff bấm `AI chẩn đoán` ngay trong block `Triệu chứng`
3. AI trả `Top 3 chẩn đoán khả thi + nhận định` ngay dưới `Triệu chứng`
4. Staff đối chiếu thêm `Hình ảnh lâm sàng`
5. Staff chọn `1 chẩn đoán`
6. Staff bổ sung / rà lại `Khách quan`
7. Hệ thống mở / cập nhật khối `Plan + Đơn thuốc` gợi ý
8. Staff chỉnh tay và lưu bệnh án

## Wireframe Direction

### Phiên bản chung

- vẫn là cùng một form
- có step tracker 3 bước ở đầu phần nhập liệu
- step tracker hiển thị theo chiều ngang, có connector như timeline thao tác
- có action bar cố định ở trên cùng chứa `Quay lại`, `Tiếp theo`, `Lưu và tiếp tục`
- clinic thường không thấy nút `AI chẩn đoán`
- clinic VIP thấy nút `AI chẩn đoán` ở bước 1
- kết quả AI hiển thị inline, không dùng panel chat hoặc sidebar AI riêng
- trạng thái `AI đang đọc ảnh` hiển thị ngay trong block `Hình ảnh lâm sàng`

### Wireframe ASCII định hướng nhanh

```text
+--------------------------------------------------------------------------------------+
| TẠO BỆNH ÁN                                                                          |
| Bé: Mimi | Mèo Anh lông ngắn | 3 tuổi | 4.2 kg | Booking #BK001                     |
+--------------------------------------------------------------------------------------+

+----------------------------------+---------------------------------------------------+
| THÔNG TIN THÚ CƯNG               | BỆNH SỬ GẦN ĐÂY                                  |
| - Tên                            | - Lần khám gần nhất                              |
| - Giống                          | - Chẩn đoán gần đây                              |
| - Giới tính                      | - Điều trị gần đây                               |
| - Tuổi                           | - Xem chi tiết                                   |
| - Cân nặng                       |                                                   |
| - Dị ứng / lưu ý                 |                                                   |
+----------------------------------+---------------------------------------------------+

+--------------------------------------------------------------------------------------+
| TRIỆU CHỨNG                                                                   |
| [ textarea nhập triệu chứng theo lời chủ nuôi / bác sĩ ghi nhận ]                   |
|                                                                                      |
|                                                        [ AI CHẨN ĐOÁN ]             |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| KẾT QUẢ AI CHẨN ĐOÁN (chỉ hiện sau khi bấm)                                         |
| Badge: Đã đối chiếu dữ liệu nội bộ / AI suy luận tham khảo                          |
| 1. Chẩn đoán khả thi #1 ... [ Chọn chẩn đoán này ]                                  |
| 2. Chẩn đoán khả thi #2 ... [ Chọn chẩn đoán này ]                                  |
| 3. Chẩn đoán khả thi #3 ... [ Chọn chẩn đoán này ]                                  |
| Nhận định AI cho ca bệnh: [ đoạn nhận định ngắn ]                                   |
+--------------------------------------------------------------------------------------+

+---------------------------------------------+----------------------------------------+
| HÌNH ẢNH LÂM SÀNG                           | CHẨN ĐOÁN                              |
| [ Upload ảnh ]                              | [ chẩn đoán bác sĩ tự nhập ]           |
| [ Ảnh 1 ] [ Ảnh 2 ] [ Ảnh 3 ]               | hoặc                                   |
| [ mô tả ảnh ]                               | [ chẩn đoán đã chọn từ AI ]            |
+---------------------------------------------+----------------------------------------+

+--------------------------------------------------------------------------------------+
| KHÁCH QUAN / CHỈ SỐ SINH TỒN                                                         |
| Nhiệt độ | Nhịp tim | BCS | Cân nặng                                                 |
| [ textarea khám lâm sàng / khách quan ]                                              |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| PLAN + ĐƠN THUỐC                                                                     |
| [ textarea kế hoạch điều trị / theo dõi ]                                            |
| [ Sinh đơn thuốc gợi ý ]   [ Kê đơn ngay ]                                           |
| Danh sách thuốc đã chọn                                                              |
+--------------------------------------------------------------------------------------+

+--------------------------------------------------------------------------------------+
| GHI CHÚ VÀ HẸN TÁI KHÁM                                                              |
| [ ghi chú ]                                                                          |
| [ toggle hẹn tái khám ]                                                              |
+--------------------------------------------------------------------------------------+

                                                         [ LƯU BỆNH ÁN ]
```

## Component-Level Mapping

### `CreateEmrPage.tsx`

Sẽ là file chịu thay đổi chính về:

- layout tổng
- thứ tự khối
- nhãn hiển thị
- vị trí của nút `AI chẩn đoán` trong block `Triệu chứng`
- vị trí render kết quả AI inline ngay sau `Triệu chứng`
- vị trí tương quan giữa `Hình ảnh lâm sàng`, `Chẩn đoán`, `Khách quan`
- gộp tương quan `Plan + Đơn thuốc`

### `AIDiagnosisPanel.tsx`

Cần được refactor về vai trò UI:

- từ panel sidebar sang logic/kết quả inline trong form
- bỏ cảm giác conversation-driven
- tập trung vào:
  - nút phân tích
  - trạng thái phân tích
  - top 3 chẩn đoán
  - chọn chẩn đoán

### `AISuggestionInlineCard.tsx`

Cần đánh giá lại mức độ sử dụng:

- có thể giữ ở một vài vị trí nếu thật sự hữu ích
- nhưng không nên làm giao diện mang cảm giác AI đang chat để điền từng trường
- nhiều khả năng cần giảm vai trò hoặc thay bằng UI action rõ ràng hơn

## Payload Strategy

Mục tiêu của phần này là mô tả rõ: UI thay đổi nhưng payload gửi đi vẫn bám trên contract hiện có, tránh kéo theo thay đổi database.

### 1. Payload gửi cho AI Diagnose

Khi bác sĩ bấm `AI chẩn đoán`, frontend sẽ thu thập dữ liệu từ giao diện mới nhưng map về payload AI đang có.

Nguồn dữ liệu UI:

- `Triệu chứng`
- `Hình ảnh lâm sàng`
- `Chỉ số sinh tồn và khám lâm sàng`
- thông tin thú cưng hiện có như `species`, `breed`, `weight`, `allergies`

Mapping đề xuất:

```json
{
  "pet_id": "petInfo.id",
  "booking_id": "bookingId",
  "species": "petInfo.species",
  "breed": "petInfo.breed",
  "age_months": "estimateAgeMonths()",
  "weight_kg": "getNormalizedWeightKg()",
  "allergies": ["..."],
  "doctor_description": "triệu chứng / mô tả ca bệnh chính",
  "symptoms": ["tách từ ô Triệu chứng nếu có"],
  "image_urls": ["uploadedImages", "pendingPreviewUrls nếu flow preview cho phép"],
  "objective": "khối khám lâm sàng và chỉ số sinh tồn",
  "subjective": "nội dung triệu chứng",
  "assessment": "có thể để rỗng trước khi chọn chẩn đoán",
  "plan": "có thể để rỗng trước khi sinh đơn thuốc"
}
```

Lưu ý:

- payload trên là mapping UI-level, không phải thay đổi schema backend mới
- `doctor_description`, `symptoms`, `subjective`, `objective` có thể cùng xuất phát từ UI mới nhưng được gán vào các field cũ để tương thích contract hiện tại

### 2. Payload lưu EMR

Khi bấm `Lưu bệnh án`, giao diện mới vẫn map về `CreateEmrRequest` hiện tại.

Mapping đề xuất:

| UI mới | Payload hiện tại |
|---|---|
| `Triệu chứng` | `subjective` |
| `Khám lâm sàng và chỉ số sinh tồn` | `objective` |
| `Chẩn đoán` | `assessment` |
| `Đơn thuốc` / ghi chú điều trị | `plan` và `prescriptions` |
| `Ghi chú thêm` | `notes` |
| `Hình ảnh lâm sàng` | `images` |
| `Cân nặng` | `weightKg` |
| `Nhiệt độ` | `temperatureC` |
| `Nhịp tim` | `heartRate` |
| `BCS` | `bcs` |
| `Ngày tái khám` | `reExaminationDate` |

Ví dụ payload lưu EMR sau khi map:

```json
{
  "petId": "petId",
  "bookingId": "bookingId",
  "subjective": "Triệu chứng bác sĩ đã nhập",
  "objective": "Khám lâm sàng và chỉ số sinh tồn",
  "assessment": "Chẩn đoán bác sĩ chọn hoặc tự nhập",
  "plan": "Kế hoạch điều trị hoặc ghi chú điều trị",
  "notes": "Ghi chú thêm",
  "weightKg": 4.2,
  "temperatureC": 38.7,
  "heartRate": 120,
  "bcs": 5,
  "prescriptions": [],
  "images": [],
  "reExaminationDate": "2026-04-05T00:00:00",
  "examinationDate": "generated at submit time"
}
```

### 3. UI-only state không lưu DB

Các state sau chỉ phục vụ giao diện và trải nghiệm tương tác, không cần lưu DB ở giai đoạn này:

- `hasAiAnalysisResult`
- `selectedAiDiagnosisIndex`
- `selectedAiDiagnosisLabel`
- `aiEvidenceMode`
- `aiEvidenceBanner`
- `showAiPrescriptionDraft`

Các state này có thể nằm trong `CreateEmrPage.tsx` hoặc tách ra thành local view-model/state hook nếu cần.

## Implementation Plan

### Phase 1. Chốt cấu trúc UX mới cho Create EMR

Thống nhất cấu trúc màn hình theo workflow:

- Thông tin thú cưng
- Bệnh sử gần đây
- Bước 1: Triệu chứng và ảnh lâm sàng
- Bước 2: Chẩn đoán và khách quan
- Bước 3: Kế hoạch điều trị, đơn thuốc, ghi chú, hẹn tái khám

### Phase 2. Refactor layout của `CreateEmrPage`

Sắp xếp lại các block hiện có trong `CreateEmrPage.tsx`:

- đưa nút `AI chẩn đoán` vào ngay block `Triệu chứng`
- render kết quả AI inline ngay dưới `Triệu chứng`
- đặt `Hình ảnh lâm sàng` trong bước 1
- đưa `Khách quan` vào bước 2 cùng `Chẩn đoán`
- đặt `Đơn thuốc` đi cùng bước 3 với `Kế hoạch điều trị`
- tránh phân mảnh dữ liệu chẩn đoán giữa nhiều cột khác nhau

### Phase 3. Đổi wording UI theo nghiệp vụ phòng khám

Thay các nhãn SOAP-facing bằng nhãn dễ thao tác hơn:

- `Triệu chứng`
- `Chỉ số sinh tồn và khám lâm sàng`
- `Chẩn đoán`
- `Đơn thuốc`

### Phase 4. Biến AI thành one-click clinical support

Ở mức UI:

- chỉ hiển thị một nút `AI chẩn đoán`
- nút này nằm ngay trong phần `Triệu chứng`
- không thiết kế UI như chat panel
- không tạo block `Hỗ trợ AI chẩn đoán` riêng
- không giữ block `Chat AI bệnh án`
- kết quả AI hiện ngay dưới nút phân tích trong một khối kết quả lâm sàng

### Phase 5. Thiết kế trạng thái có AI và không có AI trên cùng một form

Yêu cầu:

- nếu chưa bấm AI thì form vẫn dùng bình thường
- nếu clinic không có VIP thì ẩn nút `AI chẩn đoán`
- nếu có kết quả AI thì mở thêm khối kết quả ngay trong bước 1
- bác sĩ luôn có thể tự nhập chẩn đoán, kể cả khi bỏ qua AI

### Phase 6. Chỉnh lại luồng chẩn đoán và đơn thuốc trong UI

Luồng đích:

- AI đề xuất 3 chẩn đoán khả thi
- bác sĩ chọn 1 chẩn đoán
- sau đó mới áp dụng hoặc sinh đơn thuốc gợi ý

Lưu ý: giai đoạn này có thể mới chỉ cần UI placeholder / structure nếu backend contract chưa hoàn tất đầy đủ.

### Phase 7. Làm sạch dấu vết chatbot trong AI Diagnose UI

Không dùng wording hoặc pattern kiểu:

- hỏi AI
- chat với AI
- tin nhắn / hội thoại
- prompt-response theo kiểu trợ lý chat

Thay bằng wording clinical support:

- `AI chẩn đoán`
- `Kết quả phân tích`
- `Chọn chẩn đoán này`
- `Đơn thuốc gợi ý`

Đồng thời loại bỏ hoàn toàn khỏi `CreateEmrPage`:

- block `Chat AI bệnh án`
- block/panel `Hỗ trợ AI chẩn đoán` riêng

### Phase 8. Kiểm thử hiển thị và luồng thao tác

Kiểm tra:

- desktop layout
- responsive mobile / tablet
- trường hợp không dùng AI
- trường hợp có AI nhưng chưa có kết quả
- trường hợp AI có top 3 chẩn đoán
- trường hợp AI fallback / ít evidence
- trường hợp bác sĩ chỉnh tay hoàn toàn

## No-DB Rule for This Plan

Kế hoạch này chỉ sửa UI và flow hiển thị:

- không thêm field DB
- không sửa migration
- không sửa entity
- không thay đổi schema lưu EMR ở tầng database

Nếu cần map dữ liệu mới vào các field cũ trong payload hiện tại, sẽ thực hiện ở tầng UI / state mapping trước.

### 4. Payload tinh chỉnh theo chẩn đoán đã chọn

Khi bác sĩ chọn một chẩn đoán trong Top 3, frontend gửi lại request AI kèm:

- `selected_diagnosis_code`
- `selected_diagnosis_label`

Mục tiêu là để backend sinh lại `soap_suggestions` và `prescription_suggestions` theo đúng bệnh đã chọn, bảo đảm nội dung thống nhất và giảm gợi ý chung chung.

## Suggested Deliverables

- wireframe desktop cho `CreateEmrPage` mới
- wireframe mobile/tablet rút gọn
- UI layout mới trong `CreateEmrPage.tsx`
- AI interaction mới theo kiểu one-click analysis ngay trong block `Triệu chứng`
- wording mới cho các section lâm sàng
- tài liệu plan và ghi chú hành vi khi có / không có AI

## Risks

### 1. UI mới nhưng contract backend chưa hoàn toàn khớp

Mitigation:

- giữ thay đổi ở mức UI/state mapping trước
- không ép thay đổi DB

### 2. Người dùng cũ quen với SOAP wording

Mitigation:

- dùng ngôn ngữ phòng khám nhưng vẫn có thể giữ mapping nội bộ với SOAP nếu cần

### 3. AI section vẫn bị hiểu là chat

Mitigation:

- chỉ giữ một nút `AI chẩn đoán`
- bỏ các pattern hội thoại không cần thiết
- hiển thị kết quả theo dạng decision support card

## Testing Plan

### UI/UX

- kiểm tra thứ tự các khối dữ liệu có đúng workflow lâm sàng không
- kiểm tra `Hình ảnh` và `Chỉ số sinh tồn` đã nằm ngay dưới `Triệu chứng`
- kiểm tra bác sĩ có thể hoàn thành EMR mà không cần dùng AI
- kiểm tra khi bấm `AI chẩn đoán`, kết quả hiện đúng vị trí và không phá flow nhập form

### Functional

- lưu bệnh án thủ công không dùng AI
- nhận kết quả AI và chọn chẩn đoán
- áp dụng đơn thuốc gợi ý từ AI nếu có
- chỉnh tay đơn thuốc sau khi có gợi ý AI

### Responsive

- kiểm tra trên desktop
- kiểm tra trên laptop nhỏ
- kiểm tra trên tablet

## Open Decisions Already Clarified

- AI Diagnose không được thiết kế như chatbot hỏi - đáp
- AI chỉ là lớp hỗ trợ phân tích sau khi bác sĩ nhập dữ liệu
- khi có AI thì chỉ cần thêm một nút `AI chẩn đoán`
- không còn block `Chat AI bệnh án` và panel `Hỗ trợ AI chẩn đoán` riêng
- giao diện phải hỗ trợ cả hai trường hợp: có AI và không có AI

## Expanded Scope: Edit/View (Web) & Mobile EMR

### Edit/View EMR (Web React)
Layout 3 cột (Horizontal Layout) định hướng lâm sàng sẽ được duy trì nhất quán cho cả màn hình Sửa (`EditEmrPage`) và Xem (`ViewEmrPage`):
- **View EMR:** Cấu trúc 3 cột không đổi. Các ô Input trở thành text tĩnh (Read-only). Ẩn nút "AI CHẨN ĐOÁN" và "LƯU BỆNH ÁN". Thẻ kết quả phân tích AI (nếu bệnh án này đã dùng AI lúc tạo) sẽ hiển thị cố định nổi bật ở Cột 3.
- **Edit EMR:** Giữ nguyên giao diện tương tác như lúc Create, form tự động điền (pre-fill) dữ liệu cũ. Bác sĩ vẫn hoàn toàn có thể thay đổi dữ liệu lâm sàng và bấm "AI CHẨN ĐOÁN" lại để xin phân tích mới nhất.

### Mobile EMR (Flutter)
Do màn hình điện thoại hẹp, không thể chia 3 cột ngang. Quy tắc thiết kế cho ứng dụng Mobile của Petties là **Trải dọc (Vertical Stacking)** nhưng bắt buộc phải giữ đúng luồng workflow (Context -> Input -> Outcome):
1. **Khối 1 (Thông tin nền):** Nằm trên cùng, nên thiết kế dạng Accordion thu gọn để tiết kiệm diện tích.
2. **Khối 2 (Dữ liệu Lâm sàng):** Các form nhập Triệu chứng, Hình ảnh, Chỉ số cuộn dọc. Dưới cùng khối này là Nút "AI CHẨN ĐOÁN" to, màu Amber, tràn viền (Full-width). Nút này đóng vai trò như một chốt chặn quá trình khám.
3. **Khối 3 (Kết quả & Kế hoạch):** Nằm ngay dưới nút AI. Thẻ kết quả AI chiếm trọn bề ngang. Form "Chẩn đoán" và "Đơn thuốc" nối tiếp bên dưới. Nút "LƯU BỆNH ÁN" được ghim cố định ở đáy màn hình (Sticky Footer) để dễ thao tác.

## Next Step

Sau khi plan này được duyệt, bước triển khai nên đi theo thứ tự:

1. dựng wireframe chi tiết desktop/mobile
2. refactor `CreateEmrPage.tsx` theo layout mới
3. gắn `AIDiagnosisPanel` vào đúng vị trí mới với interaction model one-click
4. tinh gọn hoặc thay thế các `AISuggestionInlineCard` nếu làm giao diện bị lệch sang kiểu chat

## Canonical Runtime Flow (Implemented 2026-03-30)

### Flow chuẩn tại Create EMR

1. Bác sĩ nhập `Triệu chứng` + tải `Hình ảnh lâm sàng`.
2. Bấm `AI chẩn đoán` ở Step 1.
3. Hệ thống trả Top 3 chẩn đoán với `Độ tự tin (%)`.
4. Bác sĩ bấm `Chọn chẩn đoán này` ở 1 trong Top 3.
5. Frontend gọi lại analyze với `selected_diagnosis_code` + `selected_diagnosis_label`.
6. Step 2 hiển thị gợi ý AI cho `Khách quan (Objective)`; phần `Chẩn đoán` không còn card gợi ý AI.
7. Step 3 hiển thị `Plan` + `Đơn thuốc` theo bệnh đã chọn (không chung chung).

### Rule hiển thị chính

- Chưa chọn bệnh: chỉ dùng kết quả Top 3 + bằng chứng + Objective; chưa unlock Assessment/Plan/Prescription.
- Đã chọn bệnh: khóa ngữ cảnh theo bệnh được chọn cho lần analyze tiếp theo.
- Nếu Objective chưa đủ dữ liệu: hiển thị thông báo hướng dẫn bổ sung ảnh/mô tả thay vì card rỗng.

### Token behavior (để tránh hiểu sai)

- Flow có chọn bệnh thường tạo 2 lần gọi analyze.
- Case match mạnh chỉ giúp skip VLM (đọc ảnh), không đồng nghĩa skip toàn bộ model.
- LLM synthesis hiện vẫn chạy ở mỗi lần analyze.
- Vì vậy chi phí token tăng theo số lần analyze; không có quy tắc "match thì chỉ 1 lần, không match thì 2 lần".

### Payload bổ sung bắt buộc sau khi chọn bệnh

```json
{
  "previous_request_id": "req-from-first-analyze",
  "synthesis_mode": "selected_only",
  "selected_diagnosis_code": "...",
  "selected_diagnosis_label": "..."
}
```

`previous_request_id` dùng để backend reuse context từ lượt analyze đầu tiên.

### Wording chuẩn trên UI

- `score_label`: `Độ tự tin (%)`
- `confidence_note`: `Độ tự tin: x%` hoặc `Độ tự tin (VLM fallback): x%`

### Runtime chuẩn để tối ưu token

1. Lượt 1 (`full`): staff bấm AI chẩn đoán ở Step 1 để lấy Top 3.
2. Lượt 2 (`selected_only`): staff chọn 1 bệnh trong Top 3, frontend gọi lại AI với `previous_request_id` + `selected_diagnosis_*`.
3. Backend dùng context đã cache từ lượt 1 để sinh nội dung Step 2/3 theo bệnh đã chọn, không chạy full pipeline lần nữa.
