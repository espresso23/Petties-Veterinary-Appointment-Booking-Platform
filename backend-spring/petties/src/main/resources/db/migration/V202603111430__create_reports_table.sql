-- Migration: V202603111430__create_reports_table.sql
-- Date: 2026-03-11
-- Description: Create reports table for Booking dispute/report feature

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id),
    reporter_id UUID NOT NULL REFERENCES users(user_id),
    reported_clinic_id UUID REFERENCES clinics(clinic_id),
    reported_user_id UUID REFERENCES users(user_id),
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    admin_note TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying
CREATE INDEX idx_reports_booking_id ON reports(booking_id);
CREATE INDEX idx_reports_status ON reports(status);
