CREATE TABLE clinic_deletion_requests (
    request_id UUID PRIMARY KEY,
    clinic_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    admin_note TEXT,
    reviewed_by UUID,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    updated_at TIMESTAMP,
    version BIGINT DEFAULT 0 NOT NULL,
    CONSTRAINT fk_clinic_deletion_requests_clinic
        FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id),
    CONSTRAINT fk_clinic_deletion_requests_owner
        FOREIGN KEY (owner_id) REFERENCES users(user_id),
    CONSTRAINT fk_clinic_deletion_requests_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES users(user_id),
    CONSTRAINT chk_clinic_deletion_request_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX idx_clinic_deletion_requests_owner ON clinic_deletion_requests(owner_id);
CREATE INDEX idx_clinic_deletion_requests_status ON clinic_deletion_requests(status);
CREATE INDEX idx_clinic_deletion_requests_clinic ON clinic_deletion_requests(clinic_id);

CREATE UNIQUE INDEX uq_clinic_deletion_requests_pending_per_clinic
    ON clinic_deletion_requests(clinic_id)
    WHERE status = 'PENDING';
