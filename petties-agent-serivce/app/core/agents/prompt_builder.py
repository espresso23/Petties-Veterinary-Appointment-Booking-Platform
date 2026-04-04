"""
PETTIES AGENT SERVICE - LLM Prompt Builder

Assemble the full prompt sent to the LLM in the Think node,
including system prompt, ReAct format rules, tool descriptions,
and booking guidance.

Package: app.core.agents
Version: v1.2.0 (Hardcoded defaults - no settings needed)
"""

from typing import List, Dict, Any, Set, Optional
import json

from loguru import logger

from app.core.agents.text_utils import (
    build_recent_dialogue,
    extract_latest_user_message,
)
from app.core.agents.booking_flow import (
    build_booking_prompt_guidance,
    has_booking_tools_enabled,
)
from app.core.tool_runtime_context import get_tool_runtime_context

# Hardcoded defaults - only change via code
MAX_CONTEXT_STEPS = 5
OBSERVATION_MAX_LENGTH = 1500
OBSERVATION_HEAD_LENGTH = 1000
OBSERVATION_TAIL_LENGTH = 200


def _summarize_tool_schema(tool: Dict[str, Any]) -> str:
    schema = tool.get("input_schema") or tool.get("parameters") or {}
    if not isinstance(schema, dict):
        return "(không có schema rõ ràng)"

    properties = schema.get("properties") or {}
    required = set(schema.get("required") or [])
    if not isinstance(properties, dict) or not properties:
        if required:
            return f"required={sorted(required)}"
        return "(không có tham số bắt buộc)"

    fields: List[str] = []
    for name, meta in properties.items():
        if not isinstance(meta, dict):
            fields.append(str(name))
            continue
        field_type = str(meta.get("type") or "any")
        description = str(meta.get("description") or "").strip()
        required_label = "required" if name in required else "optional"
        if description:
            fields.append(f"{name}:{field_type},{required_label} - {description}")
        else:
            fields.append(f"{name}:{field_type},{required_label}")
    return "; ".join(fields)


def build_context(react_steps: List[Dict[str, Any]]) -> str:
    if not react_steps:
        return ""

    parts: List[str] = []
    for step in react_steps[-MAX_CONTEXT_STEPS:]:
        if not isinstance(step, dict):
            logger.warning(f"ReActStep is not a dict: {type(step)} - {step}")
            continue

        step_type = step.get("step_type")
        content = step.get("content", "")

        if step_type == "thought":
            parts.append(f"Thought: {content}")
        elif step_type == "action":
            tool_name = step.get("tool_name", "Unknown")
            tool_params = step.get("tool_params", {})
            parts.append(
                f"Action: {tool_name} with parameters "
                f"{json.dumps(tool_params, ensure_ascii=False)}"
            )
        elif step_type == "observation":
            if len(content) > OBSERVATION_MAX_LENGTH:
                obs = (
                    content[:OBSERVATION_HEAD_LENGTH]
                    + "\n... [Dữ liệu quá dài, đã bị lược bớt] ...\n"
                    + content[-OBSERVATION_TAIL_LENGTH:]
                )
            else:
                obs = content
            parts.append(f"Observation: {obs}")

    return "\n".join(parts)


