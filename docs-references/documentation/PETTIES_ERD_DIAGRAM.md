# PETTIES ERD - Database Schema Documentation

**Version:** 4.0 (Synchronized with Codebase)
**Last Updated:** 2026-03-10
**Scope:** All Features (Sprint 1-13) + Chat + Medical Records + AI Service
**Total Entities:** PostgreSQL: 21 Tables + 1 Embeddable | MongoDB: 4 Collections + 2 Embedded Docs | AI Service: 5 Tables
**Status:** Synchronized with JPA Entities & Flyway Migrations

---

## Executive Summary

Petties is a veterinary appointment booking platform connecting pet owners with veterinary clinics. The system uses a **hybrid database architecture**:

**Database Distribution:**
- **PostgreSQL 16:** Transactional data (Users, Clinics, Bookings, Payments, Scheduling, Reviews, Notifications, Auth)
- **MongoDB 7:** Document-based data (Chat Conversations, Chat Messages, EMR Records, Vaccination Records)

**Key Design Patterns:**
- **Soft Delete:** User, Clinic, Pet (via `deleted_at` + `@SQLDelete` / `@SQLRestriction`)
- **Optimistic Locking:** Booking, Clinic, ClinicService, ClinicPricePerKm (via `@Version` column)
- **Single Table Inheritance:** User entity (`@Inheritance(SINGLE_TABLE)`)
- **Shared PK via @MapsId:** ClinicPricePerKm shares PK with Clinic
- **JSONB:** Clinic.operating_hours stored as JSONB (Map of OperatingHours)
- **Denormalization:** MongoDB documents include clinic/staff names for read performance

---

## 1. Complete Mermaid ERD (Crow's Foot Notation)

