-- Flyway Migration: Cấu hình block vĩnh viễn khi strike vượt ngưỡng
-- Version: V202603182400
-- Description: Thêm strike_permanent_threshold (clinic) và user_strike_permanent_threshold (pet owner).
-- Khi số report APPROVED trong cửa sổ >= ngưỡng này → block vĩnh viễn (strike_until = 9999-12-31).

-- Clinic: ngưỡng block vĩnh viễn (mặc định 7)
INSERT INTO clinic_strike_config (config_key, config_value, description) VALUES
    ('strike_permanent_threshold', '7', 'Số report được approve để block vĩnh viễn (>= ngưỡng này = hạn chế không thời hạn). Đặt 0 để tắt.')
ON CONFLICT (config_key) DO NOTHING;

-- Pet owner: ngưỡng block vĩnh viễn (mặc định 7)
INSERT INTO user_strike_config (config_key, config_value, description) VALUES
    ('user_strike_permanent_threshold', '7', 'Số report được approve để block vĩnh viễn pet owner (>= ngưỡng này = hạn chế không thời hạn). Đặt 0 để tắt.')
ON CONFLICT (config_key) DO NOTHING;
