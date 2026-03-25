# Kế Hoạch Fix AI-Service: Runtime Broken Paths + Chat Tool-Call Không Fallback + Diagnosis Data-Driven

## Tóm tắt
Mục tiêu đợt này là sửa nhóm lỗi `P0-P1` đang ảnh hưởng trực tiếp runtime và chất lượng kiến trúc của AI-service, với 3 nguyên tắc đã chốt:
- Không giữ fallback runtime sang tool khác hoặc endpoint legacy/public.
- Chat/tool-call phải fail-closed, hỏi lại hoặc trả lỗi rõ ràng, không tự suy diễn flow bằng rule cứng.
- Workflow chẩn đoán bệnh chuyển sang data-driven tối đa; nếu thiếu cấu hình/DB thì trả trạng thái chưa sẵn sàng, không rơi về heuristic/protocol hardcoded.

Phạm vi thực hiện tập trung vào 3 cụm mã: `app/core/agents/*`, `app/core/tools/mcp_tools/*`, `app/core/services/*`.

## Thay đổi triển khai chính
### 1. Ổn định runtime path và loại bỏ code path hỏng
- Chuẩn hóa lifecycle LLM client về đúng một singleton contract; sửa toàn bộ shutdown/cleanup path để dùng đúng biến cache hiện tại, không còn symbol mồ côi.
- Sửa `GeminiVisionAdapter` để chỉ dùng một đường lấy LLM client hợp lệ; bỏ kỳ vọng fallback ngầm sang env client nếu DB settings lỗi.
- Sửa `check_vaccination_status` và `get_pet_health_summary` để gọi các method backend client có thật; nếu backend client chưa có method tương ứng thì bổ sung method typed ở client, không dùng generic `.get(...)`.
- Hợp nhất `pet health summary` về một service chuẩn duy nhất; MCP tool và REST route cùng gọi cùng service đó, không giữ hai implementation tách biệt.

### 2. Chat/tool-call chuyển sang fail-closed, schema-driven
- Gỡ hoàn toàn auto web fallback sau `pet_knowledge_search`, deterministic auto-finalize ở test/no-LLM mode, và legacy “tool recovery” dựa trên rule booking cứng.
- Giữ ReAct loop nhưng khi model không chọn được tool hoặc thiếu params thì chỉ có 2 kết quả hợp lệ:
  - hỏi làm rõ dựa trên schema required fields;
  - kết thúc với thông báo không đủ dữ liệu hoặc lỗi công cụ.
- Bỏ hardcoded clarification theo từng tool trong `SingleAgent`; thay bằng một generic clarification builder đọc từ tool schema và runtime context.
- Thu gọn `prompt_builder` và `tool_routing` để chỉ còn:
  - format ReAct;
  - danh sách tool + schema;
  - các guardrail an toàn tối thiểu.
- Không encode flow booking, clinic-name priority, auto web-search, hay rule chọn tool cụ thể trong prompt/routing code.

### 3. Booking và backend integration không fallback
- Bỏ toàn bộ fallback từ endpoint chuẩn sang endpoint public/legacy trong booking flow và backend client.
- `get_clinic_services`, `check_available_slots`, `create_booking_for_user` chỉ gọi canonical endpoint mới; nếu backend chưa đáp ứng thì surface lỗi rõ ràng lên chat/tool result.
- Tool executor tiếp tục lọc params theo schema, nhưng không tự “cứu” flow bằng đổi endpoint hoặc đổi tool.
- Chuẩn hóa error payload của tool execution để WebSocket/chat route có thể hiển thị lỗi nghiệp vụ nhất quán cho client.