```mermaid
erDiagram
    %% ========== USER & AUTH ==========
    USER {
        uuid user_id PK
        varchar username UK "NOT NULL, max 50"
        varchar password "NOT NULL"
        varchar phone UK "max 20"
        varchar email UK "max 100"
        varchar full_name "max 100"
        varchar avatar "max 500"
        varchar avatar_public_id "max 100"
        enum role "PET_OWNER|STAFF|CLINIC_MANAGER|CLINIC_OWNER|ADMIN"
        enum specialty "VET|GROOMER (nullable, STAFF only)"
        decimal rating_avg "precision(2,1) STAFF only"
        int rating_count "STAFF only"
        varchar fcm_token "max 500"
        varchar address "max 500 (PET_OWNER)"
        uuid working_clinic_id FK "nullable (STAFF, MANAGER)"
        timestamp created_at "NOT NULL"
        timestamp updated_at
        timestamp deleted_at "soft delete"
    }

    REFRESH_TOKEN {
        uuid token_id PK
        uuid user_id "NOT NULL"
        varchar token_hash UK "NOT NULL, max 255"
        timestamp expires_at "NOT NULL"
        timestamp created_at "NOT NULL"
    }

    BLACKLISTED_TOKEN {
        uuid token_id PK
        varchar token_hash UK "NOT NULL, max 255"
        uuid user_id "NOT NULL"
        timestamp expires_at "NOT NULL"
        timestamp created_at "NOT NULL"
    }

    %% ========== PET ==========
    PET {
        uuid pet_id PK
        uuid user_id FK "NOT NULL"
        varchar name "NOT NULL"
        enum species "DOG|CAT|BIRD|RABBIT|HAMSTER|FISH|OTHER"
        varchar breed "NOT NULL"
        date date_of_birth "NOT NULL"
        double weight "NOT NULL"
        varchar gender "NOT NULL"
        varchar color "max 100"
        text allergies
        varchar image_url
        varchar image_public_id
        timestamp created_at "NOT NULL"
        timestamp updated_at
        timestamp deleted_at "soft delete"
    }

    %% ========== CLINIC MANAGEMENT ==========
    CLINIC {
        uuid clinic_id PK
        uuid owner_id FK "NOT NULL"
        varchar name "NOT NULL, max 200"
        text description
        varchar address "NOT NULL, max 500"
        varchar ward "max 100"
        varchar district "max 100"
        varchar province "max 100"
        varchar specific_location "max 200"
        varchar phone "NOT NULL, max 20"
        varchar email "max 100"
        varchar bank_name "max 100"
        varchar account_number "max 50"
        decimal latitude "precision(10,8)"
        decimal longitude "precision(11,8)"
        varchar logo "max 500"
        varchar business_license_url "max 500"
        jsonb operating_hours "Map of OperatingHours"
        enum status "PENDING|APPROVED|REJECTED|SUSPENDED"
        text rejection_reason
        decimal rating_avg "precision(2,1) default 0"
        int rating_count "default 0"
        timestamp approved_at
        timestamp created_at "NOT NULL"
        timestamp updated_at
        timestamp deleted_at "soft delete"
        bigint version "optimistic locking"
    }

    CLINIC_IMAGE {
        uuid image_id PK
        uuid clinic_id FK "NOT NULL"
        varchar image_url "NOT NULL, max 500"
        varchar caption "max 200"
        int display_order "default 0"
        boolean is_primary "default false"
        timestamp created_at "NOT NULL"
    }

    CLINIC_PRICE_PER_KM {
        uuid clinic_id PK_FK "shares PK with Clinic via @MapsId"
        decimal price_per_km "precision(12,2)"
        decimal sos_fee "precision(12,2)"
        timestamp created_at
        timestamp updated_at
        bigint version "NOT NULL, default 0, optimistic locking"
    }

    %% ========== SERVICE MANAGEMENT ==========
    MASTER_SERVICE {
        uuid master_service_id PK
        varchar name "NOT NULL, max 200"
        text description
        decimal default_price "NOT NULL, precision(19,2)"
        int duration_time "NOT NULL (minutes)"
        int slots_required "NOT NULL"
        boolean is_home_visit "NOT NULL, default false"
        decimal default_price_per_km "precision(19,2)"
        varchar service_category "max 100 (stored as String)"
        varchar pet_type "max 100"
        varchar icon "max 100"
        timestamp created_at "NOT NULL"
        timestamp updated_at
    }

    CLINIC_SERVICE {
        uuid service_id PK
        uuid clinic_id FK "NOT NULL"
        uuid master_service_id FK "nullable"
        uuid vaccine_template_id FK "nullable"
        boolean is_custom "NOT NULL, default true"
        varchar name "NOT NULL, max 200"
        text description
        decimal base_price "NOT NULL, precision(19,2)"
        int duration_time "NOT NULL (minutes)"
        int slots_required "NOT NULL"
        boolean is_active "NOT NULL, default true"
        boolean is_home_visit "NOT NULL, default false"
        int reminder_interval "nullable"
        varchar reminder_unit "max 50"
        enum service_category "GROOMING_SPA|VACCINATION|CHECK_UP|SURGERY|DENTAL|DERMATOLOGY|OTHER"
        varchar pet_type "max 100"
        timestamp created_at "NOT NULL"
        timestamp updated_at
        bigint version "optimistic locking"
    }

    SERVICE_WEIGHT_PRICE {
        uuid weight_price_id PK
        uuid service_id FK "nullable"
        uuid master_service_id FK "nullable"
        decimal min_weight "NOT NULL, precision(10,2)"
        decimal max_weight "NOT NULL, precision(10,2)"
        decimal price "NOT NULL, precision(19,2)"
        timestamp created_at "NOT NULL"
        timestamp updated_at
    }

    VACCINE_TEMPLATE {
        uuid vaccine_template_id PK
        varchar name "NOT NULL, max 100"
        varchar manufacturer "max 100"
        text description
        decimal default_price "precision(19,2)"
        int min_age_weeks
        int repeat_interval_days
        int series_doses
        boolean is_annual_repeat "default false"
        int min_interval_days "default 14"
        enum target_species "DOG|CAT|BOTH"
        timestamp created_at "NOT NULL"
        timestamp updated_at
    }

    VACCINE_DOSE_PRICE {
        uuid id PK
        uuid service_id FK "NOT NULL"
        int dose_number "NOT NULL"
        varchar dose_label "max 50"
        decimal price "NOT NULL, precision(19,2)"
        boolean is_active "default true"
        timestamp created_at "NOT NULL"
        timestamp updated_at
    }

    %% ========== SCHEDULING ==========
    STAFF_SHIFT {
        uuid shift_id PK
        uuid staff_id FK "NOT NULL"
        uuid clinic_id FK "NOT NULL"
        date work_date "NOT NULL"
        time start_time "NOT NULL"
        time end_time "NOT NULL"
        time break_start
        time break_end
        boolean is_overnight "NOT NULL, default false"
        varchar notes "max 500"
        timestamp created_at "NOT NULL"
        timestamp updated_at
    }

    SLOT {
        uuid slot_id PK
        uuid shift_id FK "NOT NULL"
        time start_time "NOT NULL"
        time end_time "NOT NULL"
        enum status "AVAILABLE|BOOKED|BLOCKED"
        timestamp created_at "NOT NULL"
        timestamp updated_at
    }

    %% ========== BOOKING ==========
    BOOKING {
        uuid booking_id PK
        bigint version "optimistic locking"
        varchar booking_code UK "NOT NULL, max 20"
        uuid pet_id FK "NOT NULL"
        uuid pet_owner_id FK "NOT NULL"
        uuid clinic_id FK "nullable (SOS during SEARCHING)"
        uuid assigned_staff_id FK "nullable"
        uuid proxy_booker_id FK "nullable"
        date booking_date "NOT NULL"
        time booking_time "NOT NULL"
        enum type "IN_CLINIC|HOME_VISIT|SOS"
        varchar home_address
        decimal home_lat "precision(10,7)"
        decimal home_long "precision(10,7)"
        decimal distance_km "precision(5,2)"
        decimal distance_fee "precision(12,2)"
        decimal sos_fee "precision(12,2)"
        decimal total_price "NOT NULL, precision(12,2)"
        enum status "PENDING|SEARCHING|PENDING_CLINIC_CONFIRM|CONFIRMED|IN_PROGRESS|COMPLETED|CANCELLED|NO_SHOW"
        varchar cancellation_reason
        uuid cancelled_by "raw UUID, not FK"
        text notes
        text symptoms "SOS-specific"
        timestamp confirmed_at
        timestamp arrived_at
        timestamp created_at
    }

    BOOKING_SERVICE {
        uuid booking_service_id PK
        uuid booking_id FK "NOT NULL"
        uuid service_id FK "NOT NULL"
        uuid pet_id FK "nullable (multi-pet support)"
        uuid assigned_staff_id FK "nullable"
        decimal unit_price "NOT NULL, precision(12,2)"
        decimal base_price "precision(12,2)"
        decimal weight_price "precision(12,2)"
        int quantity "NOT NULL, default 1"
        boolean is_add_on "default false"
        timestamp created_at
    }

    BOOKING_SLOT {
        uuid booking_slot_id PK
        uuid booking_id FK "NOT NULL"
        uuid slot_id FK "NOT NULL"
        uuid booking_service_id FK "nullable"
        timestamp created_at
    }

    %% ========== PAYMENT & REVIEW ==========
    PAYMENT {
        uuid payment_id PK
        uuid booking_id FK_UK "NOT NULL, unique (1:1)"
        decimal amount "NOT NULL, precision(12,2)"
        varchar payment_description "max 100"
        enum method "CASH|QR|CARD"
        enum status "PENDING|PAID|REFUNDED|FAILED"
        varchar stripe_payment_id
        timestamp paid_at
        timestamp created_at
    }

    REVIEW {
        uuid review_id PK
        uuid booking_id FK_UK "NOT NULL, unique (1:1)"
        uuid clinic_id FK "NOT NULL"
        uuid user_id FK "NOT NULL"
        int rating "NOT NULL (1-5)"
        text comment
        timestamp created_at
    }

    %% ========== NOTIFICATION ==========
    NOTIFICATION {
        uuid notification_id PK
        uuid user_id FK "NOT NULL"
        uuid clinic_id FK "nullable"
        uuid shift_id FK "nullable"
        varchar emr_id "MongoDB ObjectId as string"
        enum type "see NotificationType enum"
        text message "NOT NULL"
        text reason
        boolean read "NOT NULL, default false"
        varchar action_type "max 50"
        text action_data "JSON payload"
        timestamp created_at "NOT NULL"
    }

    %% ========== CHAT (PostgreSQL settings only) ==========
    CHAT_AUTO_REPLY_SETTING {
        uuid setting_id PK
        uuid clinic_id FK_UK "NOT NULL, unique"
        boolean quick_reply_enabled "NOT NULL, default true"
        text quick_reply_message
        boolean away_message_enabled "NOT NULL, default false"
        enum away_condition "OFF_HOURS|ALWAYS"
        text away_message
        text action_buttons "JSON string"
        timestamp created_at "NOT NULL"
        timestamp updated_at
    }

    %% ========== RELATIONSHIPS ==========
    USER ||--o{ PET : "owns"
    USER ||--o{ CLINIC : "owns (as CLINIC_OWNER)"
    CLINIC ||--o{ USER : "employs (working_clinic_id)"
    CLINIC ||--o{ CLINIC_IMAGE : "has"
    CLINIC ||--|| CLINIC_PRICE_PER_KM : "has distance pricing"
    CLINIC ||--o{ CLINIC_SERVICE : "offers"
    CLINIC ||--o{ STAFF_SHIFT : "schedules"
    CLINIC ||--o{ NOTIFICATION : "triggers"
    CLINIC ||--|| CHAT_AUTO_REPLY_SETTING : "configures"

    MASTER_SERVICE ||--o{ CLINIC_SERVICE : "templates"
    MASTER_SERVICE ||--o{ SERVICE_WEIGHT_PRICE : "has weight pricing"
    CLINIC_SERVICE ||--o{ SERVICE_WEIGHT_PRICE : "has weight pricing"
    CLINIC_SERVICE ||--o{ VACCINE_DOSE_PRICE : "has dose pricing"
    VACCINE_TEMPLATE ||--o{ CLINIC_SERVICE : "linked"

    USER ||--o{ STAFF_SHIFT : "works (as STAFF)"
    STAFF_SHIFT ||--o{ SLOT : "generates"

    PET ||--o{ BOOKING : "booked for"
    USER ||--o{ BOOKING : "books (as PET_OWNER)"
    USER ||--o{ BOOKING : "assigned (as STAFF)"
    USER ||--o{ BOOKING : "proxy books"
    CLINIC ||--o{ BOOKING : "receives"
    BOOKING ||--o{ BOOKING_SERVICE : "includes"
    BOOKING ||--o{ BOOKING_SLOT : "reserves"
    BOOKING ||--|| PAYMENT : "paid via"
    BOOKING ||--o| REVIEW : "reviewed"

    BOOKING_SERVICE }o--|| CLINIC_SERVICE : "references"
    BOOKING_SERVICE }o--o| PET : "for pet"
    BOOKING_SERVICE }o--o| USER : "assigned staff"
    BOOKING_SLOT }o--|| SLOT : "reserves"
    BOOKING_SLOT }o--o| BOOKING_SERVICE : "for service"

    REVIEW }o--|| CLINIC : "about"
    REVIEW }o--|| USER : "written by"

    USER ||--o{ NOTIFICATION : "receives"
    STAFF_SHIFT ||--o{ NOTIFICATION : "related to"
```

