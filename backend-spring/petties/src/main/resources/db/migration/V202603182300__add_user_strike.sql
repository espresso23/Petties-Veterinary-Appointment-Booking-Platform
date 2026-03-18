-- Flyway Migration: User (Pet Owner) Strike
-- Version: V202603182300
-- Description: strike_until trên users, user_strike_config. Khi pet owner nhận >= 3 report APPROVED (từ clinic) trong cửa sổ → hạn chế đặt lịch.

-- 1. Thêm cột strike_until vào users
ALTER TABLE users ADD COLUMN IF NOT EXISTS strike_until TIMESTAMP;

COMMENT ON COLUMN users.strike_until IS 'Thời điểm hết hạn strike. NULL = không bị strike. Khi có giá trị: pet owner không thể đặt lịch mới.';

-- 2. Bảng user_strike_config (Admin cấu hình ngưỡng strike cho pet owner)
CREATE TABLE IF NOT EXISTS user_strike_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users (user_id)
);

-- Giá trị mặc định
INSERT INTO user_strike_config (config_key, config_value, description) VALUES
    ('user_strike_threshold', '3', 'Số report được approve để kích hoạt strike'),
    ('user_strike_duration_days', '7', 'Số ngày pet owner bị hạn chế đặt lịch'),
    ('user_strike_window_days', '90', 'Chỉ tính report trong X ngày gần nhất')
ON CONFLICT (config_key) DO NOTHING;
