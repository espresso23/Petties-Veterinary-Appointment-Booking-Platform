-- Flyway Migration: Add payment_description to payments
-- Version: V202601141512
-- Description: Adds payment_description column for SePay QR matching

ALTER TABLE payments
    ADD COLUMN payment_description VARCHAR(100);

CREATE INDEX idx_payments_payment_description ON payments (payment_description);