---

## 2. Detailed Entity Descriptions

### 2.1 PostgreSQL Entities (21 tables)

---

#### 2.1.1 USER (users)

**Purpose:** Central user entity using Single Table Inheritance for all roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | UUID | PK | Primary key |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | Login username |
| `password` | VARCHAR(255) | NOT NULL | Hashed password |
| `phone` | VARCHAR(20) | UNIQUE | Phone number |
| `email` | VARCHAR(100) | UNIQUE | Email address |
| `full_name` | VARCHAR(100) | | Display name |
| `avatar` | VARCHAR(500) | | Avatar URL |
| `avatar_public_id` | VARCHAR(100) | | Cloudinary public ID |
| `role` | ENUM | NOT NULL | PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN |
| `specialty` | ENUM | nullable | VET, GROOMER (STAFF role only) |
| `rating_avg` | DECIMAL(2,1) | | Average rating (STAFF only) |
| `rating_count` | INTEGER | | Total ratings received (STAFF only) |
| `fcm_token` | VARCHAR(500) | | Firebase Cloud Messaging token |
| `address` | VARCHAR(500) | | Home address (PET_OWNER) |
| `working_clinic_id` | UUID | FK -> clinics | Clinic where STAFF/MANAGER works |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |
| `deleted_at` | TIMESTAMP | | Soft delete marker |

**Patterns:** Soft delete (`@SQLDelete`, `@SQLRestriction`), JPA Auditing, Single Table Inheritance

---

#### 2.1.2 CLINIC (clinics)

**Purpose:** Veterinary clinic/hospital entity.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `clinic_id` | UUID | PK | Primary key |
| `owner_id` | UUID | FK -> users, NOT NULL | Clinic owner |
| `name` | VARCHAR(200) | NOT NULL | Clinic name |
| `description` | TEXT | | Detailed description |
| `address` | VARCHAR(500) | NOT NULL | Full address |
| `ward` | VARCHAR(100) | | Ward/commune |
| `district` | VARCHAR(100) | | District |
| `province` | VARCHAR(100) | | Province/city |
| `specific_location` | VARCHAR(200) | | Specific location details |
| `phone` | VARCHAR(20) | NOT NULL | Contact phone |
| `email` | VARCHAR(100) | | Contact email |
| `bank_name` | VARCHAR(100) | | Bank name for payments |
| `account_number` | VARCHAR(50) | | Bank account number |
| `latitude` | DECIMAL(10,8) | | GPS latitude |
| `longitude` | DECIMAL(11,8) | | GPS longitude |
| `logo` | VARCHAR(500) | | Logo URL |
| `business_license_url` | VARCHAR(500) | | Business license document URL |
| `operating_hours` | JSONB | | Map<DayOfWeek, OperatingHours> |
| `status` | ENUM | NOT NULL, default PENDING | PENDING, APPROVED, REJECTED, SUSPENDED |
| `rejection_reason` | TEXT | | Reason if rejected |
| `rating_avg` | DECIMAL(2,1) | default 0 | Average clinic rating |
| `rating_count` | INTEGER | default 0 | Total reviews |
| `approved_at` | TIMESTAMP | | When approved by admin |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |
| `deleted_at` | TIMESTAMP | | Soft delete marker |
| `version` | BIGINT | default 0 | Optimistic locking |

**OperatingHours (Embedded JSONB):**
```json
{
  "MONDAY": {"openTime": "08:00", "closeTime": "17:00", "breakStart": "12:00", "breakEnd": "13:00", "isClosed": false},
  "SUNDAY": {"openTime": null, "closeTime": null, "breakStart": null, "breakEnd": null, "isClosed": true}
}
```

---

#### 2.1.3 PET (pets)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `pet_id` | UUID | PK | Primary key |
| `user_id` | UUID | FK -> users, NOT NULL | Pet owner |
| `name` | VARCHAR(255) | NOT NULL | Pet name |
| `species` | ENUM | NOT NULL | DOG, CAT, BIRD, RABBIT, HAMSTER, FISH, OTHER |
| `breed` | VARCHAR(255) | NOT NULL | Breed |
| `date_of_birth` | DATE | NOT NULL | Birth date |
| `weight` | DOUBLE | NOT NULL | Weight in kg |
| `gender` | VARCHAR(255) | NOT NULL | Gender |
| `color` | VARCHAR(100) | | Fur/skin color |
| `allergies` | TEXT | | Known allergies |
| `image_url` | VARCHAR(255) | | Pet photo URL |
| `image_public_id` | VARCHAR(255) | | Cloudinary public ID |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |
| `deleted_at` | TIMESTAMP | | Soft delete marker |

---

#### 2.1.4 CLINIC_IMAGE (clinic_images)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `image_id` | UUID | PK | Primary key |
| `clinic_id` | UUID | FK -> clinics, NOT NULL | Parent clinic |
| `image_url` | VARCHAR(500) | NOT NULL | Image URL |
| `caption` | VARCHAR(200) | | Image caption |
| `display_order` | INTEGER | default 0 | Display order |
| `is_primary` | BOOLEAN | default false | Primary image flag |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |

---

#### 2.1.5 CLINIC_PRICE_PER_KM (clinic_price_per_km)

