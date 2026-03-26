# Hướng dẫn Test E2E - AI Diagnosis (STAFF)

> Last Updated: 2026-03-26
> Phạm vi: luồng STAFF trong Web EMR + AI sidepanel chat

## 1. Mục tiêu kiểm thử

- Xác nhận bác sĩ/staff dùng AI chẩn đoán ngay trong màn hình tạo EMR.
- Xác nhận có thể mở chat sidebar ngay tại trang EMR, chỉnh bản nháp SOAP và đồng bộ ngược về EMR.
- Xác nhận API `/api/v1/staff-diagnosis/analyze` hoạt động đúng với role `STAFF`/`ADMIN`.
- Xác nhận role không hợp lệ bị chặn.

## 2. Điều kiện trước khi test

1. Đăng nhập tài khoản `STAFF` (hoặc `ADMIN`) trên web.
2. Có ít nhất 1 thú cưng để mở màn hình tạo EMR.
3. `petties-agent-serivce` đang chạy và route `/api/v1/staff-diagnosis/analyze` đã mount.
4. (Khuyến nghị) Có dữ liệu KB nội bộ để quan sát kết quả gợi ý rõ hơn.

## 2.1 Hardening checks bắt buộc

Trước khi gọi build là ổn định cho AI diagnosis, bắt buộc verify thêm các rule sau:

1. `booking_id` phải được backend đối chiếu thật với booking record trước khi synthesis chạy.
2. Với role `STAFF`, booking phải thuộc đúng `clinic_id` hiện tại; nếu không phải trả `403`.
3. Nếu request gửi đồng thời `booking_id` và `pet_id`, hai giá trị phải khớp; nếu không phải trả `422`.
4. Nếu chỉ có `pet_id`, backend phải verify pet nằm trong patient scope staff được phép xem; nếu không phải fail-safe.
5. Nếu record không tồn tại, route phải trả `404`, không được tiếp tục bằng dữ liệu client tự gửi.
6. Preview từng ảnh phải dùng `image_analysis_mode=describe_only`.
7. Full analyze từ EMR phải dùng `image_analysis_mode=full`.
8. Khi KB / Case Memory / protocol không đủ evidence, AI không được tự sinh treatment heuristic theo keyword cơ thể hay tên bệnh.

## 3. Kịch bản E2E chính (Happy Flow)

1. Vào trang tạo EMR: `/staff/emr/create/:petId`.
2. Nhập dữ liệu SOAP cơ bản (`Subjective`, `Assessment`, `Plan`).
3. Nhập hoặc kiểm tra lại `cân nặng` và `dị ứng` của bé nếu muốn AI gợi ý liều rõ hơn cho các protocol cần `mg/kg`.
4. Tải lên ít nhất 1 ảnh lâm sàng trong mục `Hình ảnh lâm sàng` nếu muốn test nhánh vision.
5. Nếu chọn nhiều ảnh cùng lúc, kiểm tra UI hiển thị trạng thái `Đang tải ảnh lên`, số ảnh đã hoàn tất và trạng thái từng file.
6. Sau khi upload xong toàn bộ và không có lỗi, kiểm tra khối trạng thái upload tự ẩn.
7. Trong khối `Hỗ trợ AI chẩn đoán`, nhập mô tả lâm sàng vào 1 ô duy nhất.
8. Xác nhận panel AI hiển thị đúng ghi chú: chỉ đọc ảnh lâm sàng của EMR, không dùng ảnh tài liệu/PDF.
9. Bấm `Phân tích ca bệnh`.
10. Kiểm tra kết quả trả về gồm:
   - Chẩn đoán phân biệt
   - Dấu hiệu từ ảnh (nếu có ảnh)
   - Gợi ý SOAP
   - Gợi ý đơn thuốc nháp
11. Kiểm tra các ảnh lâm sàng chưa có mô tả được AI tự điền mô tả riêng cho từng ảnh theo đúng thứ tự upload.
12. Hover vào ô mô tả ảnh và kiểm tra xem được full description.
13. Kiểm tra ngay dưới các ô `Subjective`, `Objective`, `Assessment`, `Plan` có khối `Gợi ý AI...`.
14. Bấm `Dùng gợi ý` tại từng ô và xác nhận nội dung được đổ đúng vào form SOAP của EMR.
15. Trong phần đơn thuốc, kiểm tra khối `Đơn thuốc nháp từ AI`.
16. Nếu ca bệnh dùng protocol cần cân nặng, xác nhận:
   - có cân nặng thì AI trả liều `mg/kg` hoặc liều cố định phù hợp
   - thiếu cân nặng thì AI không tự động kê thuốc toàn thân và hiển thị yêu cầu bổ sung dữ liệu
