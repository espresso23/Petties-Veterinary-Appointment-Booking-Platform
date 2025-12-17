# PETTIES MVP ERD - Simplified Version

**Version:** 1.0 MVP  
**Last Updated:** 2025-12-17  
**Scope:** Core Features (Sprint 1-9)  
**Total Entities:** 15

---

## 1. Mermaid ERD (Crow's Foot)

```mermaid
erDiagram
    %% ========== USER MANAGEMENT ==========
    USER {
        uuid id PK
        varchar username UK "NOT NULL"
        varchar email UK "NOT NULL"
        varchar password "NOT NULL"
        varchar full_name
        varchar phone
        varchar avatar
        enum role "PET_OWNER|VET|CLINIC_MANAGER|CLINIC_OWNER|ADMIN"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    %% ========== CLINIC MANAGEMENT ==========
    CLINIC {
        uuid id PK
        uuid owner_id FK
        varchar name "NOT NULL"
        varchar address "NOT NULL"
        varchar phone "NOT NULL"
        decimal latitude
        decimal longitude
        json operating_hours
        enum status "PENDING|APPROVED|REJECTED"
        decimal rating_avg
        timestamp created_at
    }

    CLINIC_STAFF {
        uuid id PK
        uuid clinic_id FK
        uuid user_id FK
        enum role "VET|CLINIC_MANAGER"
        varchar specialization
        enum status "ACTIVE|INACTIVE"
        timestamp created_at
    }

    SERVICE {
        uuid id PK
        uuid clinic_id FK
        varchar name "NOT NULL"
        decimal base_price "NOT NULL"
        int duration_minutes "NOT NULL"
        int slots_required "DEFAULT 1"
        boolean is_active "DEFAULT TRUE"
        timestamp created_at
    }

    %% ========== PET MANAGEMENT ==========
    PET {
        uuid id PK
        uuid owner_id FK
        varchar name "NOT NULL"
        enum species "DOG|CAT|BIRD|OTHER"
        varchar breed
        date birth_date
        enum gender "MALE|FEMALE|UNKNOWN"
        decimal weight_kg
        varchar avatar
        timestamp created_at
    }

    %% ========== SCHEDULING ==========
    VET_SHIFT {
        uuid id PK
        uuid vet_id FK
        uuid clinic_id FK
        date work_date "NOT NULL"
        time start_time "NOT NULL"
        time end_time "NOT NULL"
        enum status "SCHEDULED|COMPLETED|CANCELLED"
        timestamp created_at
    }

    SLOT {
        uuid id PK
        uuid shift_id FK
        int slot_number "NOT NULL"
        time start_time "NOT NULL"
        time end_time "NOT NULL"
        enum status "AVAILABLE|BOOKED|BLOCKED"
        uuid booking_id FK
        timestamp created_at
    }

    %% ========== BOOKING ==========
    BOOKING {
        uuid id PK
        varchar booking_code UK
        uuid pet_id FK
        uuid pet_owner_id FK
        uuid clinic_id FK
        uuid service_id FK
        uuid assigned_vet_id FK
        date booking_date "NOT NULL"
        time booking_time "NOT NULL"
        enum type "IN_CLINIC|HOME_VISIT"
        varchar home_address
        decimal home_lat
        decimal home_lng
        decimal distance_km
        decimal base_price "NOT NULL"
        decimal distance_fee "DEFAULT 0"
        decimal total_price "NOT NULL"
        enum status "PENDING|ASSIGNED|CONFIRMED|CHECK_IN|IN_PROGRESS|COMPLETED|CANCELLED|NO_SHOW"
        text notes
        timestamp created_at
    }

    PAYMENT {
        uuid id PK
        uuid booking_id FK
        decimal amount "NOT NULL"
        enum method "ONLINE|CASH"
        enum status "PENDING|PAID|REFUNDED|FAILED"
        varchar stripe_payment_id
        timestamp paid_at
        timestamp created_at
    }

    %% ========== MEDICAL RECORDS ==========
    EMR {
        uuid id PK
        uuid booking_id FK
        uuid pet_id FK
        uuid vet_id FK
        text diagnosis
        text treatment_plan
        text notes
        decimal weight_kg
        decimal temperature_c
        timestamp examination_date
        timestamp created_at
    }

    PRESCRIPTION {
        uuid id PK
        uuid emr_id FK
        varchar medicine_name "NOT NULL"
        varchar dosage "NOT NULL"
        varchar frequency "NOT NULL"
        int duration_days
        text instructions
        timestamp created_at
    }

    VACCINATION {
        uuid id PK
        uuid pet_id FK
        uuid vet_id FK
        uuid clinic_id FK
        uuid booking_id FK
        varchar vaccine_name "NOT NULL"
        date vaccination_date "NOT NULL"
        date next_due_date
        timestamp created_at
    }

    %% ========== REVIEW ==========
    REVIEW {
        uuid id PK
        uuid booking_id FK
        uuid reviewer_id FK
        enum type "VET|CLINIC"
        int rating "1-5"
        text comment
        timestamp created_at
    }

    NOTIFICATION {
        uuid id PK
        uuid user_id FK
        varchar title "NOT NULL"
        text content
        boolean is_read "DEFAULT FALSE"
        timestamp created_at
    }

    %% ========== RELATIONSHIPS ==========
    USER ||--o{ PET : "owns"
    USER ||--o{ CLINIC : "owns"
    USER ||--o{ CLINIC_STAFF : "works_as"
    USER ||--o{ VET_SHIFT : "works"
    USER ||--o{ BOOKING : "books"
    USER ||--o{ REVIEW : "writes"
    USER ||--o{ NOTIFICATION : "receives"

    CLINIC ||--o{ CLINIC_STAFF : "employs"
    CLINIC ||--o{ SERVICE : "offers"
    CLINIC ||--o{ VET_SHIFT : "schedules"
    CLINIC ||--o{ BOOKING : "receives"

    SERVICE ||--o{ BOOKING : "used_in"

    PET ||--o{ BOOKING : "has"
    PET ||--o{ EMR : "has"
    PET ||--o{ VACCINATION : "receives"

    VET_SHIFT ||--|{ SLOT : "contains"
    SLOT }o--|| BOOKING : "reserved_by"

    BOOKING ||--|| PAYMENT : "has"
    BOOKING ||--o| EMR : "generates"
    BOOKING ||--o{ REVIEW : "has"

    EMR ||--o{ PRESCRIPTION : "contains"
```