**Pattern:** Shares PK with Clinic via `@MapsId` (1:1 relationship)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `clinic_id` | UUID | PK, FK -> clinics | Shared PK with Clinic |
| `price_per_km` | DECIMAL(12,2) | | Price per kilometer |
| `sos_fee` | DECIMAL(12,2) | | SOS emergency fee |
| `created_at` | TIMESTAMP | | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |
| `version` | BIGINT | NOT NULL, default 0 | Optimistic locking |

---

#### 2.1.6 MASTER_SERVICE (master_services)

**Purpose:** System-wide service templates that clinics can inherit.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `master_service_id` | UUID | PK | Primary key |
| `name` | VARCHAR(200) | NOT NULL | Service name |
| `description` | TEXT | | Description |
| `default_price` | DECIMAL(19,2) | NOT NULL | Default price |
| `duration_time` | INTEGER | NOT NULL | Duration in minutes |
| `slots_required` | INTEGER | NOT NULL | Number of slots needed |
| `is_home_visit` | BOOLEAN | NOT NULL, default false | Home visit capable |
| `default_price_per_km` | DECIMAL(19,2) | | Default distance price |
| `service_category` | VARCHAR(100) | | Category (stored as String) |
| `pet_type` | VARCHAR(100) | | Target pet type |
| `icon` | VARCHAR(100) | | Icon identifier |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |

---

#### 2.1.7 CLINIC_SERVICE (clinic_services)

**Purpose:** Clinic-specific services, optionally inherited from MasterService.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `service_id` | UUID | PK | Primary key |
| `clinic_id` | UUID | FK -> clinics, NOT NULL | Parent clinic |
| `master_service_id` | UUID | FK -> master_services | Template reference |
| `vaccine_template_id` | UUID | FK -> vaccine_templates | Vaccine link |
| `is_custom` | BOOLEAN | NOT NULL, default true | Custom or inherited |
| `name` | VARCHAR(200) | NOT NULL | Service name |
| `description` | TEXT | | Description |
| `base_price` | DECIMAL(19,2) | NOT NULL | Base price |
| `duration_time` | INTEGER | NOT NULL | Duration in minutes |
| `slots_required` | INTEGER | NOT NULL | Slots needed |
| `is_active` | BOOLEAN | NOT NULL, default true | Active flag |
| `is_home_visit` | BOOLEAN | NOT NULL, default false | Home visit capable |
| `reminder_interval` | INTEGER | | Reminder interval value |
| `reminder_unit` | VARCHAR(50) | | Reminder unit (e.g., "DAYS") |
| `service_category` | ENUM | | GROOMING_SPA, VACCINATION, CHECK_UP, SURGERY, DENTAL, DERMATOLOGY, OTHER |
| `pet_type` | VARCHAR(100) | | Target pet type |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |
| `version` | BIGINT | default 0 | Optimistic locking |

---

#### 2.1.8 SERVICE_WEIGHT_PRICE (service_weight_prices)

**Purpose:** Weight-based pricing tiers for services.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `weight_price_id` | UUID | PK | Primary key |
| `service_id` | UUID | FK -> clinic_services | Clinic service (nullable) |
| `master_service_id` | UUID | FK -> master_services | Master service (nullable) |
| `min_weight` | DECIMAL(10,2) | NOT NULL | Minimum weight (kg) |
| `max_weight` | DECIMAL(10,2) | NOT NULL | Maximum weight (kg) |
| `price` | DECIMAL(19,2) | NOT NULL | Price for this tier |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |

---

#### 2.1.9 VACCINE_TEMPLATE (vaccine_templates)

**Purpose:** Master vaccine data (doses, intervals, species).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `vaccine_template_id` | UUID | PK | Primary key |
| `name` | VARCHAR(100) | NOT NULL | Vaccine name |
| `manufacturer` | VARCHAR(100) | | Manufacturer |
| `description` | TEXT | | Description |
| `default_price` | DECIMAL(19,2) | | Default price |
| `min_age_weeks` | INTEGER | | Minimum age in weeks |
| `repeat_interval_days` | INTEGER | | Days between doses |
| `series_doses` | INTEGER | | Total doses in series |
| `is_annual_repeat` | BOOLEAN | default false | Annual booster needed |
| `min_interval_days` | INTEGER | default 14 | Minimum days between doses |
| `target_species` | ENUM | NOT NULL | DOG, CAT, BOTH |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |

---

#### 2.1.10 VACCINE_DOSE_PRICE (vaccine_dose_prices)

**Purpose:** Price per dose number for vaccine services.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Primary key |
| `service_id` | UUID | FK -> clinic_services, NOT NULL | Parent service |
| `dose_number` | INTEGER | NOT NULL, UNIQUE(service_id, dose_number) | Dose number (1, 2, 3, 4=booster) |
| `dose_label` | VARCHAR(50) | | e.g., "Mui 1", "Nhac lai hang nam" |
| `price` | DECIMAL(19,2) | NOT NULL | Price for this dose |
| `is_active` | BOOLEAN | default true | Active flag |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |

---

#### 2.1.11 STAFF_SHIFT (staff_shifts)

**Purpose:** Staff work schedules, auto-generates time slots.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `shift_id` | UUID | PK | Primary key |
| `staff_id` | UUID | FK -> users, NOT NULL | Staff member |
| `clinic_id` | UUID | FK -> clinics, NOT NULL | Clinic |
| `work_date` | DATE | NOT NULL | Work date |
| `start_time` | TIME | NOT NULL | Shift start |
| `end_time` | TIME | NOT NULL | Shift end |
| `break_start` | TIME | | Break start (optional) |
| `break_end` | TIME | | Break end (optional) |
| `is_overnight` | BOOLEAN | NOT NULL, default false | Overnight shift flag |
| `notes` | VARCHAR(500) | | Shift notes |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |

**Indexes:** `idx_shift_staff_date` (staff_id, work_date), `idx_shift_clinic_date` (clinic_id, work_date)

---

#### 2.1.12 SLOT (slots)

**Purpose:** 30-minute bookable time slots, auto-generated from shifts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `slot_id` | UUID | PK | Primary key |
| `shift_id` | UUID | FK -> staff_shifts, NOT NULL, ON DELETE CASCADE | Parent shift |
| `start_time` | TIME | NOT NULL | Slot start |
| `end_time` | TIME | NOT NULL | Slot end |
| `status` | ENUM | NOT NULL, default AVAILABLE | AVAILABLE, BOOKED, BLOCKED |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |

**Indexes:** `idx_slot_shift` (shift_id), `idx_slot_status` (status), `idx_slot_time` (start_time, end_time)

---

#### 2.1.13 BOOKING (bookings)

