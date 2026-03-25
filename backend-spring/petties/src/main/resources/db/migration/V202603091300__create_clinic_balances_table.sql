-- Create clinic_balances table for tracking clinic balance
-- This table tracks the actual balance available for withdrawal

CREATE TABLE IF NOT EXISTS clinic_balances (
    clinic_balance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    current_balance NUMERIC(19, 2) NOT NULL DEFAULT 0,
    total_withdrawn NUMERIC(19, 2) NOT NULL DEFAULT 0,
    total_platform_fees NUMERIC(19, 2) NOT NULL DEFAULT 0,
    total_transaction_fees NUMERIC(19, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_clinic_balance_clinic UNIQUE (clinic_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_clinic_balance_clinic ON clinic_balances(clinic_id);
