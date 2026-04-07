"""
PETTIES AGENT SERVICE - LLM Prompt Builder

Assemble the full prompt sent to the LLM in the Think node,
including system prompt, ReAct format rules, tool descriptions,
and booking guidance.

Package: app.core.agents
Version: v1.3.0 (Fast Draft Flow)
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
    is_clinic_copilot_role,
    normalize_agent_role,
)
from app.core.tool_runtime_context import get_tool_runtime_context

# Hardcoded defaults - only change via code
MAX_CONTEXT_STEPS = 5
OBSERVATION_MAX_LENGTH = 1500
OBSERVATION_HEAD_LENGTH = 1000
OBSERVATION_TAIL_LENGTH = 200
BOOKING_SESSION_TOOLS = {
    "sync_booking_draft",
    "get_booking_session_info",
    "close_booking_session",
}


def _build_pet_owner_booking_section(
    *,
    enabled_tools_lower: Set[str],
    current_stage: str,
    collected_params_json: str,
    missing_fields_json: str,
    booking_state_json: str,
) -> str:
    draft_state_block = ""
    if enabled_tools_lower.intersection(BOOKING_SESSION_TOOLS):
        draft_state_block = f"""
=== TRẠNG THÁI BẢN NHÁP (BOOKING DRAFT) ===
[SYSTEM STATE]
Stage: {current_stage}
Hiện có: {collected_params_json}
Cần thêm: {missing_fields_json}
Luôn dùng `sync_booking_draft` để cập nhật bản nháp thay vì hỏi nhiều câu hỏi text.
Draft JSON: {booking_state_json}
[END SYSTEM STATE]
"""

    return f"""
=== CHẾ ĐỘ PET_OWNER CHATBOT ===
- Bạn là AI hỗ trợ PET_OWNER. Mục tiêu tối thượng khi đặt lịch là: **TẠO BẢN NHÁP NHANH NHẤT CÓ THỂ (FAST DRAFT)**.
- Khi người dùng muốn đặt lịch, hãy dùng `sync_booking_draft` để điền tất cả những gì bạn hiểu được ngay trong 1 lượt ReAct.
- **Không hỏi lại những gì đã biết hoặc có thể suy luận.** Ví dụ: Nếu user chỉ có 1 pet, hãy tự điền `pet_name`. Nếu user nói "ngày mai", hãy tự tính ngày.
- **Ưu tiên UI Card**: Sau khi tạo/cập nhật draft, hãy mời người dùng xem và hoàn thiện nốt các trường còn thiếu trên **Thẻ Đặt Lịch (UI Card)** thay vì tiếp tục hội thoại hỏi đáp.
- Không lộ các tên tool hoặc khái niệm lập trình (json, draft, session) trong câu trả lời cuối.
{draft_state_block}
=== QUY TẮC NGHIỆP VỤ ===
- Nếu user nói "bé nhà tôi", hãy gọi `get_user_pets` trước.
- `search_clinics_nearby` dùng để tìm clinic. `check_available_slots` dùng để xem lịch trống thực tế.
- `create_booking_for_user` chỉ gọi sau khi user đã xác nhận trên UI Card. Sau đó gọi `close_booking_session(status='COMPLETED')`.
"""


def _build_clinic_copilot_booking_section(enabled_tools_lower: Set[str]) -> str:
    clinic_lines = [
        "=== CHẾ ĐỘ CLINIC COPILOT ===",
        "- Bạn đang đóng vai AI copilot cho nhân sự phòng khám, không phải consumer chatbot cho PET_OWNER.",
        "- Mục tiêu chính: hỗ trợ vận hành, tra cứu nội bộ, tóm tắt thông tin và đề xuất thao tác tiếp theo cho clinic roles.",
        "- Không tự động đẩy hội thoại thành consumer flow kiểu pet -> dịch vụ -> phòng khám -> giờ nếu người dùng chỉ đang hỏi thông tin.",
        "- Không lộ khái niệm nội bộ như booking draft, booking session, runtime state hoặc tên tool trong câu trả lời cuối.",
    ]

    if "get_my_clinics" in enabled_tools_lower:
        clinic_lines.append(
            "- Ưu tiên `get_my_clinics` để xác định phòng khám mà người dùng đang quản lý hoặc làm việc."
        )
    if "get_staff_patients" in enabled_tools_lower:
        clinic_lines.append(
            "- Khi staff hỏi về thú cưng của khách, ưu tiên `get_staff_patients` và các tool nội bộ thay vì `get_user_pets`."
        )
    if "search_clinics_nearby" in enabled_tools_lower:
        clinic_lines.append(
            "- `search_clinics_nearby` chỉ dùng khi cần so sánh theo vị trí thực tế hoặc cần tìm clinic khác, không dùng để mở consumer booking wizard."
        )
    if "check_available_slots" in enabled_tools_lower:
        clinic_lines.append(
            "- `check_available_slots` là tool tra cứu availability cho copilot. Chỉ dùng để tra cứu và tóm tắt, không biến mỗi lần tra cứu thành bước chốt booking."
        )
    if "create_booking_for_user" in enabled_tools_lower:
        clinic_lines.append(
            "- Nếu và chỉ nếu tool tạo booking được whitelist, hãy xem nó là thao tác nghiệp vụ có xác nhận rõ ràng, không phải mặc định của mọi cuộc hội thoại."
        )

    clinic_lines.append(
        "- Nếu người dùng yêu cầu không thực hiện một thao tác (ví dụ: không xác nhận, không tạo, dừng, hủy), phải dừng thao tác ngay và chuyển sang hỏi phương án thay thế phù hợp."
    )

    return "\n".join(clinic_lines)


def _build_role_tone_section(normalized_role: str) -> str:
    if normalized_role in {"STAFF", "CLINIC_MANAGER", "CLINIC_OWNER"}:
        return """=== TÔNG GIỌNG THEO VAI TRÒ (CLINIC COPILOT) ===