**Purpose:** Core booking entity for appointments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `booking_id` | UUID | PK | Primary key |
| `version` | BIGINT | NOT NULL, default 0 | Optimistic locking |
| `booking_code` | VARCHAR(20) | NOT NULL, UNIQUE | Human-readable code |
| `pet_id` | UUID | FK -> pets, NOT NULL | Primary pet |
| `pet_owner_id` | UUID | FK -> users, NOT NULL | Pet owner |
| `clinic_id` | UUID | FK -> clinics | Nullable for SOS during SEARCHING |
| `assigned_staff_id` | UUID | FK -> users | Assigned staff member |
| `proxy_booker_id` | UUID | FK -> users | Proxy booker (null if self-booked) |
| `booking_date` | DATE | NOT NULL | Appointment date |
| `booking_time` | TIME | NOT NULL | Appointment time |
| `type` | ENUM | NOT NULL | IN_CLINIC, HOME_VISIT, SOS |
| `home_address` | TEXT | | Home visit address |
| `home_lat` | DECIMAL(10,7) | | Home GPS latitude |
| `home_long` | DECIMAL(10,7) | | Home GPS longitude |
| `distance_km` | DECIMAL(5,2) | | Distance in km |
| `distance_fee` | DECIMAL(12,2) | | Calculated distance fee |
| `sos_fee` | DECIMAL(12,2) | | SOS emergency fee |
| `total_price` | DECIMAL(12,2) | NOT NULL | Final total price |
| `status` | ENUM(30) | NOT NULL, default PENDING | See Booking Status Flow |
| `cancellation_reason` | TEXT | | Reason for cancellation |
| `cancelled_by` | UUID | | Who cancelled (raw UUID) |
| `notes` | TEXT | | General notes |
| `symptoms` | TEXT | | SOS-specific symptoms |
| `confirmed_at` | TIMESTAMP | | When clinic confirmed |
| `arrived_at` | TIMESTAMP | | When staff arrived |
| `created_at` | TIMESTAMP | | Auto-generated |

**Indexes:** pet_id, pet_owner_id, clinic_id, assigned_staff_id, booking_date, status, proxy_booker_id
**Partial Unique Index:** `unique_active_booking_per_pet_time` on (pet_id, clinic_id, booking_date, booking_time) WHERE status NOT IN ('CANCELLED', 'NO_SHOW') AND type = 'IN_CLINIC'

---

#### 2.1.14 BOOKING_SERVICE (booking_services)

**Purpose:** Junction table for services included in a booking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `booking_service_id` | UUID | PK | Primary key |
| `booking_id` | UUID | FK -> bookings, NOT NULL | Parent booking |
| `service_id` | UUID | FK -> clinic_services, NOT NULL | Service |
| `pet_id` | UUID | FK -> pets | Per-service pet (multi-pet) |
| `assigned_staff_id` | UUID | FK -> users | Staff for this service |
| `unit_price` | DECIMAL(12,2) | NOT NULL | Final unit price |
| `base_price` | DECIMAL(12,2) | | Original base price |
| `weight_price` | DECIMAL(12,2) | | Weight-based price tier |
| `quantity` | INTEGER | NOT NULL, default 1 | Service quantity |
| `is_add_on` | BOOLEAN | default false | Added during visit |
| `created_at` | TIMESTAMP | | Auto-generated |

---

#### 2.1.15 BOOKING_SLOT (booking_slots)

**Purpose:** Junction table linking bookings to time slots.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `booking_slot_id` | UUID | PK | Primary key |
| `booking_id` | UUID | FK -> bookings, NOT NULL | Parent booking |
| `slot_id` | UUID | FK -> slots, NOT NULL | Reserved slot |
| `booking_service_id` | UUID | FK -> booking_services | Linked service item |
| `created_at` | TIMESTAMP | | Auto-generated |

**Unique constraint:** (booking_id, slot_id)

---

#### 2.1.16 PAYMENT (payments)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `payment_id` | UUID | PK | Primary key |
| `booking_id` | UUID | FK -> bookings, NOT NULL, UNIQUE | 1:1 with booking |
| `amount` | DECIMAL(12,2) | NOT NULL | Payment amount |
| `payment_description` | VARCHAR(100) | | SePay QR matching description |
| `method` | ENUM | NOT NULL | CASH, QR, CARD |
| `status` | ENUM | NOT NULL, default PENDING | PENDING, PAID, REFUNDED, FAILED |
| `stripe_payment_id` | VARCHAR(255) | | External payment ID |
| `paid_at` | TIMESTAMP | | Payment timestamp |
| `created_at` | TIMESTAMP | | Auto-generated |

---

#### 2.1.17 REVIEW (reviews)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `review_id` | UUID | PK | Primary key |
| `booking_id` | UUID | FK -> bookings, NOT NULL, UNIQUE | 1:1 with booking |
| `clinic_id` | UUID | FK -> clinics, NOT NULL | Reviewed clinic |
| `user_id` | UUID | FK -> users, NOT NULL | Reviewer |
| `rating` | INTEGER | NOT NULL | Rating 1-5 |
| `comment` | TEXT | | Review text |
| `created_at` | TIMESTAMP | | Auto-generated |

---

#### 2.1.18 NOTIFICATION (notifications)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `notification_id` | UUID | PK | Primary key |
| `user_id` | UUID | FK -> users, NOT NULL | Recipient |
| `clinic_id` | UUID | FK -> clinics | Related clinic (nullable) |
| `shift_id` | UUID | FK -> staff_shifts | Related shift (nullable) |
| `emr_id` | VARCHAR(100) | | MongoDB ObjectId reference |
| `type` | ENUM | NOT NULL | See NotificationType enum |
| `message` | TEXT | NOT NULL | Notification message |
| `reason` | TEXT | | Additional context |
| `read` | BOOLEAN | NOT NULL, default false | Read status |
| `action_type` | VARCHAR(50) | | e.g., QUICK_BOOKING, INFO_ONLY |
| `action_data` | TEXT | | JSON payload for actions |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |

**Indexes:** idx_notification_user, idx_notification_type, idx_notification_read, idx_notification_shift, idx_notifications_emr_id

---

#### 2.1.19 CHAT_AUTO_REPLY_SETTING (chat_auto_reply_settings)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `setting_id` | UUID | PK | Primary key |
| `clinic_id` | UUID | FK -> clinics, NOT NULL, UNIQUE | One setting per clinic |
| `quick_reply_enabled` | BOOLEAN | NOT NULL, default true | Enable quick replies |
| `quick_reply_message` | TEXT | | Quick reply content |
| `away_message_enabled` | BOOLEAN | NOT NULL, default false | Enable away messages |
| `away_condition` | ENUM | NOT NULL, default OFF_HOURS | OFF_HOURS, ALWAYS |
| `away_message` | TEXT | | Away message content |
| `action_buttons` | TEXT | | JSON array of action buttons |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-updated |

---

#### 2.1.20 REFRESH_TOKEN (refresh_tokens)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `token_id` | UUID | PK | Primary key |
| `user_id` | UUID | NOT NULL | User (raw UUID, not JPA FK) |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE | Hashed token |
| `expires_at` | TIMESTAMP | NOT NULL | Expiration time |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |

**Indexes:** idx_refresh_tokens_user_id, idx_refresh_tokens_token_hash

---

