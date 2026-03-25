# AI Assistant - Role-Based Requirements Analysis

> Lưu ý cập nhật ngày 2026-03-17: phần doctor diagnostic flow trong tài liệu này đã được thiết kế lại. `STAFF` không dùng `web_search` cho chẩn đoán; luồng mới ưu tiên knowledge base nội bộ, EMR đã xác nhận và Gemini Vision. Xem thêm [AI_DIAGNOSIS_FEATURE_PLAN.md](D:/SEP490/petties/docs-references/documentation/AI_DIAGNOSIS_FEATURE_PLAN.md).

**Mục đích:** Phân tích chi tiết requirements cho AI Assistant theo từng role trước khi implement.

**Ngày tạo:** 2026-03-08
**Tham chiếu:**
- `AI_SERVICE_TECHNICAL_SPECIFICATION.md` Section 2.1-2.3
- `backend-spring/.../Role.java` (5 roles)
- `BOOKING_AI_TOOLS_REQUIREMENTS.md`

---

## 1. 🎯 OVERVIEW: AI ASSISTANT CHO 5 ROLES

**Architecture:** Single Agent với Role-Based Context Switching

| Role | AI Behavior | Interface | Proactive? | Context Data |
|------|-------------|-----------|------------|--------------|
| **PET_OWNER** | Simple Q&A chatbot | Mobile: Chat bubble | ❌ No | user_id, pets, bookings |
| **STAFF** | Diagnostic support + Patient context | Web/Mobile: Slide-in panel | ⚠️ Limited | user_id, clinic_id, assigned_bookings, patient_context |
| **CLINIC_MANAGER** | Operations assistant | Web: Slide-in panel | ✅ Yes | user_id, clinic_id, all_bookings, staff_list |
| **CLINIC_OWNER** | Clinic setup assistant | Web: Setup wizard/panel | ❌ No | user_id, clinic_id, clinic_profile |
| **ADMIN** | Agent configuration only | Web: Admin dashboard | ❌ No | system_settings, agent_config |

**Sự khác biệt chính:**
- **Pet Owner:** Passive assistant - chỉ trả lời khi được hỏi
- **Staff:** Hỗ trợ đánh giá ca bệnh nhanh hơn nhờ triệu chứng, hồ sơ và hình ảnh lâm sàng.
- **Clinic Manager:** Tập trung hỗ trợ phân tích phản hồi khách hàng (Sentiment Analysis), tóm tắt báo cáo và chăm sóc khách hàng.
- **Clinic Owner:** Tập trung generate danh mục dịch vụ để setup clinic, không đi theo hướng BI/phân tích tăng trưởng.

---

## 2. 📱 PET_OWNER - Simple Q&A Chatbot

### 2.1 Use Cases
| UC-ID | Tên | Priority | Tools Required |
|-------|-----|----------|----------------|
| UC-001 | Chat with AI | P0 | WebSocket streaming |
| UC-002 | Ask pet care questions | P0 | `pet_knowledge_search` (RAG) |
| UC-003 | Search diseases by symptoms | P1 | `pet_knowledge_search` (RAG) |
| UC-004 | Book appointment via chat | P0 | `get_user_pets`, `search_clinics_nearby`, `check_available_slots`, `create_booking_for_user`, `get_clinic_services` |
| UC-019 | Analyze pet health images | P2 | Planned / future scope |
| UC-029 | Web search fallback | P2 | `web_search` |
| UC-AI-030 | Summarize medical history | P1 | Planned / future scope |

### 2.2 Interface Requirements
**Mobile Flutter Screen: `ChatScreen` (đã có)**
- Không có conversation list (chỉ 1 active chat)
- Chat bubble UI đơn giản
- WebSocket streaming responses
- Action buttons trong messages (Chọn Pet, Chọn Clinic, Xác nhận Booking)
- ReAct trace (optional display) - có thể ẩn/hiện

### 2.3 Context Data (Session)
```python
{
    "user_id": "uuid",
    "role": "PET_OWNER",
    "pets": [{"id": "uuid", "name": "Max", "species": "DOG"}],
    "location": {"latitude": 10.123, "longitude": 106.456},
    "recent_bookings": [{"id": "uuid", "status": "COMPLETED"}]
}
```

### 2.4 AI Behavior
- **Tone:** Thân thiện, dễ hiểu, dùng emojis 🐕🐈
- **Response style:** Ngắn gọn, 2-3 câu, rõ ràng
- **Proactive:** ❌ KHÔNG chủ động gửi notifications
- **Human-in-the-loop:** ✅ BẮT BUỘC confirm trước khi create booking