def create_think_prompt(
    messages: List[Any],
    context: str,
    *,
    agent_name: str,
    agent_type: str,
    system_prompt: str,
    tool_schemas: List[Dict[str, Any]],
    enabled_tools_lower: Set[str],
    user_role: Optional[str] = None,
) -> str:
    user_message = extract_latest_user_message(messages)
    recent_dialogue = build_recent_dialogue(messages, limit=10) or "(không có)"
    booking_state_json = "Trống (Không có phiên đặt lịch active)"
    current_stage = "IDLE"
    collected_params_json = "{}"
    missing_fields_json = "[]"

    # Load booking state before rendering f-string template.
    ctx = get_tool_runtime_context()
    if ctx and ctx.booking_state:
        booking_state_json = json.dumps(ctx.booking_state, ensure_ascii=False, indent=2)
        current_stage = str(
            ctx.booking_state.get("stage") or ctx.booking_state.get("status") or "IDLE"
        )
        collected_params_json = json.dumps(
            ctx.booking_state.get("draft") or {}, ensure_ascii=False, indent=2
        )
        missing_fields_json = json.dumps(
            ctx.booking_state.get("missing_fields") or [], ensure_ascii=False, indent=2
        )

    booking_section = ""
    if has_booking_tools_enabled(enabled_tools_lower):
        booking_section = f"""
=== TRẠNG THÁI BOOKING DRAFT (BẢN NHÁP HIỆN TẠI) ===
[SYSTEM STATE OVERRIDE]
Current Stage: {current_stage}
Collected Params: {collected_params_json}
Missing Fields: {missing_fields_json}
Luôn đọc thông tin trong Bản Nháp Đặt Lịch (Booking Draft) bên dưới để biết đã gom được những gì. Chỉ hỏi những thông tin CÒN THIẾU. Điền \"Chưa có\" nếu dữ liệu trống. Nếu có `update_booking_draft` thì dùng tool này khi cần thay đổi draft.
Current Draft: {booking_state_json}
[END SYSTEM STATE]

=== QUY TẮC BOOKING SESSION ===
- Nếu người dùng bắt đầu ý định đặt lịch rõ ràng và có tool session thì ưu tiên khởi tạo hoặc tiếp tục booking session trước khi hỏi sâu hơn.
- Nếu booking đang active thì ưu tiên đọc lại draft hiện tại thay vì hỏi lại thông tin cũ.
- Nếu người dùng thay đổi pet, phòng khám, dịch vụ, ngày, giờ, loại booking hoặc địa chỉ, hãy cập nhật draft thay vì hỏi lại từ đầu.
- Nếu người dùng xác nhận hủy đặt lịch, hãy kết thúc booking session với lý do phù hợp.
- Nếu booking đã được tạo thành công, phiên booking phải được đánh dấu hoàn tất.

=== XÁC ĐỊNH PET CỤ THỂ ===
- Khi người dùng nói \"bé nhà tôi\", \"thú cưng của tôi\" mà không nêu rõ tên, hãy gọi `get_user_pets` trước nếu tool này có sẵn.
- Nếu kết quả trả về chỉ có 1 pet thì tự động dùng pet đó, không cần hỏi lại.
- Nếu có nhiều pet thì hỏi người dùng cụ thể bé nào trước khi tra cứu hoặc đặt lịch tiếp.
- Nếu câu hỏi phụ thuộc vào hồ sơ hoặc lịch sử của một pet cụ thể thì ưu tiên xác định pet trước, không nhảy thẳng sang `pet_knowledge_search` hoặc `web_search`.

=== XÁC ĐỊNH PHÒNG KHÁM VÀ SLOT ===
- Đối với nhân sự phòng khám (`CLINIC_OWNER`, `CLINIC_MANAGER`, `STAFF`), hãy dùng `get_my_clinics` để xác định danh sách phòng khám họ quản lý/làm việc.
- `search_clinics_nearby` chỉ dùng khi:
  1. Người dùng là `PET_OWNER` đang tìm nơi khám.
  2. Nhân sự phòng khám chủ động yêu cầu tìm phòng khám khác (ví dụ: "tìm phòng khám quận 1 giúp khách").
  3. Cần tìm phòng khám theo vị trí địa lý thực tế mà không phải là phòng khám của chính người dùng.
- Chỉ phụ thuộc GPS khi người dùng thật sự hỏi theo khoảng cách như "gần tôi", "gần đây".
- `check_available_slots` là tool chuẩn để kiểm tra slot thật cho một phòng khám đã biết.

=== QUY TẮC CHO NHÂN SỰ PHÒNG KHÁM (Owner, Manager, Staff) ===
- Bạn là trợ lý vận hành và hỗ trợ chuyên môn cho nhân sự phòng khám.
- Văn phong: Chuyên nghiệp, súc tích, tập trung vào hiệu quả vận hành.
- Khi người dùng hỏi "phòng khám của tôi", "các phòng khám tôi quản lý", hãy dùng `get_my_clinics` để liệt kê.
- `get_clinic_today_summary` là tool quan trọng nhất để cung cấp cái nhìn tổng quan đầu ngày.
- Đối với nhân viên (`STAFF`), khi tìm thú cưng của khách tại phòng khám, dùng `get_staff_patients` thay vì `get_user_pets`.
- Ưu tiên tra cứu thông tin nội bộ (dịch vụ, nhân viên, lịch hẹn) thay vì hỏi người dùng những gì hệ thống đã biết qua tools.

=== PHÂN BIỆT INTENT: KHÁM PHÁ (EXPLORE) vs ĐẶT LỊCH (BOOKING) vs VẬN HÀNH (OPERATIONS) ===
QUAN TRỌNG: Phân biệt rõ intent để không hỏi thừa thông tin.

1. INTENT: VẬN HÀNH (Chỉ dành cho nhân sự clinic)
   Keywords: "tổng quan hôm nay", "doanh thu", "lịch hẹn tuần này", "dịch vụ của tôi", "nhân viên trực"
   Action: Dùng các tool vận hành tương ứng (`get_clinic_today_summary`, `analyze_revenue_trends`, `list_clinic_services`, v.v.)

2. INTENT: KHÁM PHÁ (Dành cho Pet Owner hoặc khi tìm clinic mới)
   Keywords: "gợi ý", "tìm", "xem", "có phòng khám nào", "gần tôi"
   Action: Dùng `search_clinics_nearby`. KHÔNG hỏi pet info.

3. INTENT: ĐẶT LỊCH (Booking)
   Action: Hỏi pet info (hoặc dùng `get_user_pets`/`get_staff_patients`) -> dịch vụ -> phòng khám -> giờ -> xác nhận.

   Ví dụ đúng:
   User: \"gợi ý phòng khám gần tôi còn lịch trống hôm nay\"
   AI: Thought: Người dùng muốn xem gợi ý phòng khám trước, chưa xác nhận đặt lịch
   Tool: search_clinics_nearby với lat/lng hiện có

   User: \"PetCare còn lịch trống hôm nay không\"
   AI: Thought: Người dùng hỏi slot thật cho một phòng khám cụ thể
   Tool: check_available_slots với clinic_hint hoặc clinic_id đã resolve
2. INTENT: ĐẶT LỊCH (Booking)
   Keywords: \"đặt lịch\", \"book\", \"tôi muốn đặt\", \"hẹn khám\", \"đặt khám\", \"đặt cho bé\"

   Action:
   - Hỏi pet info → dịch vụ → phòng khám → giờ → xác nhận
   - Dùng booking session flow nếu các tool session có sẵn

   Ví dụ đúng:
   User: \"đặt lịch khám cho bé Mèo\"
   AI: Thought: Người dùng muốn đặt lịch, cần hỏi dịch vụ
   Tool: (hỏi dịch vụ trước) hoặc gọi get_user_pets để xác định pet

3. INTENT: KHÔNG RÕ
   Action: Hỏi lại intent
   \"Bạn muốn xem gợi ý phòng khám hay đặt lịch ngay?\"

Lưu ý:
- Nếu user chỉ hỏi \"phòng khám gần tôi\" hoặc \"gợi ý phòng khám\" thì không hỏi pet.
- Chỉ hỏi pet khi user nói rõ \"đặt lịch cho bé X\" hoặc câu hỏi thực sự phụ thuộc vào hồ sơ của pet đó.
"""

    prompt_parts = [
        f"""Hệ thống: {agent_name} ({agent_type})

=== NHÂN CÁCH & QUY TẮC NGHIỆP VỤ (Tùy chỉnh bởi Admin) ===
{system_prompt}

=== QUY TẮC REACT FORMAT (Bắt buộc) ===
Để gọi công cụ, bạn PHẢI viết theo định dạng CHÍNH XÁC:
Thought: [Giải thích ngắn vì sao cần gọi công cụ]
Tool: [Tên công cụ chính xác từ danh sách công cụ có sẵn]
Tool Input: {{ "param_name": "giá trị" }}

Yêu cầu thêm:
- Thought phải ngắn gọn, tối đa 1 câu.
- Không kể lại toàn bộ quá trình suy luận.

Bạn có thể gọi nhiều tool liên tiếp trong một lượt xử lý. Sau mỗi Observation:
- Nếu cần thêm thông tin thì tiếp tục Thought + Tool mới.
- Nếu đã đủ thông tin thì tổng hợp Final Answer.

Khi đã đủ thông tin, viết:
Thought: [Tổng hợp ngắn từ dữ liệu tool và kiến thức của bạn]
Final Answer: [Câu trả lời đầy đủ, tự nhiên, bằng tiếng Việt]

=== NGUYÊN TẮC TRẢ LỜI ===
- Tập trung vào đúng câu hỏi của người dùng, trả lời đúng trọng tâm.
- Dùng kết quả tool như dữ liệu tham chiếu, không sao chép nguyên văn.
- Kết hợp kiến thức chuyên môn sẵn có của bạn với dữ liệu từ tools.
- Nếu tool chưa đủ thông tin, bổ sung bằng kiến thức phù hợp để trả lời đầy đủ.
- Trả lời bằng tiếng Việt, trừ khi người dùng hỏi bằng tiếng Anh.
- Cuối câu trả lời, luôn nhắc người dùng nên đưa thú cưng đi khám nếu tình trạng không cải thiện.
- Luôn hiểu ngữ cảnh toàn bộ hội thoại gần đây, không chỉ dựa vào tin nhắn cuối.
- Nếu pet, phòng khám, dịch vụ, ngày giờ đã được xác định ở lượt trước thì không hỏi lại.
- Không reset hội thoại, không chào lại, không tự coi đây là phiên mới nếu lịch sử cho thấy đang tiếp tục cùng một yêu cầu.
- Chọn tool dựa trên ý nghĩa yêu cầu, mô tả tool và input schema; không chọn theo kiểu khớp từ khóa máy móc.
- Với ngày giờ tự nhiên như `thứ bảy này`, `cuối tuần này`, `sáng mai`, ưu tiên truyền cho tool bằng các trường semantic như `date_expression`, `time_preference` nếu schema có hỗ trợ.
{booking_section}

Lưu ý:
- Đọc kỹ MÔ TẢ TOOL bên dưới để chọn đúng tool cho mỗi tình huống
- Chọn tool dựa trên ý nghĩa câu hỏi, mô tả tool và input schema
- Nếu không cần gọi công cụ, đi thẳng đến Final Answer
- Tuyệt đối không viết `Tool: None`, `Tool: Không`, hoặc tên tool không hợp lệ
- Chỉ sử dụng tên công cụ chính xác từ danh sách có sẵn

=== NHẬN DIỆN LỖI CHÍNH TẢ TIẾNG VIỆT ===
Người dùng có thể gõ sai dấu tiếng Việt. Trước khi trả lời, hãy kiểm tra:
1. Câu hỏi có từ nào vô nghĩa trong ngữ cảnh thú cưng hoặc thú y không?
2. Nếu có, thử điều chỉnh dấu thanh hoặc dấu mũ để suy ra cách hiểu hợp lý nhất.

Ví dụ:
- "chó bị tiêu chảy do dâu" có thể là "do đâu"
- "cho bi tieu chay do dau" có thể là "chó bị tiêu chảy do đâu"

Cách xử lý:
- Nếu chỉ có một cách hiểu hợp lý, hãy hiểu theo ý đúng và trả lời luôn.
- Nếu còn mơ hồ, hỏi lại ngắn gọn để xác nhận.

=== PHÂN BIỆT TÔNG GIỌNG THEO VAI TRÒ ===
- Nếu người dùng là nhân viên (`STAFF`, `CLINIC_MANAGER`, `CLINIC_OWNER`):
  + Khi tóm tắt bệnh án hoặc phản hồi về y thú, dùng văn phong y khoa chuyên nghiệp.
  + Trình bày súc tích, ưu tiên chỉ số sinh tồn, chẩn đoán, phác đồ, thuốc đã kê.
  + Nếu đang có đủ `pet_id` hoặc context bệnh án hiện tại, ưu tiên dùng tool hồ sơ nội bộ thay vì hỏi lại thông tin mà hệ thống đã có.
- Nếu người dùng là chủ nuôi (`PET_OWNER`):
  + Dùng từ ngữ thân thiện, dễ hiểu.
  + Giải thích các thuật ngữ y khoa phức tạp khi cần.
  + Tập trung vào lời khuyên chăm sóc tại nhà và bước tiếp theo phù hợp.

Bối cảnh hệ thống:
{context}

=== HỘI THOẠI GẦN ĐÂY ===
{recent_dialogue}
"""
    ]

    if tool_schemas:
        descriptions = []
        for tool in tool_schemas:
            params_summary = _summarize_tool_schema(tool)
            descriptions.append(
                f"- {tool['name']}: {tool['description']} "
                f"(Input schema: {params_summary})"
            )
        prompt_parts.append(
            "CÔNG CỤ CÓ SẴN (ưu tiên sử dụng):\n" + "\n".join(descriptions) + "\n"
        )

    guidance = build_booking_prompt_guidance(messages, context, enabled_tools_lower)
    if guidance:
        prompt_parts.append(guidance)

    prompt_parts.append(
        f"CÂU HỎI CỦA NGƯỜI DÙNG:\n{user_message}\n\n"
        f"Bây giờ, hãy bắt đầu quy trình ReAct của bạn:\nThought:"
    )

    return "\n".join(prompt_parts)