- Người dùng là nhân sự phòng khám:
    + Dùng văn phong chuyên nghiệp, súc tích, ưu tiên dữ kiện nội bộ.
    + Không chuyển sang kiểu hỏi đáp đại trà cho chủ nuôi.
"""

    if normalized_role == "PET_OWNER":
        return """=== TÔNG GIỌNG THEO VAI TRÒ (PET_OWNER CHATBOT) ===
- Người dùng là PET_OWNER:
    + Dùng từ ngữ thân thiện, dễ hiểu, súc tích.
    + Tập trung vào việc hỗ trợ đặt lịch nhanh và lời khuyên chăm sóc.
"""

    return """=== TÔNG GIỌNG THEO VAI TRÒ ===
- Dùng giọng điệu trung lập, bám đúng whitelist tool và context hiện tại.
"""


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
    normalized_role = normalize_agent_role(user_role)
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
        booking_section = (
            _build_clinic_copilot_booking_section(enabled_tools_lower)
            if is_clinic_copilot_role(normalized_role)
            else _build_pet_owner_booking_section(
                enabled_tools_lower=enabled_tools_lower,
                current_stage=current_stage,
                collected_params_json=collected_params_json,
                missing_fields_json=missing_fields_json,
                booking_state_json=booking_state_json,
            )
        )

    role_tone_section = _build_role_tone_section(normalized_role)

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

{role_tone_section}

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

    guidance = build_booking_prompt_guidance(
        messages,
        context,
        enabled_tools_lower,
        user_role=normalized_role,
    )
    if guidance:
        prompt_parts.append(guidance)

    prompt_parts.append(
        f"CÂU HỎI CỦA NGƯỜI DÙNG:\n{user_message}\n\n"
        f"Bây giờ, hãy bắt đầu quy trình ReAct của bạn:\nThought:"
    )

    return "\n".join(prompt_parts)
