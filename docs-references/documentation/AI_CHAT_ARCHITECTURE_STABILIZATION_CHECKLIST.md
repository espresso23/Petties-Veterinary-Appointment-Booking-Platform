# AI Chat Architecture Stabilization Checklist

**Project:** Petties - Veterinary Appointment Booking Platform  
**Scope:** AI Agent Service chat isolation, MongoDB persistence, admin playground separation  
**Last Updated:** 2026-03-08

## 1. Documentation Gate

- [ ] SRS section [docs-references/documentation/SRS/PETTIES_SRS.md](docs-references/documentation/SRS/PETTIES_SRS.md) được review và approved
- [ ] SDD section [docs-references/documentation/SDD/REPORT_4_SDD_SYSTEM_DESIGN.md](docs-references/documentation/SDD/REPORT_4_SDD_SYSTEM_DESIGN.md) được review và approved
- [x] Chốt 2 context bắt buộc: `BUSINESS_CHAT`, `PLAYGROUND_TEST`
- [ ] Chốt danh sách role được phép dùng business AI chat trong phase hiện tại
- [ ] Chốt rule `clinic_id` cho từng role: `PET_OWNER`, `STAFF`, `CLINIC_MANAGER`, `CLINIC_OWNER`, `ADMIN`
- [ ] Chốt policy session retention: business history và playground history lưu bao lâu

## 1.5 API Contract Gate

- [ ] Chốt REST contract cho create/list/get/delete session
- [ ] Chốt WebSocket contract cho business chat và playground chat
- [ ] Chốt message schema bắt buộc: `session_id`, `context_type`, `agent_id`, `provider_override`, `model_override`
- [ ] Chốt error contract cho 401/403/404/409 khi session không hợp lệ hoặc không thuộc owner
- [ ] Chốt chiến lược: 1 endpoint có `context_type` hay 2 endpoint tách riêng cho business/playground

## 2. Data Model Gate

- [x] `ai_chat_sessions` có đủ fields: `session_id`, `user_id`, `user_role`, `clinic_id`, `context_type`, `agent_id`, `created_at`, `updated_at`
- [x] `ai_chat_messages` có đủ fields: `message_id`, `session_id`, `user_id`, `role`, `content`, `context_type`, `react_trace`, `tool_calls`, `sources`, `timestamp`
- [x] Tạo đủ Mongo indexes cho ownership query và history query
- [x] Không còn phụ thuộc production vào in-memory `chat_sessions: dict = {}`
- [x] Chốt kiến trúc lưu chat: **AI chat chỉ dùng MongoDB**, không dùng PostgreSQL cho session/message
- [ ] Xóa hoàn toàn legacy PostgreSQL chat models/migrations/runtime paths để tránh 2 nguồn dữ liệu song song
- [ ] Có strategy migrate hoặc bỏ hẳn luồng session placeholder cũ

## 3. Security & Isolation Gate

- [x] WebSocket business chat validate owner theo `session_id + user_id + context_type`
- [x] WebSocket playground chỉ cho `ADMIN`
- [ ] Không cho admin playground đọc business chat history
- [x] Không cho user nghiệp vụ truy cập `PLAYGROUND_TEST`
- [x] Tool whitelist được áp dụng theo `user_role` và `context_type`
- [x] Các route quản trị `agents`, `tools`, `knowledge`, `settings` được bảo vệ đúng role
- [x] Session list API chỉ trả về session thuộc owner hiện tại và đúng context
- [ ] Không cho client tự giả mạo `clinic_id` nếu clinic scope phải được suy ra từ token/backend

## 4. Runtime Flow Gate

- [x] Tạo session REST trả về đúng metadata context
- [x] Resume session nạp đúng Mongo history theo owner/context
- [x] Persist user message trước khi gọi agent
- [x] Persist assistant message và `react_trace` sau khi stream xong
- [ ] Clear/delete session không ảnh hưởng context khác
- [ ] Khi WebSocket connect phải kiểm tra session tồn tại trước khi accept hoàn toàn
- [ ] Không fallback sang in-memory khi MongoDB lỗi ở production path
- [x] Có cơ chế update `updated_at` sau mỗi message để sắp xếp recent sessions

## 4.5 Frontend & Client Integration Gate

- [ ] FE/Web/Mobile gọi đúng luồng tạo session trước khi mở WebSocket
- [ ] FE truyền đúng `context_type` cho business chat và playground
- [ ] FE chỉ hiển thị history đúng context tương ứng
- [ ] FE xử lý rõ lỗi unauthorized/forbidden/session-not-found

## 5. Testing Gate

- [x] Unit test cho session ownership validation
- [x] Unit test cho context policy service
- [ ] Integration test cho business WebSocket flow
- [ ] Integration test cho admin playground flow
- [ ] Test case từ chối truy cập chéo session
- [ ] Test case MongoDB unavailable trả lỗi an toàn
- [ ] Test case route quản trị bị chặn với non-admin
- [ ] Test case nhiều session song song của cùng một user không bị lẫn history
- [ ] Test case different roles cùng truy cập một session bị chặn đúng expected

## 6. Release Readiness Gate

- [ ] Dev environment chạy ổn với `MONGODB_DATABASE=petties_nosql`
- [ ] Seed/config không ghi đè nhầm data production context
- [ ] Log/monitoring có phân biệt `BUSINESS_CHAT` và `PLAYGROUND_TEST`
- [ ] Hoàn tất review bảo mật trước khi code UI/feature tiếp theo

## 6.5 Observability & Cleanup Gate

- [ ] Có log field tối thiểu: `session_id`, `user_id`, `user_role`, `context_type`
- [ ] Không log lộ token hoặc dữ liệu nhạy cảm
- [ ] Có cleanup policy cho playground sessions cũ nếu cần
- [ ] Có dashboard/health indicator xác nhận Mongo collections và indexes hoạt động đúng

## 7. Decision Note

Chỉ bắt đầu code sau khi checklist mục 1 được approved. Sau khi implementation xong phải quay lại tick lại mục 2-6 bằng evidence test/runtime.
