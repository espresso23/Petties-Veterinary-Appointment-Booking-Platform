# AI Assistant - Role-Based Requirements Analysis

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
| **STAFF** | Task assistant + Alerts | Web/Mobile: Slide-in panel | ✅ Yes | user_id, clinic_id, assigned_bookings, today_schedule |
| **CLINIC_MANAGER** | Operations assistant + Analytics | Web: Slide-in panel | ✅ Yes | user_id, clinic_id, all_bookings, staff_list, revenue_data |
| **CLINIC_OWNER** | Business intelligence assistant | Web: Slide-in panel | ✅ Yes | user_id, owned_clinics[], revenue_trends, market_data |
| **ADMIN** | Agent configuration only | Web: Admin dashboard | ❌ No | system_settings, agent_config |

**Sự khác biệt chính:**
- **Pet Owner:** Passive assistant - chỉ trả lời khi được hỏi
- **Clinic Roles (Staff/Manager/Owner):** Proactive assistant - chủ động gửi notifications khi phát hiện issues/insights

---

## 2. 📱 PET_OWNER - Simple Q&A Chatbot

### 2.1 Use Cases
| UC-ID | Tên | Priority | Tools Required |
|-------|-----|----------|----------------|
| UC-001 | Chat with AI | P0 | WebSocket streaming |
| UC-002 | Ask pet care questions | P0 | `pet_care_qa` (RAG) |
| UC-003 | Search diseases by symptoms | P1 | `symptom_search` (RAG) |
| UC-004 | Book appointment via chat | P0 | `get_user_pets`, `search_clinics_nearby`, `check_available_slots`, `create_booking_for_user`, `get_clinic_services` |
| UC-019 | Analyze pet health images | P2 | `analyze_pet_image` (Vision) |
| UC-029 | Web search fallback | P2 | `web_search` |
| UC-AI-030 | Summarize medical history | P1 | `get_pet_medical_history`, `summarize_medical_records` |

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
| `pet_care_qa` | ✅ | Public knowledge |
| `symptom_search` | ✅ | Public knowledge |
| `get_user_pets` | ✅ | Own pets only (JWT verification) |
| `search_clinics_nearby` | ✅ | Public data |
| `check_available_slots` | ✅ | Public data |
| `create_booking_for_user` | ✅ | Own bookings only (JWT verification) |
| `get_clinic_services` | ✅ | Public data |
| `analyze_pet_image` | ✅ | Vision capability |
| Staff/Manager/Owner tools | ❌ | Forbidden |

---

## 3. 👨‍⚕️ STAFF - Task Assistant + Alerts

### 3.1 Use Cases
| UC-ID | Tên | Priority | Proactive Trigger |
|-------|-----|----------|-------------------|
| UC-020 | AI Staff Assistant | P0 | New booking assigned, Vaccination reminder, Schedule conflict |
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
- **Tone:** Professional, hướng dẫn, supportive
- **Proactive:** ✅ Chủ động gửi notifications
- **Notification Types:**
  1. 🔴 **URGENT:** Conflict lịch (2 bookings cùng giờ)
  2. 🟡 **WARNING:** Pet sắp hết hạn vaccine (7 ngày)
  3. 🟢 **INFO:** Booking mới được assign, Patient info summary sẵn sàng

### 3.5 Proactive Notification Logic
**Trigger 1: New Booking Assigned**
```python
# Khi Manager assign booking → Staff
notification = {
    "type": "INFO",
    "title": "Booking mới được giao",
    "message": "Bạn có booking mới: Max (Golden Retriever) - 14:00",
    "action": "XEM CHI TIẾT",
    "context": {"booking_id": "uuid"}
}
```

**Trigger 2: Schedule Conflict Detection**
```python
# Khi phát hiện 2 bookings cùng giờ
notification = {
    "type": "URGENT",
    "title": "XUNG ĐỘT LỊCH KHÁM",
    "message": "14:00 - Bạn có 2 bookings: Max và Luna",
    "action": "GIẢI QUYẾT NGAY",
    "context": {"conflicting_bookings": ["uuid1", "uuid2"]}
}
```

