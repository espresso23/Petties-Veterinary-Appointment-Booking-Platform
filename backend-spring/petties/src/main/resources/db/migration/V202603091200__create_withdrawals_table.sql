-- Create withdrawals table for tracking actual money transfers
-- This table tracks when admin approves refund applications and money is actually deducted/transferred

CREATE TABLE IF NOT EXISTS withdrawals (
    withdrawal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    refund_application_id UUID NOT NULL REFERENCES refund_applications(refund_application_id) ON DELETE CASCADE,
    requested_amount NUMERIC(19, 2) NOT NULL,
    transferred_amount NUMERIC(19, 2) NOT NULL,
    platform_fee NUMERIC(19, 2) NOT NULL,
    transaction_fee NUMERIC(19, 2) DEFAULT 0,
    admin_notes TEXT,
    transfer_reference VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawal_clinic ON withdrawals(clinic_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_created ON withdrawals(created_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_refund_app ON withdrawals(refund_application_id);