### 2.5 Tools Access Permission
| Tool | Allowed? | Notes |
|------|----------|-------|
| `pet_knowledge_search` | ✅ | Public knowledge |
| `get_user_pets` | ✅ | Own pets only (JWT verification) |
| `search_clinics_nearby` | ✅ | Public data |
| `check_available_slots` | ✅ | Public data |
| `create_booking_for_user` | ✅ | Own bookings only (JWT verification) |
| `get_clinic_services` | ✅ | Public data |
| Vision capability | Planned | Chưa có tool/runtime trong code hiện tại |
| Staff/Manager/Owner tools | ❌ | Forbidden |

---

## 3. 👨‍⚕️ STAFF - Diagnostic Support + Patient Summary

### 3.1 Use Cases
| UC-ID | Tên | Priority | Proactive Trigger |
|-------|-----|----------|-------------------|
| UC-020 | AI Staff Diagnostic Support | P0 | Before examination / During case review |
| UC-023 | Summarize patient info | P1 | Before examination |

### 3.2 Interface Requirements
**Web (Admin Dashboard): Slide-in Chat Panel**
- Icon badge hiển thị số notifications chưa đọc
- Click icon → slide-in panel từ phải
- Notifications list: 🔴 Urgent / 🟡 Warning / 🟢 Info
- Click notification → open AI chat với context focused

**Mobile (Flutter): Bottom Sheet or Full Screen Chat**
- Notification toast → click → open chat
- Same UI với Pet Owner nhưng có thêm "Proactive Notifications" tab

### 3.3 Context Data (Session)
```python
{
    "user_id": "uuid",
    "role": "STAFF",
    "clinic_id": "uuid",
    "assigned_bookings": [
        {"id": "uuid", "pet_name": "Max", "start_time": "14:00", "status": "PENDING"}
    ],
    "today_schedule": [
        {"time": "09:00", "booking_id": "uuid", "pet_name": "Luna"}
    ],
    "permissions": ["view_bookings", "update_emr", "check_in_pet"]
}
```

### 3.4 AI Behavior
- **Tone:** Professional, hướng dẫn, hỗ trợ chuyên môn.
- **Proactive:** ⚠️ Giới hạn; ưu tiên user-invoked trong MVP.
- **Main outputs:**
  1. Tóm tắt bệnh nhân trước khám
  2. Chẩn đoán phân biệt sơ bộ từ triệu chứng + EMR
  3. Cảnh báo red flags và bước kiểm tra gợi ý

### 3.6 Tools Access Permission
| Tool | Allowed? | Notes |
|------|----------|-------|
| All Pet Owner tools | ✅ | For helping customers |
| `get_patient_summary` | ✅ | Own clinic only |
| `get_emr_history` | ✅ | Assigned bookings only |
| `check_vaccination_status` | ✅ | Own clinic pets |
| Chẩn đoán hình ảnh cho bác sĩ | Redesigned | Sẽ dùng Gemini Vision + mô tả bác sĩ theo kiến trúc mới, chưa có runtime mới |
| `create_booking_for_user` | ❌ | Staff không tự tạo booking cho customer trong scope hiện tại |
| Manager/Owner tools | ❌ | Forbidden |

---

## 4. 👔 CLINIC_MANAGER - Analytics & Customer Care Assistant

### 4.1 Use Cases
| UC-ID | Tên | Priority | Proactive Trigger |
|-------|-----|----------|-------------------|
| UC-021 | Analyze customer feedback & reviews | P0 | Weekly/Monthly report |
| UC-024 | Generate customer care content | P1 | On demand |
| UC-030 | Summarize booking trends | P1 | On demand |

### 4.2 Interface Requirements
**Web (Clinic Dashboard): Slide-in Panel + Dashboard Cards**
- AI icon với notification badge (số lượng insights chưa đọc)
- Dashboard cards: "AI Insights Today" (top 3 insights)
- Click card → open AI chat với context focused

### 4.3 Context Data (Session)
```python
{
    "user_id": "uuid",
    "role": "CLINIC_MANAGER",
    "clinic_id": "uuid",
    "all_bookings": [...],  # Full access
    "permissions": ["manage_staff", "view_reports", "manage_customers"]
}
```

