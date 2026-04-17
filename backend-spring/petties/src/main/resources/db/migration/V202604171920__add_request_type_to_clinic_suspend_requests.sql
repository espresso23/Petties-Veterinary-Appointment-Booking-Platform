-- Migration: Add request_type to clinic_suspend_requests for suspend/unsuspend workflow
-- Date: 2026-04-17 19:20

BEGIN;

ALTER TABLE clinic_suspend_requests
    ADD COLUMN IF NOT EXISTS request_type VARCHAR(20);

UPDATE clinic_suspend_requests
SET request_type = 'SUSPEND'
WHERE request_type IS NULL;

ALTER TABLE clinic_suspend_requests
    ALTER COLUMN request_type SET NOT NULL;

ALTER TABLE clinic_suspend_requests
    DROP CONSTRAINT IF EXISTS chk_clinic_suspend_requests_type;

ALTER TABLE clinic_suspend_requests
    ADD CONSTRAINT chk_clinic_suspend_requests_type
    CHECK (request_type IN ('SUSPEND', 'UNSUSPEND'));

CREATE INDEX IF NOT EXISTS idx_clinic_suspend_requests_type ON clinic_suspend_requests (request_type);

COMMIT;