-- Fix refund_applications table schema
-- This migration ensures all required columns exist with correct types

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add qr_revenue column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refund_applications' 
        AND column_name = 'qr_revenue'
    ) THEN
        ALTER TABLE refund_applications 
        ADD COLUMN qr_revenue NUMERIC(19, 2) NOT NULL DEFAULT 0;
    END IF;

    -- Add cash_revenue column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refund_applications' 
        AND column_name = 'cash_revenue'
    ) THEN
        ALTER TABLE refund_applications 
        ADD COLUMN cash_revenue NUMERIC(19, 2) NOT NULL DEFAULT 0;
    END IF;

    -- Add requested_amount column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'refund_applications' 
        AND column_name = 'requested_amount'
    ) THEN
        ALTER TABLE refund_applications 
        ADD COLUMN requested_amount NUMERIC(19, 2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_refund_app_clinic ON refund_applications(clinic_id);
CREATE INDEX IF NOT EXISTS idx_refund_app_status ON refund_applications(status);
CREATE INDEX IF NOT EXISTS idx_refund_app_created ON refund_applications(created_at);