### 4.4 AI Behavior
- **Tone:** Chuyên nghiệp, phân tích dữ liệu, hướng tới khách hàng.
- **Proactive:** ✅ Chủ động gửi thông báo tóm tắt đánh giá của khách hàng (Sentiment analysis summary).
- **Notification Types:**
  1. 🔴 **URGENT:** Có review 1 sao cần xử lý gấp.
  2. 🟢 **INFO:** Tóm tắt tình hình đặt lịch/doanh thu tuần qua.

### 4.5 Proactive Notification Logic
**Trigger 1: Negative Review Alert**
```python
# Khi có đánh giá rất thấp (1-2 sao)
notification = {
    "type": "URGENT",
    "title": "🚨 Phản hồi tiêu cực mới",
    "message": "Khách hàng Nguyễn Văn A đánh giá 1 sao về thái độ phục vụ.",
    "action": "XEM CHI TIẾT",
    "context": {"review_id": "uuid"}
}
```

**Trigger 2: Weekly Summary**
```python
# Gửi vào sáng thứ 2 hàng tuần
notification = {
    "type": "INFO",
    "title": "Báo cáo AI tuần qua",
    "message": "Phòng khám có 45 ca khám (tăng 12%), dịch vụ tiêm phòng được yêu cầu nhiều nhất.",
    "action": "XEM TÓM TẮT",
    "context": {"trend_data": [...]}
}
```

### 4.6 Tools Access Permission
| Tool | Allowed? | Notes |
|------|----------|-------|
| All Staff tools | ✅ | Full clinic access |
| `analyze_customer_reviews` | ✅ | Own clinic data |
| `generate_care_messages` | ✅ | Own clinic data |
| `summarize_booking_trends` | ✅ | Own clinic data |
| Owner tools | ❌ | Forbidden (cannot access multi-clinic data) |

---

## 5. 🏢 CLINIC_OWNER - Clinic Setup Assistant

### 5.1 Use Cases
| UC-ID | Tên | Priority | Proactive Trigger |
|-------|-----|----------|-------------------|
| UC-027 | Generate clinic services | P0 | Setup wizard |

### 5.2 Interface Requirements
**Web (Clinic Setup Wizard / Owner Dashboard)**
- Nút `AI Generate Services` trong clinic setup
- Danh sách service cards để review/chỉnh sửa/lưu
- Không cần chat analytics riêng trong scope hiện tại

### 5.3 Context Data (Session)
```python
{
    "user_id": "uuid",
    "role": "CLINIC_OWNER",
    "clinic_id": "uuid",
    "clinic_profile": {
        "name": "Pet Care HCM",
        "clinic_type": "GENERAL_PRACTICE",
        "pet_types": ["DOG", "CAT"]
    },
    "permissions": ["manage_clinics", "configure_services"]
}
```

### 5.4 AI Behavior
- **Tone:** Thực tế, ngắn gọn, tập trung vào setup dữ liệu.
- **Proactive:** ❌ Không cần proactive analytics trong scope hiện tại.
- **Main outputs:**
  1. Danh sách dịch vụ gợi ý theo loại hình clinic
  2. Nhóm dịch vụ phù hợp theo pet types
  3. Dịch vụ khởi tạo để owner review và lưu

### 5.6 Tools Access Permission
| Tool | Allowed? | Notes |
|------|----------|-------|
| `generate_clinic_services` | ✅ | Core tool cho setup clinic |
| Manager analytics tools | ❌ | Out of current scope |
| Admin tools | ❌ | Forbidden |

---

## 6. 🔧 ADMIN - Agent Configuration (No Chat)

### 6.1 Use Cases
| UC-ID | Tên | Priority | Interface |
|-------|-----|----------|-----------|
| UC-005 | Configure Agent | P0 | Admin Dashboard Form |
| UC-006 | Edit System Prompt | P0 | Text Editor |
| UC-007 | Adjust Hyperparameters | P1 | Sliders (Temperature, Max Tokens, Top-P) |
| UC-008 | Select LLM Model | P1 | Dropdown (OpenRouter models) |
| UC-009-011 | Manage Tools | P1 | Table: Enable/Disable checkboxes |
| UC-012-014 | Manage Knowledge Base | P1 | Upload/Delete docs, Test RAG |
| UC-015-016 | Manage API Keys | P0 | Encrypted input fields, Test button |

### 6.2 Interface Requirements
**Web (Admin Dashboard): No AI Chat Panel**
- Admin **KHÔNG chat với AI**, chỉ configure agent
- Dashboard pages:
  - `/admin/ai/agent-config` - Agent settings
  - `/admin/ai/tools` - Tool management
  - `/admin/ai/knowledge-base` - Document management
  - `/admin/ai/api-keys` - API key configuration
  - `/admin/ai/analytics` - Metrics dashboard (xem AI performance)

