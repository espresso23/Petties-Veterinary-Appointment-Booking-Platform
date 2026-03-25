-- =====================================================================
-- V202603212100__create_vouchers_tables.sql
-- Tạo bảng vouchers và clinic_vouchers cho tính năng Voucher
-- =====================================================================

-- Bảng master vouchers - Admin tạo
CREATE TABLE IF NOT EXISTS vouchers (
    voucher_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(50)     NOT NULL UNIQUE,
    name                VARCHAR(200)    NOT NULL,
    description         TEXT,

    -- Loại giảm giá
    discount_type       VARCHAR(20)     NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    discount_value      NUMERIC(12, 2)  NOT NULL,       -- % hoặc số tiền VND
    max_discount_amount NUMERIC(12, 2),                 -- Trần giảm tối đa (chỉ cho PERCENTAGE)

    -- Điều kiện áp dụng
    min_order_amount    NUMERIC(12, 2)  NOT NULL DEFAULT 0,  -- Tổng đơn tối thiểu
    applicable_category VARCHAR(100),                   -- NULL = tất cả loại dịch vụ

    -- Giới hạn sử dụng
    usage_limit         INTEGER,                        -- NULL = không giới hạn
    used_count          INTEGER         NOT NULL DEFAULT 0,

    -- Thời gian hiệu lực
    start_date          DATE            NOT NULL,
    end_date            DATE            NOT NULL,

    -- Trạng thái
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    created_by          UUID            REFERENCES users(user_id) ON DELETE SET NULL
);

-- Bảng clinic_vouchers - ClinicManager apply voucher cho clinic mình
CREATE TABLE IF NOT EXISTS clinic_vouchers (
    clinic_voucher_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id          UUID            NOT NULL REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
    clinic_id           UUID            NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    applied_by          UUID            REFERENCES users(user_id) ON DELETE SET NULL,

    -- Admin có thể bật/tắt voucher này trên clinic
    is_enabled          BOOLEAN         NOT NULL DEFAULT TRUE,

    applied_at          TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_clinic_voucher UNIQUE (voucher_id, clinic_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_active ON vouchers(is_active);
CREATE INDEX IF NOT EXISTS idx_vouchers_dates ON vouchers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_clinic_vouchers_clinic ON clinic_vouchers(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_vouchers_voucher ON clinic_vouchers(voucher_id);
