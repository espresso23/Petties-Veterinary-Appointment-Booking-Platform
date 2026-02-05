-- Add bank information columns to clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);

COMMENT ON COLUMN clinics.bank_name IS 'Tên ngân hàng của phòng khám';
COMMENT ON COLUMN clinics.account_number IS 'Số tài khoản ngân hàng của phòng khám';