### 6.3 Context Data
```python
{
    "user_id": "uuid",
    "role": "ADMIN",
    "permissions": ["configure_agent", "manage_tools", "view_analytics", "manage_api_keys"]
}
```

### 6.4 AI Behavior
- Admin **KHÔNG tương tác trực tiếp với AI chatbot**
- Admin chỉ configure agent behavior cho các roles khác
- Admin xem analytics để monitor AI performance

---

## 7. 🛠️ IMPLEMENTATION REQUIREMENTS

### 7.1 Role Context Switching (Python Agent)
**File:** `petties-agent-serivce/app/core/agent/role_context.py`

```python
from enum import Enum

class UserRole(Enum):
    PET_OWNER = "PET_OWNER"
    STAFF = "STAFF"
    CLINIC_MANAGER = "CLINIC_MANAGER"
    CLINIC_OWNER = "CLINIC_OWNER"
    ADMIN = "ADMIN"

def get_system_prompt_by_role(role: UserRole) -> str:
    """Return role-specific system prompt"""
    prompts = {
        UserRole.PET_OWNER: """
Bạn là AI assistant thân thiện hỗ trợ pet owner.
- Trả lời câu hỏi về chăm sóc thú cưng
- Giúp đặt lịch khám qua chat
- Phân tích triệu chứng và gợi ý khám Staff
Tone: Thân thiện, dễ hiểu, dùng emojis 🐕🐈
        """,
        UserRole.STAFF: """
Bạn là AI assistant hỗ trợ nhân viên phòng khám.
- Tóm tắt thông tin bệnh nhân trước khám
- Hỗ trợ phân tích triệu chứng và chẩn đoán phân biệt sơ bộ
- Hỗ trợ tra cứu EMR và dữ liệu liên quan ca khám
Tone: Professional, hướng dẫn
        """,
        UserRole.CLINIC_MANAGER: """
Bạn là AI assistant hỗ trợ quản lý phòng khám.
- Phân tích và tổng hợp đánh giá của khách hàng
- Hỗ trợ tạo nội dung chăm sóc khách hàng chuyên nghiệp
- Tóm tắt tình hình đặt lịch và xu hướng dịch vụ
Tone: Chuyên nghiệp, hướng tới khách hàng, phân tích dữ liệu
        """,
        UserRole.CLINIC_OWNER: """
Bạn là AI assistant hỗ trợ thiết lập phòng khám.
- Generate danh mục dịch vụ khởi tạo theo loại hình clinic
- Hỗ trợ review và chỉnh sửa service catalog trước khi lưu
- Không phân tích doanh thu, trends hay BI trong scope hiện tại
Tone: Rõ ràng, thực tế, tập trung setup
        """
    }
    return prompts.get(role, prompts[UserRole.PET_OWNER])

def get_allowed_tools_by_role(role: UserRole) -> List[str]:
    """Return list of tool names allowed for this role"""
    tools_map = {
        UserRole.PET_OWNER: [
            "pet_knowledge_search", "get_user_pets",
            "search_clinics_nearby", "check_available_slots",
            "create_booking_for_user", "get_clinic_services"
        ],
        UserRole.STAFF: [
            # All Pet Owner tools +
            "get_patient_summary", "get_emr_history",
            "check_vaccination_status"
        ],
        UserRole.CLINIC_MANAGER: [
            # All Staff tools +
            "analyze_customer_reviews",
            "generate_care_messages",
            "summarize_booking_trends"
        ],
        UserRole.CLINIC_OWNER: [
            "generate_clinic_services"
        ]
    }
    return tools_map.get(role, [])
```

### 7.2 Proactive Notification System
**File:** `petties-agent-serivce/app/services/proactive_notifications.py`

```python
from typing import Dict, Any
import asyncio

class ProactiveNotificationService:
    """
    Chủ động gửi notifications cho Clinic roles (STAFF, MANAGER, OWNER)
    """

    async def check_and_send_notifications(self, user_id: str, role: UserRole):
        """Background task chạy định kỳ để check và gửi notifications"""
        if role == UserRole.PET_OWNER:
            return  # Pet owner không nhận proactive notifications

        notifications = []

        if role == UserRole.STAFF:
            notifications = await self._check_staff_notifications(user_id)
        elif role == UserRole.CLINIC_MANAGER:
            notifications = await self._check_manager_notifications(user_id)
        elif role == UserRole.CLINIC_OWNER:
            notifications = await self._check_owner_notifications(user_id)

        # Send notifications via WebSocket
        for notif in notifications:
            await self._send_notification(user_id, notif)

    async def _check_staff_notifications(self, user_id: str) -> List[Dict]:
        """Check for Staff-specific notifications"""
        # Logic: Check conflicts, vaccinations, new assignments
        pass

    async def _send_notification(self, user_id: str, notification: Dict):
        """Send notification via WebSocket"""
        # Implementation: WebSocket push
        pass
```

