-- Flyway Migration: Clinic Strike
-- Version: V202603181600
-- Description: strike_until trên clinics, clinic_strike_config. Khi clinic nhận >= 3 report APPROVED trong cửa sổ → hạn chế 7 ngày.

-- 1. Thêm cột strike_until vào clinics
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS strike_until TIMESTAMP;

COMMENT ON COLUMN clinics.strike_until IS 'Thời điểm hết hạn strike. NULL = không bị strike. Khi có giá trị: clinic không nhận booking mới, không xuất hiện trong tìm kiếm.';

-- 2. Bảng clinic_strike_config (Admin cấu hình ngưỡng strike)
CREATE TABLE IF NOT EXISTS clinic_strike_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users (user_id)
);

-- Giá trị mặc định
INSERT INTO clinic_strike_config (config_key, config_value, description) VALUES
    ('strike_threshold', '3', 'Số report được approve để kích hoạt strike (3-4)'),
    ('strike_duration_days', '7', 'Số ngày clinic bị hạn chế'),
    ('strike_window_days', '90', 'Chỉ tính report trong X ngày gần nhất')
ON CONFLICT (config_key) DO NOTHING;
