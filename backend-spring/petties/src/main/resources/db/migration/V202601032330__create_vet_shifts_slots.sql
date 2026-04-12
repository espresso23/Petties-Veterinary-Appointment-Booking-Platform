-- Flyway migration for VetShift and Slot tables
-- Version: V202601032330
-- Description: Create vet_shifts and slots tables for scheduling

-- Create vet_shifts table
CREATE TABLE IF NOT EXISTS vet_shifts (
    shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vet_id UUID NOT NULL REFERENCES users(user_id),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id),
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start TIME,
    break_end TIME,
    notes VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

-- A vet can only have one shift per day
CONSTRAINT unique_vet_date UNIQUE (vet_id, work_date) );

-- Create indexes for vet_shifts
CREATE INDEX IF NOT EXISTS idx_shift_vet_date ON vet_shifts (vet_id, work_date);

CREATE INDEX IF NOT EXISTS idx_shift_clinic_date ON vet_shifts (clinic_id, work_date);

-- Create slots table
CREATE TABLE IF NOT EXISTS slots (
    slot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES vet_shifts(shift_id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

-- Status can only be: AVAILABLE, BOOKED, BLOCKED
CONSTRAINT chk_slot_status CHECK (status IN ('AVAILABLE', 'BOOKED', 'BLOCKED'))
);

-- Create indexes for slots
CREATE INDEX IF NOT EXISTS idx_slot_shift ON slots (shift_id);

CREATE INDEX IF NOT EXISTS idx_slot_status ON slots (status);

CREATE INDEX IF NOT EXISTS idx_slot_time ON slots (start_time, end_time);

-- Add comments
COMMENT ON
TABLE vet_shifts IS 'Vet work shifts - each shift generates multiple 30-min slots';

COMMENT ON
TABLE slots IS 'Bookable time slots - auto-generated from shifts';

COMMENT ON COLUMN vet_shifts.break_start IS 'Optional break start time - slots not generated during break';

COMMENT ON COLUMN vet_shifts.break_end IS 'Optional break end time';

COMMENT ON COLUMN slots.status IS 'AVAILABLE=can book, BOOKED=has booking, BLOCKED=manually blocked';