### 7.3 MongoDB Chat History
**Collections Required:**
1. `ai_chat_sessions` - Session metadata (user_id, role, clinic_id, timestamps)
2. `ai_chat_messages` - Messages + ReAct trace
3. `ai_proactive_notifications` - Log proactive notifications sent

**Schema đã được document chi tiết trong `AI_AGENT_DATA_IMPROVEMENT_STRATEGY.md`**

---

## 8. ✅ CHECKLIST IMPLEMENTATION

### Phase 1: MongoDB Configuration (URGENT)
- [ ] Add MongoDB config vào `settings.py`
- [ ] Create MongoDB connection module
- [ ] Create collections: `ai_chat_sessions`, `ai_chat_messages`, `ai_proactive_notifications`
- [ ] Test MongoDB save trong WebSocket handler

### Phase 2: Role Context Switching
- [ ] Create `role_context.py` với system prompts cho từng role
- [ ] Implement `get_allowed_tools_by_role()` function
- [ ] Modify WebSocket handler để inject role context
- [ ] Test: Chat với PET_OWNER, STAFF, MANAGER - verify different prompts

### Phase 3: Booking Tools (Pet Owner Priority)
- [x] Implement 5 booking tools (theo `BOOKING_AI_TOOLS_REQUIREMENTS.md`)
- [ ] Create HTTP client cho Spring Boot APIs
- [~] Test full booking flow via chat
- [x] Add booking context guardrails: hỏi loại khám trước nếu thiếu, không hỏi lại thông tin đã có
- [x] Support `HOME_VISIT` payload cho `create_booking_for_user` với address/GPS/distance validation

### Phase 4: Clinic Role Workflows
- [ ] Implement `ProactiveNotificationService`
- [ ] Background task: Check notifications định kỳ (mỗi 5 phút)
- [ ] WebSocket push notifications
- [ ] Frontend: Toast notifications + Slide-in panel
- [ ] Staff diagnostic support UI with symptom input + patient context
- [ ] Staff patient summary integration before examination
- [ ] Clinic owner service generation flow in setup wizard

### Phase 5: Frontend Integration
- [ ] Pet Owner: Chat bubble UI (Flutter)
- [ ] Staff/Manager/Owner: Slide-in panel (React Web)
- [ ] Notification badge + count
- [ ] Action buttons trong notifications

---

## 9. 🎯 SUCCESS CRITERIA

**Pet Owner:**
- ✅ Chat flow mượt mà, response < 2s
- ✅ Booking via chat thành công 100%
- ✅ RAG Q&A relevant (score > 0.7)

**Staff:**
- ✅ Patient summary sẵn sàng trước khám
- ✅ Chat hỗ trợ tra cứu EMR
- ✅ Hỗ trợ chẩn đoán phân biệt sơ bộ từ triệu chứng và bệnh sử

**Manager:**
- ✅ Sentinel analysis & review summary accurate
- ✅ Customer care templates generation useful
- ✅ Booking trends summary reliable

**Owner:**
- ✅ Service generation tool hoạt động
- ✅ Owner có thể review, chỉnh sửa và lưu danh mục dịch vụ khởi tạo

---

## 10. 📌 NOTES

1. **Human-in-the-loop là BẮT BUỘC:** AI KHÔNG BAO GIỜ tự động execute critical actions (booking, gửi tin nhắn chăm sóc khách hàng, service generation) mà không có user confirmation.

2. **Role permissions phải chặt chẽ:** Tools có kiểm tra JWT role + clinic_id để đảm bảo Staff không access data của clinic khác.

3. **MongoDB là foundation:** Tất cả chat history + ReAct traces phải được lưu để improvement loop hoạt động.

4. **Proactive notifications không spam:** Background task chỉ check mỗi 5 phút, và notification deduplicate (không gửi lại notification giống nhau).

5. **Admin không chat:** Admin chỉ configure, không tương tác với AI chatbot.
6. **Clinic Owner scope hiện tại:** Chỉ tập trung generate danh mục dịch vụ để setup clinic, không bao gồm business intelligence hay market analytics.
