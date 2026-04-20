-- Flyway Migration: Clinic Suspend Requests
-- Version: V202604171700
-- Description: Create clinic_suspend_requests table for clinic owner self-suspend requests reviewed by admin.

CREATE TABLE IF NOT EXISTS clinic_suspend_requests (
    clinic_suspend_request_id UUID PRIMARY KEY,
    clinic_id UUID NOT NULL,
    requested_by UUID NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_note TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    CONSTRAINT fk_clinic_suspend_requests_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (clinic_id),
    CONSTRAINT fk_clinic_suspend_requests_requested_by FOREIGN KEY (requested_by) REFERENCES users (user_id),
    CONSTRAINT fk_clinic_suspend_requests_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (user_id),
    CONSTRAINT chk_clinic_suspend_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_clinic_suspend_requests_clinic ON clinic_suspend_requests (clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_suspend_requests_status ON clinic_suspend_requests (status);
CREATE INDEX IF NOT EXISTS idx_clinic_suspend_requests_created ON clinic_suspend_requests (created_at);