17. Bấm `Nhận toàn bộ đơn` hoặc `Thêm thuốc này` và xác nhận danh sách kê đơn được cập nhật.
18. Bấm `Mở chat AI trong sidebar`.
19. Xác nhận chat sidebar mở ra ngay trên cùng trang EMR.
20. Xác nhận khối `Bệnh án đang soạn` được merge ngay trong luồng hội thoại của cùng sidebar chính, không mở thêm sidebar phụ.
21. Chỉnh trực tiếp nội dung SOAP tại sidebar hoặc dùng lại `Hỗ trợ AI chẩn đoán`.
22. Trở lại form EMR và bấm `Đồng bộ từ chat sidebar`.
23. Kiểm tra các ô SOAP cập nhật theo bản nháp mới nhất.
24. Lưu bệnh án.

## 4. Kịch bản phân quyền

1. Dùng user không phải `STAFF`/`ADMIN` gọi API `/api/v1/staff-diagnosis/analyze`.
2. Kỳ vọng HTTP `403`.
3. Kỳ vọng message: `Chỉ STAFF hoặc ADMIN mới được dùng chức năng chẩn đoán này.`

## 4.1 Kịch bản trust boundary và safety

1. Dùng `STAFF` hợp lệ nhưng gọi diagnosis với `booking_id` thuộc clinic khác.
2. Kỳ vọng HTTP `403`.
3. Dùng `STAFF` gửi `booking_id` hợp lệ nhưng cố tình sửa `pet_id` khác với booking thật.
4. Kỳ vọng HTTP `422`.
5. Dùng `ADMIN` hoặc `STAFF` gửi `pet_id` / `booking_id` không tồn tại.
6. Kỳ vọng HTTP `404`.
7. Chạy một ca có evidence nội bộ rỗng.
8. Kỳ vọng:
   - không có prescription heuristic
   - không có plan kiểu "vệ sinh mắt", "nhỏ thuốc tai", "bôi thuốc" chỉ vì keyword
   - plan chỉ còn guidance an toàn, theo dõi lâm sàng, và yêu cầu bổ sung dữ liệu khi cần

## 5. Kỳ vọng dữ liệu

- Bản nháp sidepanel được lưu local qua key: `petties:emr-ai-draft:v1`.
- Khi mở chat sidebar từ EMR, sidebar phải nhận đúng context `petId`, `bookingId`.
- Khi quay về EMR và bấm đồng bộ, dữ liệu phải đúng theo bản nháp mới nhất.

## 6. Checklist pass/fail nhanh

- PASS nếu:
  - API trả về 200 với STAFF/ADMIN.
  - Gợi ý SOAP inline hiển thị đúng dưới từng ô và áp dụng được.
  - Gợi ý đơn thuốc AI áp dụng được vào danh sách kê đơn.
  - Ảnh lâm sàng chưa có mô tả được AI tự điền mô tả riêng cho từng ảnh theo đúng thứ tự upload.
  - Khi tải nhiều ảnh, UI hiển thị trạng thái upload rõ ràng và giữ đúng thứ tự ảnh.
  - Chat sidebar hiển thị và cập nhật bản nháp.
  - Đồng bộ ngược về EMR thành công.
  - User role không hợp lệ bị chặn 403.

- FAIL nếu:
  - Không render panel AI trên EMR.
  - Không hiển thị đúng nguồn ảnh lâm sàng cho AI.
  - Không mở được chat sidebar theo context EMR.
  - Dữ liệu SOAP không đồng bộ hai chiều.
  - API staff diagnosis không kiểm soát role.

## 7. Kiểm tra auto-sync confirmed EMR

1. Tạo hoặc cập nhật một EMR đã xác nhận với `final_diagnosis_text` map được catalog.
2. Chạy sync confirmed EMR.
3. Kỳ vọng:
   - Case Memory có record `case_id = emr:{emr_id}`
   - payload có `mapping_status = mapped`
   - có `canonical_code`

4. Cập nhật lại chính EMR đó với thay đổi ở chẩn đoán hoặc clinical notes.
5. Chạy sync lại.
6. Kỳ vọng:
   - record cũ được overwrite theo cùng `case_id`
   - không tạo case memory mới trùng lặp

7. Tạo hoặc cập nhật một EMR đã xác nhận với `final_diagnosis_text` chưa map được catalog.
8. Chạy sync.
9. Kỳ vọng:
   - Case Memory vẫn có record `case_id = emr:{emr_id}`
   - payload có `mapping_status = provisional`
   - có `provisional_label = final_diagnosis_text`
   - hệ thống đồng thời ghi review item cho nhãn bệnh này

## 8. Kiểm tra auto-sync worker

1. Bật `EMR_CASE_MEMORY_AUTO_SYNC_ENABLED=true`.
2. Đặt `EMR_CASE_MEMORY_AUTO_SYNC_INTERVAL_SECONDS` nhỏ ở môi trường dev nếu muốn test nhanh.
3. Khởi động AI service.
4. Tạo hoặc cập nhật một EMR đã xác nhận ở Spring Boot.
5. Chờ qua một chu kỳ polling.
6. Kỳ vọng:
   - không cần gọi tay endpoint sync
   - record tương ứng xuất hiện hoặc được cập nhật trong Case Memory
   - nếu EMR đổi nội dung nhưng giữ nguyên `emr_id`, Case Memory vẫn dùng cùng `case_id = emr:{emr_id}`
