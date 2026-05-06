-- Thêm cột version cho bảng clinics
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;

-- Set giá trị mặc định cho version các bản ghi cũ
UPDATE clinics SET version = 0 WHERE version IS NULL;

-- Thêm cột version cho bảng clinic_services
ALTER TABLE clinic_services ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;

-- Set giá trị mặc định cho version các bản ghi cũ
UPDATE clinic_services SET version = 0 WHERE version IS NULL;