"""
PETTIES AGENT SERVICE - LLM Prompt Builder

Assemble the full prompt sent to the LLM in the Think node,
including system prompt, ReAct format rules, tool descriptions,
and booking guidance.

Package: app.core.agents
Version: v1.1.0 (Extracted from single_agent.py)
"""

from typing import List, Dict, Any, Set
import json

from loguru import logger

from app.core.agents.text_utils import extract_latest_user_message
from app.core.agents.booking_flow import build_booking_prompt_guidance


# Maximum number of previous ReAct steps to include as context
MAX_CONTEXT_STEPS = 10

# Maximum length for observation content before truncation
OBSERVATION_MAX_LENGTH = 3000
OBSERVATION_HEAD_LENGTH = 2500
OBSERVATION_TAIL_LENGTH = 300


def build_context(react_steps: List[Dict[str, Any]]) -> str:
    """Build context string from previous ReAct steps.

    Args:
        react_steps: List of ReActStep dicts.

    Returns:
        Formatted context string.
    """
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
) -> str:
    """Create the full prompt for the Think (LLM reasoning) node.

    Args:
        messages: Conversation messages.
        context: Context built from previous ReAct steps.
        agent_name: Name of the agent.
        agent_type: Type of the agent.
        system_prompt: Admin-editable system prompt.
        tool_schemas: Tool schemas with name, description, input_schema.
        enabled_tools_lower: Pre-computed lowercase set of enabled tool names.

    Returns:
        Complete prompt string.
    """
    user_message = extract_latest_user_message(messages)

    prompt_parts = [
        f"""Hệ thống: {agent_name} ({agent_type})

=== NHÂN CÁCH & QUY TẮC NGHIỆP VỤ (Tùy chỉnh bởi Admin) ===
{system_prompt}

=== QUY TẮC REACT FORMAT (Bắt buộc) ===
Để gọi công cụ, bạn PHẢI viết theo định dạng CHÍNH XÁC:
Thought: [Giải thích tại sao bạn cần gọi công cụ này]
Tool: [Tên công cụ chính xác từ danh sách CÔNG CỤ CÓ SẴN]
Tool Input: {{ "param_name": "giá trị" }}

Sau khi nhận được kết quả (Observation), hãy TỔNG HỢP câu trả lời bằng định dạng:
Thought: [Tổng hợp thông tin thu thập được và kiến thức của bạn]
Final Answer: [Câu trả lời đầy đủ và thân thiện cho người dùng bằng tiếng Việt]

=== NGUYÊN TẮC TRẢ LỜI (Quan trọng) ===
- Tập trung vào CÂU HỎI CỦA NGƯỜI DÙNG, trả lời đúng trọng tâm hỏi gì đáp được đó.
  + Ví dụ: "nên ăn gì" → liệt kê CỤ THỂ các loại thức ăn (cháo gà loãng, cơm trắng nấu mềm, thức ăn ướt dễ tiêu, etc.)
  + Ví dụ: "làm gì" → liệt kê CỤ THỂ các bước xử lý
  + Ví dụ: "có sao không" → đánh giá mức độ nghiêm trọng cụ thể
- Dùng kết quả tool như THÔNG TIN THAM KHẢO bổ sung, KHÔNG copy nguyên văn.
- KẾT HỢP kiến thức chuyên môn SẴN CÓ của bạn về thú y/chăm sóc thú cưng với dữ liệu từ tools.
- Nếu tool không đủ thông tin, BẮT BUỘC bổ sung bằng kiến thức của bạn để trả lời đầy đủ.
- Trả lời bằng tiếng Việt (trừ khi người dùng hỏi bằng tiếng Anh), có cấu trúc rõ ràng, dễ đọc.
- Cuối câu trả lời luôn nhắc người dùng nên đưa thú cưng đi khám nếu tình trạng không cải thiện.

=== NHẬN DIỆN LỖI CHÍNH TẢ TIẾNG VIỆT (Quan trọng) ===
Người dùng thường gõ sai dấu tiếng Việt. TRƯỚC KHI trả lời, hãy kiểm tra:
1. Câu hỏi có từ nào VÔ NGHĨA trong ngữ cảnh thú cưng/thú y không?
2. Nếu có, thử thay đổi dấu thanh/dấu mũ xem có tạo thành từ hợp nghĩa không.

Các lỗi chính tả PHỔ BIẾN trong tiếng Việt:
- Nhầm dấu: đ↔d (đâu↔dâu, đau↔dau), ă↔a, ê↔e, ô↔o, ơ↔o, ư↔u
- Nhầm thanh: hỏi↔ngã (ẳ↔ẵ, ẻ↔ẽ), sắc↔nặng (á↔ạ), không dấu
- Thiếu dấu hoàn toàn: "cho bi tieu chay do dau" = "chó bị tiêu chảy do đâu"
Ví dụ: "chó bị tiêu chảy do dâu" → "dâu" (trái dâu) VÔ NGHĨA trong ngữ cảnh bệnh → có thể user muốn hỏi "do đâu" (nguyên nhân gì)

CÁCH XỬ LÝ khi phát hiện lỗi chính tả có thể:
- Nếu CÓ THỂ SUY LUẬN rõ ràng ý người dùng (chỉ có 1 cách hiểu hợp lý): Trả lời theo ý đúng, đầu câu ghi nhẹ "Mình hiểu bạn muốn hỏi '[câu đã sửa]' nhé!" rồi trả lời bình thường.
- Nếu MƠ HỒ (có thể hiểu nhiều cách): HỎI LẠI người dùng để xác nhận. Ví dụ: "Bạn muốn hỏi 'chó bị tiêu chảy do đâu' (nguyên nhân) hay 'chó bị tiêu chảy do ăn dâu' (do ăn trái dâu)? Mình cần xác nhận để trả lời chính xác nhé!"

LƯU Ý:
- Nếu không cần gọi công cụ, hãy đi thẳng đến Final Answer. TUYỆT ĐỐI KHÔNG viết "Tool: Không", "Tool: None" hoặc bất kỳ giá trị không hợp lệ nào.
- Chỉ sử dụng tên công cụ CHÍNH XÁC từ danh sách CÔNG CỤ CÓ SẴN bên dưới.

Bối cảnh hệ thống:
{context}
"""
    ]

    # Add available tools
    if tool_schemas:
        descriptions = []
        for tool in tool_schemas:
            params = tool.get("input_schema") or tool.get("parameters") or {}
            descriptions.append(
                f"- {tool['name']}: {tool['description']} "
                f"(Tham số cần có: {json.dumps(params)})"
            )
        prompt_parts.append(
            "CÔNG CỤ CÓ SẴN (Ưu tiên sử dụng):\n" + "\n".join(descriptions) + "\n"
        )

    # Add booking guidance
    guidance = build_booking_prompt_guidance(messages, context, enabled_tools_lower)
    if guidance:
        prompt_parts.append(guidance)

    prompt_parts.append(
        f"CÂU HỎI CỦA NGƯỜI DÙNG:\n{user_message}\n\n"
        f"Bây giờ, hãy bắt đầu quy trình ReAct của bạn:\nThought:"
    )

    return "\n".join(prompt_parts)