---

## 2. Entity Summary

| # | Entity | Description | Sprint |
|---|--------|-------------|--------|
| 1 | USER | Người dùng (5 roles) | 1 |
| 2 | CLINIC | Phòng khám thú y | 2 |
| 3 | CLINIC_STAFF | Nhân viên phòng khám | 3 |
| 4 | SERVICE | Dịch vụ khám | 2 |
| 5 | PET | Thú cưng | 2 |
| 6 | VET_SHIFT | Ca làm việc bác sĩ | 3 |
| 7 | SLOT | Slot thời gian 30 phút | 3 |
| 8 | BOOKING | Lịch hẹn khám | 4-6 |
| 9 | PAYMENT | Thanh toán | 8 |
| 10 | EMR | Hồ sơ bệnh án | 7 |
| 11 | PRESCRIPTION | Đơn thuốc | 7 |
| 12 | VACCINATION | Tiêm chủng | 7 |
| 13 | REVIEW | Đánh giá | 9 |
| 14 | NOTIFICATION | Thông báo | 9 |

---

## 3. Key Relationships

| From | To | Type | Description |
|------|-----|------|-------------|
| USER | PET | 1:N | User sở hữu nhiều pet |
| USER | CLINIC | 1:N | User (CLINIC_OWNER) sở hữu nhiều clinic |
| CLINIC | SERVICE | 1:N | Clinic có nhiều dịch vụ |
| CLINIC | CLINIC_STAFF (manager) | 1:1 | Mỗi clinic có 1 manager |
| CLINIC | CLINIC_STAFF | 1:N | Clinic có nhiều nhân viên |
| VET_SHIFT | SLOT | 1:N | Ca làm có nhiều slot 30 phút |
| BOOKING | PAYMENT | 1:1 | Mỗi booking có 1 payment |
| BOOKING | EMR | 1:0..1 | Booking có thể tạo 1 EMR |
| EMR | PRESCRIPTION | 1:N | EMR có nhiều đơn thuốc |

---

## 4. Booking Status Flow

```
PENDING → ASSIGNED → CONFIRMED → CHECK_IN → IN_PROGRESS → COMPLETED
                                     ↓
                                  NO_SHOW
    ↓ (any time before CHECK_IN)
CANCELLED
```

---

## 5. User Roles

| Role | Platform | Description |
|------|----------|-------------|
| PET_OWNER | Mobile | Chủ thú cưng, đặt lịch khám |
| VET | Mobile + Web | Bác sĩ thú y |
| CLINIC_MANAGER | Web | Quản lý phòng khám |
| CLINIC_OWNER | Web | Chủ phòng khám |
| ADMIN | Web | Admin nền tảng |

---

**Document Status:** MVP Ready  
**Next Phase:** Add AI Agent entities (Sprint 10-12)
