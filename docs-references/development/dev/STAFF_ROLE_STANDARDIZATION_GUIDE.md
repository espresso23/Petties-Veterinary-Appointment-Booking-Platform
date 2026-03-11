# Staff Role Standardization Guide

**Phiên bản:** 1.0
**Ngày cập nhật:** 2026-03-11
**Trạng thái:** ✅ Hoàn thành

## 1. Mục tiêu
Tài liệu này ghi nhận trạng thái chuẩn hóa terminology trong project về một role thống nhất là `STAFF` cho toàn bộ nhân sự phòng khám.

## 2. Kết quả chuẩn hóa
- Role vận hành dùng thống nhất là `STAFF`.
- Tài liệu, UI labels, workflow descriptions và actor naming đã được chuẩn hóa theo `Staff`.
- Các thuật ngữ cũ đã được loại bỏ khỏi tài liệu đang sử dụng cho trình bày và review.

## 3. Nguyên tắc tài liệu
- Dùng `Staff` khi nói về role nhân sự phòng khám.
- Dùng `Clinic Manager`, `Clinic Owner`, `Admin`, `Pet Owner` theo role hiện tại.
- Không dùng lại thuật ngữ cũ trong tên actor, role, sequence, flow, BPMN hoặc narrative.

## 4. Phạm vi ảnh hưởng
- Backend API docs
- SRS / SDD
- BPMN / ERD / Happy Flows
- AI Service documentation
- Mobile / Web documentation

## 5. Lưu ý
- Khi viết tài liệu mới, luôn ưu tiên `Staff` cho role.
- Nếu cần mô tả nhóm chuyên môn, dùng cách diễn đạt nghiệp vụ như `nhân sự y tế`, `nhân sự grooming`, thay vì dùng lại thuật ngữ cũ.