#### 2.1.21 BLACKLISTED_TOKEN (blacklisted_tokens)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `token_id` | UUID | PK | Primary key |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE | Hashed token |
| `user_id` | UUID | NOT NULL | User (raw UUID, not JPA FK) |
| `expires_at` | TIMESTAMP | NOT NULL | Expiration time |
| `created_at` | TIMESTAMP | NOT NULL | Auto-generated |

**Indexes:** idx_blacklisted_tokens_token_hash, idx_blacklisted_tokens_user_id

---

### 2.2 MongoDB Collections (4 collections)

---

#### 2.2.1 CHAT_CONVERSATION (chat_conversations)

**Purpose:** Pet Owner <-> Clinic chat threads. One conversation per (petOwner, clinic) pair.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated |
| `petOwnerId` | UUID | Pet owner |
| `clinicId` | UUID | Clinic |
| `clinicName` | String | Denormalized clinic name |
| `clinicLogo` | String | Denormalized clinic logo |
| `petOwnerName` | String | Denormalized pet owner name |
| `petOwnerAvatar` | String | Denormalized pet owner avatar |
| `lastMessage` | String | Last message preview |
| `lastMessageSender` | String | PET_OWNER or CLINIC |
| `lastMessageAt` | DateTime | Last message timestamp |
| `unreadCountPetOwner` | int | Unread count for pet owner, default 0 |
| `unreadCountClinic` | int | Unread count for clinic, default 0 |
| `petOwnerOnline` | boolean | Pet owner online status, default false |
| `clinicOnline` | boolean | Clinic online status, default false |
| `lastAutoReplyAt` | DateTime | Last auto-reply timestamp |
| `lastAutoReplyType` | String | QUICK_REPLY or AWAY_MESSAGE |
| `createdAt` | DateTime | Auto-generated |
| `updatedAt` | DateTime | Auto-updated |

**Indexes:**
- Unique compound: `{petOwnerId: 1, clinicId: 1}`
- Compound: `{lastMessageAt: -1}`
- Individual: `petOwnerId`, `clinicId`

---

#### 2.2.2 CHAT_MESSAGE (chat_messages)

**Purpose:** Individual chat messages within a conversation.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated |
| `chatBoxId` | String | Reference to conversation ID |
| `senderId` | UUID | Message sender |
| `senderType` | Enum | PET_OWNER, CLINIC |
| `senderName` | String | Denormalized sender name |
| `senderAvatar` | String | Denormalized sender avatar |
| `content` | String | Message text |
| `messageType` | Enum | TEXT, IMAGE, IMAGE_TEXT (default TEXT) |
| `imageUrl` | String | Image URL (if IMAGE/IMAGE_TEXT) |
| `status` | Enum | SENT, DELIVERED, SEEN (default SENT) |
| `isRead` | boolean | Read flag, default false |
| `readAt` | DateTime | When message was read |
| `actionButtons` | List<ActionButton> | Interactive buttons |
| `createdAt` | DateTime | Auto-generated |

**ActionButton (embedded):**
| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Button ID |
| `label` | String | Button label |
| `type` | String | MENU, OFFER, BOOKING, CUSTOM |

**Indexes:**
- Compound: `{chatBoxId: 1, createdAt: -1}`
- Compound: `{chatBoxId: 1, isRead: 1}`
- Individual: `chatBoxId`

---

#### 2.2.3 EMR_RECORD (emr_records)

**Purpose:** Electronic Medical Records for pet examinations (SOAP notes format).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated |
| `petId` | UUID | Pet |
| `bookingId` | UUID | Related booking |
| `staffId` | UUID | Examining staff |
| `clinicId` | UUID | Clinic |
| `clinicName` | String | Denormalized clinic name |
| `staffName` | String | Denormalized staff name |
| `subjective` | String | S - Symptoms described by owner |
| `objective` | String | O - Clinical observations |
| `assessment` | String | A - Diagnosis |
| `plan` | String | P - Treatment plan |
| `notes` | String | Additional notes |
| `weightKg` | BigDecimal | Weight at examination |
| `temperatureC` | BigDecimal | Temperature |
| `heartRate` | Integer | Heart rate (bpm) |
| `bcs` | Integer | Body Condition Score (1-9) |
| `images` | List<EmrImage> | Examination images |
| `prescriptions` | List<Prescription> | Prescribed medications |
| `examinationDate` | DateTime | Examination date |
| `reExaminationDate` | DateTime | Scheduled re-examination |
| `createdAt` | DateTime | Auto-generated |

**EmrImage (embedded):**
| Field | Type | Description |
|-------|------|-------------|
| `url` | String | Image URL |
| `description` | String | Image description |

**Prescription (embedded):**
| Field | Type | Description |
|-------|------|-------------|
| `medicineName` | String | Medicine name |
| `dosage` | String | Dosage instructions |
| `frequency` | String | Frequency (e.g., "2x/day") |
| `durationDays` | Integer | Duration in days |
| `instructions` | String | Special instructions |

**Indexes:** Individual on `petId`, `bookingId`

---

#### 2.2.4 VACCINATION_RECORD (vaccination_records)

**Purpose:** Vaccination event records, aggregated per pet = vaccination card.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated |
| `petId` | UUID | Pet |
| `bookingId` | UUID | Related booking |
| `staffId` | UUID | Administering staff |
| `clinicId` | UUID | Clinic |
| `clinicName` | String | Denormalized clinic name |
| `staffName` | String | Denormalized staff name |
| `vaccineName` | String | Vaccine name |
| `batchNumber` | String | Vaccine batch for tracking |
| `status` | String | PENDING, COMPLETED |
| `vaccinationDate` | Date | Date administered |
| `nextDueDate` | Date | Next dose due date |
| `reminderSent` | Boolean | Reminder sent flag |
| `notes` | String | Additional notes |
| `vaccineTemplateId` | UUID | Link to VaccineTemplate |
| `doseNumber` | Integer | e.g., 1, 2, 3 |
| `totalDoses` | Integer | Total in series |
| `seriesId` | UUID | Groups related doses |
| `createdAt` | DateTime | Auto-generated |

**Indexes:** Individual on `petId`, `nextDueDate`

---

## 3. Entity Summary Table

### PostgreSQL Tables (21)