### 4. Diagnosis workflow chuyển sang data-driven
- Xem DB là nguồn sự thật duy nhất cho disease catalog, alias mapping, protocol, và câu hỏi follow-up theo diagnosis/body-system.
- Loại bỏ heuristic fallback theo keyword ear/eye/skin và plan mẫu hardcoded trong `StaffDiagnosisService`.
- `DiagnosisProtocolService` chuyển từ `if diagnosis_code == ...` sang lookup từ repository/config đã chuẩn hóa; nếu protocol không tồn tại thì trả “protocol chưa được cấu hình” thay vì build protocol cứng.
- `DiseaseMappingService` không giữ default in-memory snapshot cho production path; nếu migration/table/config thiếu thì trả lỗi readiness rõ ràng để admin xử lý.
- Giữ lại safety messaging ở output, nhưng safety phải là presentation-level rule, không thay thế chẩn đoán hoặc protocol.

### 5. Tool governance và metadata làm sạch nguồn sự thật
- Runtime tool registry lấy từ FastMCP scanner là nguồn chuẩn; context policy chỉ whitelist các tool thực sự được register.
- Xóa phantom tools khỏi policy hiện hành.
- Seed settings không còn hardcode schema tool hoặc fallback prompt nghiệp vụ; seed chỉ tạo agent/settings tối thiểu, sau đó scanner đồng bộ metadata tool thật từ code.
- Những tool staff/EMR đang mock nhưng còn live trong registry phải được chuyển sang một trong hai trạng thái rõ ràng:
  - implement thật bằng backend integration;
  - hoặc disable khỏi registry/policy nếu backend chưa sẵn sàng.
- `_legacy_disabled_image_analysis` và các code path disabled nhưng còn implementation phía dưới phải bị xóa hoặc tách khỏi runtime import path.

## API / interface / hành vi công khai
- WebSocket chat và REST route giữ nguyên contract đầu vào hiện tại, nhưng hành vi thay đổi:
  - không tự fallback sang `web_search`;
  - không tự fallback sang endpoint legacy/public;
  - không tự hoàn tất câu trả lời bằng deterministic fallback khi thiếu LLM.
- Tool result chuẩn hóa theo một dạng lỗi rõ ràng để client/debug mode phân biệt được:
  - lỗi thiếu cấu hình;
  - lỗi thiếu dữ liệu đầu vào;
  - lỗi backend integration;
  - lỗi tool unavailable.
- Diagnosis workflow trở thành “DB/config required”; môi trường thiếu migration/config sẽ fail rõ ràng thay vì dùng snapshot/protocol hardcoded.

## Kế hoạch test
- Unit test cho LLM client lifecycle và `GeminiVisionAdapter` để xác nhận không còn symbol hỏng, không còn fallback ngầm.
- Unit test cho tool executor và từng tool live:
  - `check_vaccination_status`;
  - `get_pet_health_summary`;
  - booking tools dùng canonical endpoint duy nhất.
- Agent tests cho chat flow:
  - KB rỗng không được tự gọi `web_search`;
  - tool thiếu params phải sinh clarification từ schema;
  - tool lỗi phải surface error, không đổi tool hoặc đổi endpoint.
- Diagnosis tests:
  - mapping/protocol lấy từ DB snapshot hợp lệ;
  - thiếu protocol hoặc thiếu mapping trả lỗi rõ;
  - không còn branch keyword heuristic cho ear/eye/skin.
- Regression test cho scanner/policy:
  - chỉ tool được register mới được whitelist;
  - seed không tạo schema cũ sai với runtime.

## Giả định và mặc định đã khóa
- Được phép thêm/sửa migration trong AI-service để lưu disease catalog, alias, protocol, follow-up template nếu schema hiện tại chưa đủ.
- Backend canonical endpoints là đường tích hợp duy nhất; nếu test env chưa sẵn sàng thì AI-service vẫn không fallback, mà trả lỗi tích hợp minh bạch.
- Không xử lý cleanup toàn bộ artifact/root debug file trong đợt này, trừ những gì đang nằm trên live import path hoặc làm sai runtime/policy.
- Không thay đổi UI contract phía client ngoài việc nội dung lỗi/clarification trở nên rõ và nhất quán hơn.
