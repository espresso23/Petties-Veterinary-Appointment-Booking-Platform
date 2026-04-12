-- Migration to allow payments for subscriptions
-- V202603180900__add_subscription_id_to_payments.sql

ALTER TABLE payments ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN subscription_id UUID;
ALTER TABLE payments ADD CONSTRAINT fk_payment_subscription FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(subscription_id);

-- Index for searching payments by subscription
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