| # | Entity | Table Name | PK | Soft Delete | Version | Category |
|---|--------|------------|-----|-------------|---------|----------|
| 1 | User | users | user_id | Yes | No | Auth |
| 2 | RefreshToken | refresh_tokens | token_id | No | No | Auth |
| 3 | BlacklistedToken | blacklisted_tokens | token_id | No | No | Auth |
| 4 | Pet | pets | pet_id | Yes | No | Pet |
| 5 | Clinic | clinics | clinic_id | Yes | Yes | Clinic |
| 6 | ClinicImage | clinic_images | image_id | No | No | Clinic |
| 7 | ClinicPricePerKm | clinic_price_per_km | clinic_id (@MapsId) | No | Yes | Clinic |
| 8 | MasterService | master_services | master_service_id | No | No | Service |
| 9 | ClinicService | clinic_services | service_id | No | Yes | Service |
| 10 | ServiceWeightPrice | service_weight_prices | weight_price_id | No | No | Service |
| 11 | VaccineTemplate | vaccine_templates | vaccine_template_id | No | No | Service |
| 12 | VaccineDosePrice | vaccine_dose_prices | id | No | No | Service |
| 13 | StaffShift | staff_shifts | shift_id | No | No | Scheduling |
| 14 | Slot | slots | slot_id | No | No | Scheduling |
| 15 | Booking | bookings | booking_id | No | Yes | Booking |
| 16 | BookingServiceItem | booking_services | booking_service_id | No | No | Booking |
| 17 | BookingSlot | booking_slots | booking_slot_id | No | No | Booking |
| 18 | Payment | payments | payment_id | No | No | Payment |
| 19 | Review | reviews | review_id | No | No | Review |
| 20 | Notification | notifications | notification_id | No | No | Notification |
| 21 | ChatAutoReplySetting | chat_auto_reply_settings | setting_id | No | No | Chat |

### MongoDB Collections (4)

| # | Document | Collection Name | Category |
|---|----------|-----------------|----------|
| 1 | ChatConversation | chat_conversations | Chat |
| 2 | ChatMessage | chat_messages | Chat |
| 3 | EmrRecord | emr_records | Medical |
| 4 | VaccinationRecord | vaccination_records | Medical |

---

## 4. Enum Types (16 total)

### Backend Enums (15 in enums package + 3 inner enums)

| # | Enum | Values | Used By |
|---|------|--------|---------|
| 1 | Role | PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN | User.role |
| 2 | StaffSpecialty | VET, GROOMER | User.specialty |
| 3 | ClinicStatus | PENDING, APPROVED, REJECTED, SUSPENDED | Clinic.status |
| 4 | PetSpecies | DOG, CAT, BIRD, RABBIT, HAMSTER, FISH, OTHER | Pet.species |
| 5 | ServiceCategory | GROOMING_SPA, VACCINATION, CHECK_UP, SURGERY, DENTAL, DERMATOLOGY, OTHER | ClinicService.serviceCategory |
| 6 | TargetSpecies | DOG, CAT, BOTH | VaccineTemplate.targetSpecies |
| 7 | AutoReplyCondition | OFF_HOURS, ALWAYS | ChatAutoReplySetting.awayCondition |
| 8 | SlotStatus | AVAILABLE, BOOKED, BLOCKED | Slot.status |
| 9 | BookingType | IN_CLINIC, HOME_VISIT, SOS | Booking.type |
| 10 | BookingStatus | PENDING, SEARCHING, PENDING_CLINIC_CONFIRM, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW | Booking.status |
| 11 | PaymentMethod | CASH, QR, CARD | Payment.method |
| 12 | PaymentStatus | PENDING, PAID, REFUNDED, FAILED | Payment.status |
| 13 | NotificationType | APPROVED, REJECTED, PENDING, CLINIC_PENDING_APPROVAL, STAFF_SHIFT_ASSIGNED, STAFF_SHIFT_UPDATED, STAFF_SHIFT_DELETED, BOOKING_CREATED, BOOKING_CONFIRMED, BOOKING_CANCELLED, BOOKING_CHECKIN, BOOKING_COMPLETED, STAFF_ON_WAY, STAFF_ARRIVED, BOOKING_ASSIGNED, CLINIC_VERIFIED, RE_EXAMINATION_REMINDER, VACCINATION_REMINDER | Notification.type |
| 14 | StaffRole | STAFF, CLINIC_MANAGER | (utility enum) |
| 15 | StaffStatus | ACTIVE, INACTIVE | (utility enum) |
| 16 | PetStatus | ACTIVE, INACTIVE, DECEASED, REHOMED, LOST | (utility enum) |
| 17 | Gender | MALE, FEMALE, UNKNOWN | (utility enum) |

**ChatMessage Inner Enums (MongoDB):**

| Enum | Values |
|------|--------|
| SenderType | PET_OWNER, CLINIC |
| MessageStatus | SENT, DELIVERED, SEEN |
| MessageType | TEXT, IMAGE, IMAGE_TEXT |

**DB CHECK constraint additional types** (in DB but not in JPA NotificationType enum): `BOOKING_REMINDER`, `SYSTEM`, `PROMOTION`

---

## 5. Relationship Matrix

### User & Ownership

| From | To | Type | FK Column | Notes |
|------|----|------|-----------|-------|
| User | Clinic | 1:N | clinics.owner_id | CLINIC_OWNER owns clinics |
| User | Clinic | N:1 | users.working_clinic_id | STAFF/MANAGER works at clinic |
| User | Pet | 1:N | pets.user_id | PET_OWNER owns pets |

### Clinic Operations

| From | To | Type | FK Column | Notes |
|------|----|------|-----------|-------|
| Clinic | ClinicImage | 1:N | clinic_images.clinic_id | Orphan removal |
| Clinic | ClinicPricePerKm | 1:1 | clinic_price_per_km.clinic_id | @MapsId shared PK |
| Clinic | ClinicService | 1:N | clinic_services.clinic_id | |
| Clinic | StaffShift | 1:N | staff_shifts.clinic_id | |
| Clinic | ChatAutoReplySetting | 1:1 | chat_auto_reply_settings.clinic_id | Unique |

### Service Management

| From | To | Type | FK Column | Notes |
|------|----|------|-----------|-------|
| MasterService | ClinicService | 1:N | clinic_services.master_service_id | Template inheritance |
| MasterService | ServiceWeightPrice | 1:N | service_weight_prices.master_service_id | Weight pricing templates |
| ClinicService | ServiceWeightPrice | 1:N | service_weight_prices.service_id | Clinic-specific weight pricing |
| ClinicService | VaccineDosePrice | 1:N | vaccine_dose_prices.service_id | Dose-based pricing |
| VaccineTemplate | ClinicService | 1:N | clinic_services.vaccine_template_id | Vaccine master data link |

### Scheduling

| From | To | Type | FK Column | Notes |
|------|----|------|-----------|-------|
| User | StaffShift | 1:N | staff_shifts.staff_id | STAFF work schedule |
| StaffShift | Slot | 1:N | slots.shift_id | ON DELETE CASCADE |

### Booking Core

| From | To | Type | FK Column | Notes |
|------|----|------|-----------|-------|
| Pet | Booking | 1:N | bookings.pet_id | Primary pet |
| User | Booking | 1:N | bookings.pet_owner_id | Pet owner |
| Clinic | Booking | 1:N | bookings.clinic_id | Nullable for SOS |
| User | Booking | 1:N | bookings.assigned_staff_id | Assigned staff |
| User | Booking | 1:N | bookings.proxy_booker_id | Proxy booking |
| Booking | BookingServiceItem | 1:N | booking_services.booking_id | Orphan removal |
| Booking | BookingSlot | 1:N | booking_slots.booking_id | Orphan removal |
| BookingServiceItem | ClinicService | N:1 | booking_services.service_id | |
| BookingServiceItem | Pet | N:1 | booking_services.pet_id | Multi-pet support |
| BookingServiceItem | User | N:1 | booking_services.assigned_staff_id | Per-service staff |
| BookingSlot | Slot | N:1 | booking_slots.slot_id | |
| BookingSlot | BookingServiceItem | N:1 | booking_slots.booking_service_id | |