**Trigger 3: Vaccination Reminder**
```python
# Khi pet sắp hết hạn vaccine (7 ngày)
notification = {
    "type": "WARNING",
    "title": "Nhắc nhở vaccination",
    "message": "Pet Max cần tiêm vaccine Rabies (hết hạn 5 ngày nữa)",
    "action": "GỌI CHỦ PET",
    "context": {"pet_id": "uuid", "vaccine_type": "Rabies"}
}
```

### 3.6 Tools Access Permission
| Tool | Allowed? | Notes |
|------|----------|-------|
| All Pet Owner tools | ✅ | For helping customers |
| `get_patient_summary` | ✅ | Own clinic only |
| `get_emr_history` | ✅ | Assigned bookings only |
| `check_vaccination_status` | ✅ | Own clinic pets |
| `create_booking` | ❌ | Cannot create for customers (customer self-book hoặc Manager tạo) |
| Manager/Owner tools | ❌ | Forbidden |

---

## 4. 👔 CLINIC_MANAGER - Operations Assistant + Analytics

### 4.1 Use Cases
| UC-ID | Tên | Priority | Proactive Trigger |
|-------|-----|----------|-------------------|
| UC-021 | AI Manager Assistant | P0 | SOS alert, Revenue report, Reassignment suggestion |
| UC-024 | Assist creating staff schedules | P1 | Weekly schedule planning |
| UC-025 | Optimize work schedules | P2 | Workload imbalance detected |
| UC-030 | Auto-suggest staff assignments | P1 | New booking created |

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
    "staff_list": [
        {"id": "uuid", "name": "Dr. Hùng", "workload": 8, "specialties": ["Surgery"]}
    ],
    "revenue_data": {
        "today": 15000000,
        "week": 85000000,
        "month": 320000000
    },
    "permissions": ["manage_staff", "assign_bookings", "view_reports", "create_shifts"]
}
```

### 4.4 AI Behavior
- **Tone:** Data-driven, analytical, actionable recommendations
- **Proactive:** ✅ Chủ động gửi notifications + daily reports
- **Notification Types:**
  1. 🔴 **URGENT:** SOS booking (countdown timer)
  2. 🟡 **WARNING:** Workload imbalance, Tuần tới thiếu staff
  3. 🟢 **INFO:** Daily revenue report, Reassignment suggestions

### 4.5 Proactive Notification Logic
**Trigger 1: SOS Booking Alert**
```python
# Khi có SOS booking mới trong 3km radius
notification = {
    "type": "URGENT",
    "title": "🚨 SOS KHẨN CẤP",
    "message": "Pet Luna bị tai nạn - 2.5km - Countdown: 4:58",
    "action": "CHẤP NHẬN NGAY",
    "context": {"sos_booking_id": "uuid", "countdown_seconds": 298}
}
```

**Trigger 2: Daily Revenue Report**
```python
# Mỗi ngày 18:00
notification = {
    "type": "INFO",
    "title": "Báo cáo doanh thu ngày",
    "message": "Hôm nay: 25 bookings, 15M doanh thu (↑12% so với hôm qua)",
    "action": "XEM CHI TIẾT",
    "context": {"revenue_data": {...}}
}
```

**Trigger 3: Reassignment Suggestion**
```python
# Khi phát hiện staff workload imbalance
notification = {
    "type": "WARNING",
    "title": "Gợi ý cân bằng workload",
    "message": "Dr. Hùng: 12 bookings, Dr. Linh: 4 bookings. Gợi ý reassign 4 bookings?",
    "action": "XEM GỢI Ý",
    "context": {"reassignment_plan": [...]}
}
```

### 4.6 Tools Access Permission
| Tool | Allowed? | Notes |
|------|----------|-------|
| All Staff tools | ✅ | Full clinic access |
| `analyze_revenue_trends` | ✅ | Own clinic only |
| `suggest_staff_assignments` | ✅ | Own clinic staff |
| `create_staff_shifts` | ✅ | Own clinic staff |
| `optimize_schedules` | ✅ | Own clinic |
| `accept_sos_booking` | ✅ | Within radius + slots available |
| Owner tools | ❌ | Forbidden (cannot access multi-clinic data) |

---

## 5. 🏢 CLINIC_OWNER - Business Intelligence Assistant

### 5.1 Use Cases
| UC-ID | Tên | Priority | Proactive Trigger |
|-------|-----|----------|-------------------|
| UC-022 | AI Owner Assistant | P0 | Revenue trends, Market opportunities, Vet workload analysis |
| UC-026 | Assist clinic setup | P2 | New clinic onboarding |
| UC-027 | Generate clinic services | P1 | Setup wizard |
| UC-028 | Compose clinic description | P2 | Marketing content |

### 5.2 Interface Requirements
**Web (Owner Dashboard): Slide-in Panel + BI Cards**
- AI icon với insights badge
- Dashboard: "Business Insights" section với AI-generated cards
- Click card → open detailed analysis trong chat

### 5.3 Context Data (Session)
```python
{
    "user_id": "uuid",
    "role": "CLINIC_OWNER",
    "owned_clinics": [
        {"id": "uuid", "name": "Pet Care HCM", "revenue_month": 120000000}
    ],
    "revenue_trends": {
        "last_3_months": [98000000, 105000000, 120000000],  # ↑18%
        "yoy_growth": 0.25
    },
    "market_data": {
        "top_services": ["Grooming", "Vaccination", "Dental"],
        "competitor_avg_price": {...}
    },
    "permissions": ["manage_clinics", "view_all_data", "configure_services"]
}
```

### 5.4 AI Behavior
- **Tone:** Strategic, business-focused, growth-oriented
- **Proactive:** ✅ Chủ động gửi insights hàng tuần/tháng
- **Notification Types:**
  1. 🟢 **INSIGHT:** Revenue growth, Service opportunities
  2. 🟡 **WARNING:** Booking decline, Vet workload red flag
  3. 🔵 **TIP:** Market expansion, Pricing optimization

### 5.5 Proactive Notification Logic
**Trigger 1: Monthly Revenue Insight**
```python
# Đầu tháng (ngày 1)
notification = {
    "type": "INSIGHT",
    "title": "Báo cáo tháng 2",
    "message": "Doanh thu tháng 2: 120M (↑18%). Top service: Grooming (45M). Vet workload: Dr. Hùng cao nhất (80h).",
    "action": "XEM PHÂN TÍCH",
    "context": {"monthly_report": {...}}
}
```

**Trigger 2: Service Opportunity**
```python
# Khi phát hiện nhu cầu dịch vụ mới
notification = {
    "type": "INSIGHT",
    "title": "Cơ hội mở rộng dịch vụ",
    "message": "Dental Cleaning có 15 yêu cầu nhưng clinic chưa có. Doanh thu tiềm năng: 8M/tháng.",
    "action": "THÊM DỊCH VỤ",
    "context": {"suggested_service": "Dental Cleaning", "estimated_revenue": 8000000}
}
```

**Trigger 3: Vet Workload Alert**
```python
# Khi vet workload quá cao (>80% capacity)
notification = {
    "type": "WARNING",
    "title": "Workload cảnh báo",
    "message": "Dr. Hùng workload 85% (cao nhất). Gợi ý: Tuyển thêm 1 vet hoặc giảm booking slots.",
    "action": "XEM GIẢI PHÁP",
    "context": {"vet_id": "uuid", "workload_percent": 0.85}
}
```

### 5.6 Tools Access Permission
| Tool | Allowed? | Notes |
|------|----------|-------|
| All Manager tools | ✅ | For all owned clinics |
| `analyze_revenue_trends` | ✅ | Multi-clinic aggregation |
| `generate_clinic_services` | ✅ | Batch service creation |
| `compose_clinic_description` | ✅ | Marketing content |
| `suggest_service_pricing` | ✅ | Market-based pricing |
| `analyze_vet_workload` | ✅ | HR analytics |
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
- Phân tích triệu chứng và gợi ý khám bác sĩ
Tone: Thân thiện, dễ hiểu, dùng emojis 🐕🐈
        """,
        UserRole.STAFF: """
Bạn là AI assistant hỗ trợ nhân viên phòng khám.
- Tóm tắt thông tin bệnh nhân trước khám
- Chủ động nhắc nhở về conflicts và vaccination
- Hỗ trợ tra cứu EMR
Tone: Professional, hướng dẫn
        """,
        UserRole.CLINIC_MANAGER: """
Bạn là AI assistant hỗ trợ quản lý phòng khám.
- Chủ động báo cáo doanh thu, SOS alerts
- Gợi ý tối ưu lịch làm việc, reassignment
- Phân tích workload và operations
Tone: Data-driven, analytical
        """,
        UserRole.CLINIC_OWNER: """
Bạn là AI assistant business intelligence cho chủ phòng khám.
- Phân tích doanh thu, trends, market opportunities
- Gợi ý mở rộng dịch vụ, pricing optimization
- HR analytics (vet workload)
Tone: Strategic, growth-oriented
        """
    }
    return prompts.get(role, prompts[UserRole.PET_OWNER])

def get_allowed_tools_by_role(role: UserRole) -> List[str]:
    """Return list of tool names allowed for this role"""
    tools_map = {
        UserRole.PET_OWNER: [
            "pet_care_qa", "symptom_search", "get_user_pets",
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
            "analyze_revenue_trends", "suggest_staff_assignments",
            "create_staff_shifts", "optimize_schedules",
            "accept_sos_booking"
        ],
        UserRole.CLINIC_OWNER: [
            # All Manager tools +
            "generate_clinic_services", "compose_clinic_description",
            "suggest_service_pricing", "analyze_vet_workload"
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
- [ ] Implement 5 booking tools (theo `BOOKING_AI_TOOLS_REQUIREMENTS.md`)
- [ ] Create HTTP client cho Spring Boot APIs
- [ ] Test full booking flow via chat

### Phase 4: Proactive Notification System (Clinic Roles)
- [ ] Implement `ProactiveNotificationService`
- [ ] Background task: Check notifications định kỳ (mỗi 5 phút)
- [ ] WebSocket push notifications
- [ ] Frontend: Toast notifications + Slide-in panel

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
- ✅ Nhận proactive notifications (conflicts, vaccinations)
- ✅ Patient summary sẵn sàng trước khám
- ✅ Chat hỗ trợ tra cứu EMR

**Manager:**
- ✅ SOS alert realtime (< 10s latency)
- ✅ Daily revenue report tự động 18:00
- ✅ Reassignment suggestions accurate

**Owner:**
- ✅ Monthly insights đầy đủ (revenue, trends, opportunities)
- ✅ Service generation tool hoạt động
- ✅ Workload analytics chính xác

---

## 10. 📌 NOTES

1. **Human-in-the-loop là BẮT BUỘC:** AI KHÔNG BAO GIỜ tự động execute critical actions (booking, reassignment, service generation) mà không có user confirmation.

2. **Role permissions phải chặt chẽ:** Tools có kiểm tra JWT role + clinic_id để đảm bảo Staff không access data của clinic khác.

3. **MongoDB là foundation:** Tất cả chat history + ReAct traces phải được lưu để improvement loop hoạt động.

4. **Proactive notifications không spam:** Background task chỉ check mỗi 5 phút, và notification deduplicate (không gửi lại notification giống nhau).

5. **Admin không chat:** Admin chỉ configure, không tương tác với AI chatbot.
