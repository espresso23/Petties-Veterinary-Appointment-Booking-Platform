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

# Hardcoded defaults - only change via code
MAX_CONTEXT_STEPS = 5
OBSERVATION_MAX_LENGTH = 1500
OBSERVATION_HEAD_LENGTH = 1000
OBSERVATION_TAIL_LENGTH = 200
def _build_pet_owner_booking_section(
    *,
    enabled_tools_lower: Set[str],
) -> str:
    return """
=== PET_OWNER CHATBOT MODE ===
- GOAL: Help user book appointments efficiently (FORM-FIRST).
- STRATEGY: Use `quick_booking_search` immediately if pets/clinics/slots are unknown.
- DATA: Prefer quality clinics (high rating/reviews). Use `get_clinic_reviews` for specific quality questions.
- UI: Always guide user towards using UI Cards for final confirmation.
"""


def _build_clinic_copilot_booking_section(enabled_tools_lower: Set[str]) -> str:
    return """
=== CLINIC COPILOT MODE ===
- GOAL: Support internal clinic operations.
- TONE: Professional, data-driven, concise.
- FOCUS: Use internal tools (get_staff_patients, get_my_clinics) over public ones.
"""



def _build_role_tone_section(normalized_role: str) -> str:
    if normalized_role in {"STAFF", "CLINIC_MANAGER", "CLINIC_OWNER"}:
        return """=== TÔNG GIỌNG THEO VAI TRÒ (CLINIC COPILOT) ===
- Người dùng là nhân sự phòng khám:
    + Dùng văn phong chuyên nghiệp, súc tích, ưu tiên dữ kiện nội bộ.
    + Không chuyển sang kiểu hỏi đáp đại trà cho chủ nuôi.
    + Khi câu hỏi nhắm tới bệnh nhân cần theo dõi, hãy tóm tắt theo lịch tái khám, trạng thái booking, lần khám gần nhất và ghi chú lâm sàng nếu có. Tránh trả lời kiểu 'hệ thống chưa phân loại được' nếu vẫn còn tín hiệu vận hành để tổng hợp.
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
    booking_section = ""
    if has_booking_tools_enabled(enabled_tools_lower):
        booking_section = (
            _build_clinic_copilot_booking_section(enabled_tools_lower)
            if is_clinic_copilot_role(normalized_role)
            else _build_pet_owner_booking_section(
                enabled_tools_lower=enabled_tools_lower,
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
