# Tài liệu Kỹ thuật - AI Agent Service (Petties)

**Phiên bản:** 1.5  
**Cập nhật:** 2026-03-22  
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

| Tool | Module | Purpose | UI Card |
|------|--------|---------|---------|
| `pet_knowledge_search` | medical_tools | RAG knowledge retrieval | - |
| `web_search` | medical_tools | Web fallback | - |
| `get_user_pets` | booking_tools | Get user's pet list | `pet_list` |
| `search_clinics_nearby` | booking_tools | Find nearby clinics | `clinic_suggestion` |
| `get_clinic_services` | booking_tools | Get clinic services | `service_chips` |
| `check_available_slots` | booking_tools | Check available slots | `slot_grid` |
| `create_booking_for_user` | booking_tools | Create booking | `booking_summary`, `booking_created` |
| `check_vaccination_status` | booking_tools | Check vaccination | `vaccination_card` |
| `get_patient_summary` | medical_tools | Staff patient summary | - |
| `get_emr_history` | medical_tools | Staff EMR history | - |

### 3.2 Tool đã loại khỏi runtime chính

- `analyze_pet_image` của hướng AI Diagnose cũ

Tool này không còn được seed mặc định, không còn nằm trong whitelist runtime, và không còn là một capability active của hệ thống.

---

## 4. Tool Self-Contained UI Cards (v2.0)

> **Cập nhật 2026-03-22**

Design pattern cho phép tools tự định nghĩa UI card trong return value. chat.py dùng generic dispatcher thay vì hardcoded extraction.

### 4.1 Motivation

**Trước (v1.x):**
```python
# chat.py - hardcoded extraction
if tool_name == "search_clinics_nearby":
    suggestion = extract_clinic_suggestion(...)
    await manager.send_message(session_id, {"type": "clinic_suggestion", ...})
elif tool_name == "get_clinic_services":
    chips = extract_service_chips(...)
    await manager.send_message(session_id, {"type": "service_chips", ...})
# ... 6+ if/elif blocks
```

**Sau (v2.0):**
```python
# booking_tools.py - tool self-contains UI spec
return {
    "data": result,
    "ui_card": {"type": "clinic_suggestion", "clinics": [...], ...}
}

# chat.py - generic dispatcher
ui_payload = extract_ui_card(step)
if ui_payload:
    await manager.send_message(session_id, {**ui_payload, ...})
```

### 4.2 Implementation

**Tool definition:**
```python
@mcp_server.tool
async def search_clinics_nearby(...) -> Dict[str, Any]:
    result = await _do_search(...)
    
    return {
        "success": True,
        "clinics": result,
        "total_found": len(result),
        
        # UI Card - Tool tự định nghĩa
        "ui_card": {
            "type": "clinic_suggestion",
            "clinics": result[:5],
            "total_found": len(result),
            "location": {"lat": lat, "lng": lng},
        }
    }
```

**Generic dispatcher (chat.py):**
```python
def extract_ui_card(step: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    tool_result = step.get("tool_result") or {}
    
    # Unwrap if wrapped in "data"
    if isinstance(tool_result, dict) and isinstance(tool_result.get("data"), dict):
        tool_result = tool_result.get("data") or {}
    
    ui_card = tool_result.get("ui_card")
    if not ui_card or not isinstance(ui_card, dict):
        return None
    
    ui_type = ui_card.get("type")
    if not ui_type:
        return None
    
    # Return clean payload
    return {"type": ui_type, **{k: v for k, v in ui_card.items() if k != "type"}}
```

### 4.3 Current UI Card Types

| Type | Tool | Trigger | Fields |
|------|------|---------|--------|
| `clinic_suggestion` | `search_clinics_nearby` | Success with clinics | `clinics[]`, `total_found`, `location` |
| `service_chips` | `get_clinic_services` | Success with services | `clinic_id`, `services[]` |
| `slot_grid` | `check_available_slots` | Success with slots | `clinic_id`, `booking_date`, `recommended_slots[]`, `alternative_slots[]` |
| `booking_summary` | `create_booking_for_user` | Not confirmed yet | `pet_id`, `clinic_id`, `booking_date`, `start_time`, `service_ids[]` |
| `booking_created` | `create_booking_for_user` | Confirmed success | `booking{}` |
| `pet_list` | `get_user_pets` | Success with pets | `pets[]` |
| `vaccination_card` | `check_vaccination_status` | Always | `pet_id`, `history[]`, `upcoming[]` |

### 4.4 Adding New Tool with UI Card

```python
@mcp_server.tool
async def my_new_tool(...) -> Dict[str, Any]:
    result = await do_something(...)
    
    return {
        "success": True,
        "data": result,
        "ui_card": {
            "type": "my_new_card",
            "field1": result.value1,
            "field2": result.value2,
        }
    }
```

No changes needed to `chat.py`.

---

## 5. Kiến trúc dữ liệu hiện tại

### 5.1 Knowledge base

- Lưu trong Qdrant
- Dùng cho RAG và grounding câu trả lời

### 5.2 EMR confirmed

- Là nguồn dữ liệu lâm sàng chính cho doctor flow
- Là nguồn ưu tiên để sinh case memory mới
- Là nguồn nhãn đáng tin cậy cho các vòng cải thiện chất lượng sau này

### 5.3 Case memory

- Không còn lấy trọng tâm từ thumbs up/down như hướng cũ
- Hướng mới là tái sử dụng dữ liệu từ EMR confirmed

---

## 6. Định hướng chẩn đoán qua ảnh mới

AI chẩn đoán qua ảnh sẽ đi theo hướng:

1. bác sĩ gửi ảnh + mô tả lâm sàng
2. Gemini Vision phân tích visual findings
3. output được map về canonical disease labels
4. agent đối chiếu với knowledge base và EMR/case memory
5. agent tổng hợp top bệnh liên quan nhất

Phần này là **kiến trúc mới đang ở giai đoạn thiết kế**, chưa phải runtime production hiện tại.

---

## 7. Những gì đã bị loại bỏ

Các thành phần sau đã bị loại khỏi runtime/dev flow để tránh nhiễu:

- route backend AI Diagnose cũ
- package `app/core/vision_model`
- Label Studio integration cũ
- vision labeling service cũ
- vision feedback schema cũ
- web admin page/service cho AI Diagnose cũ
- docker compose dev service của Label Studio

---

## 8. Tài liệu nguồn sự thật hiện tại

Khi làm việc với hướng AI diagnosis mới, ưu tiên tham chiếu:

- [AI_DIAGNOSIS_FEATURE_PLAN.md](/D:/SEP490/petties/docs-references/documentation/AI_DIAGNOSIS_FEATURE_PLAN.md)
- [AI_DIAGNOSIS_PROGRESS.md](/D:/SEP490/petties/docs-references/documentation/AI_DIAGNOSIS_PROGRESS.md)

Hai tài liệu trên phản ánh kiến trúc mới:

- doctor flow không dùng web search
- EMR confirmed là nguồn dữ liệu chính
- Gemini Vision là hướng image understanding mới