### Payment & Review

| From | To | Type | FK Column | Notes |
|------|----|------|-----------|-------|
| Booking | Payment | 1:1 | payments.booking_id | UNIQUE |
| Booking | Review | 1:0..1 | reviews.booking_id | UNIQUE |
| Review | Clinic | N:1 | reviews.clinic_id | |
| Review | User | N:1 | reviews.user_id | Reviewer |

### Notifications

| From | To | Type | FK Column | Notes |
|------|----|------|-----------|-------|
| User | Notification | 1:N | notifications.user_id | Recipient |
| Clinic | Notification | 1:N | notifications.clinic_id | Nullable |
| StaffShift | Notification | 1:N | notifications.shift_id | Nullable |

---

## 6. Booking Lifecycle & Status Flow

### BookingStatus Values (JPA Enum)

```
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
                                   → NO_SHOW
PENDING → CANCELLED

SOS Flow:
SEARCHING → PENDING_CLINIC_CONFIRM → CONFIRMED → IN_PROGRESS → COMPLETED
SEARCHING → CANCELLED (timeout)
PENDING_CLINIC_CONFIRM → CANCELLED (clinic rejects)
```

### Status Descriptions

| Status | Description |
|--------|-------------|
| `PENDING` | Pet Owner created booking, waiting for clinic confirmation |
| `SEARCHING` | SOS Auto-Match: Searching nearest available clinic |
| `PENDING_CLINIC_CONFIRM` | SOS: Waiting for matched clinic to accept |
| `CONFIRMED` | Clinic confirmed + Staff assigned |
| `IN_PROGRESS` | Examination/treatment in progress (or staff traveling for HOME_VISIT) |
| `COMPLETED` | Service completed |
| `CANCELLED` | Cancelled by owner, clinic, or system |
| `NO_SHOW` | Pet owner didn't show up |

**Note:** Legacy statuses (ASSIGNED, ON_THE_WAY, ARRIVED, CHECK_IN, CHECK_OUT) have been migrated and removed as of V202602242100.

---

## 7. Pricing Calculation

### Price Structure

```
total_price = SUM(booking_services.unit_price * quantity) + distance_fee + sos_fee

Where for each booking_service:
  unit_price = base_price + weight_price (from ServiceWeightPrice tier)

And:
  distance_fee = clinic_price_per_km.price_per_km * booking.distance_km (HOME_VISIT only)
  sos_fee = clinic_price_per_km.sos_fee (SOS only)
```

### Example

```
Booking (HOME_VISIT, 3 km, pet weight 15kg):
  Service: "Kham tong quat" (base_price = 200,000)
    Weight tier 10-20kg: +50,000
    unit_price = 250,000

  distance_fee = 20,000/km * 3 = 60,000
  sos_fee = 0 (not SOS)

  total_price = 250,000 + 60,000 = 310,000 VND
```

---

## 8. User Roles & Access Matrix

| Role | Platform | Clinic | Key Permissions |
|------|----------|--------|-----------------|
| **PET_OWNER** | Mobile | N/A | Own pets, create bookings, view history, view EMR, pay, write reviews, chat with clinic |
| **STAFF** | Mobile + Web | 1 (working_clinic_id) | View assigned bookings, create EMR, record vaccinations, view shift schedule, chat |
| **CLINIC_MANAGER** | Web | 1 (working_clinic_id) | Manage staff shifts, view all clinic bookings, assign staff, manage chat settings |
| **CLINIC_OWNER** | Web | Many (owned) | Register/edit clinics, create services, view financial reports, manage staff |
| **ADMIN** | Web | N/A | Approve/reject clinics, platform analytics, manage users, system settings |

---

## 9. Design Decisions & Justifications

### Decision 1: Hybrid Database Architecture
PostgreSQL for transactional data (ACID), MongoDB for document-based data (flexible schema for medical records and chat).

### Decision 2: Single Table Inheritance for Users
All roles in one `users` table with `role` discriminator. Simplifies auth queries and avoids JOINs for role checks. Staff-specific fields (specialty, rating) are nullable columns.

### Decision 3: Soft Delete Pattern
User, Clinic, Pet use `deleted_at` timestamp with `@SQLDelete` + `@SQLRestriction`. Preserves referential integrity and audit trail.

### Decision 4: Optimistic Locking
Booking, Clinic, ClinicService, ClinicPricePerKm use `@Version` to prevent concurrent update conflicts.

### Decision 5: Denormalized MongoDB Documents
Chat and medical documents store clinic/staff names directly. Avoids cross-database JOINs. Trade-off: names may become stale (acceptable for historical records).

### Decision 6: @MapsId for ClinicPricePerKm
Shares PK with Clinic (1:1). Ensures one pricing config per clinic without additional FK.

### Decision 7: JSONB for Operating Hours
Clinic.operating_hours stored as JSONB map. Flexible schema for varying weekly schedules without a separate table.

### Decision 8: Service-Level Staff Assignment
`booking_services.assigned_staff_id` allows different staff for different services in the same booking (e.g., VET for check-up, GROOMER for spa).

---

## 10. Implementation Notes

### Database Patterns
- **Soft Delete:** `@SQLDelete(sql = "UPDATE ... SET deleted_at = CURRENT_TIMESTAMP WHERE ...")` + `@SQLRestriction("deleted_at IS NULL")`
- **Auditing:** `@CreatedDate`, `@LastModifiedDate` via `@EntityListeners(AuditingEntityListener.class)`
- **UUID PKs:** All entities use `@GeneratedValue(strategy = GenerationType.UUID)`
- **Named Entity Graph:** `Booking.withDetails` for eager loading booking relationships

### Index Strategy
- All FK columns indexed automatically by JPA
- Custom indexes on frequently queried columns (status, date, type)
- Partial unique indexes for business constraints (active bookings)
- Compound indexes for common query patterns (staff+date, clinic+date)

### Migration Management
- Flyway for PostgreSQL schema evolution
- 46+ migration files from V1 to V20260310
- Naming: `V<Timestamp>__<description>.sql`

---

## 11. Document Metadata

| Property | Value |
|----------|-------|
| **Document Title** | Petties ERD - Database Schema Documentation |
| **Version** | 4.0 |
| **Status** | Synchronized with Codebase |
| **Last Updated** | 2026-03-10 |
| **Author** | Petties Product Team |
| **Source of Truth** | JPA Entity classes + Flyway migrations |
| **Related Documents** | PETTIES_DBML.dbml, REPORT_4_SDD_SYSTEM_DESIGN.md |
