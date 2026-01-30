-- Migration: Rename VET_* NotificationTypes to STAFF_*
-- Date: 2025-01-27 11:07
-- Description: Update notification type values from VET_* to STAFF_*
--   - VET_SHIFT_ASSIGNED → STAFF_SHIFT_ASSIGNED
--   - VET_SHIFT_UPDATED → STAFF_SHIFT_UPDATED
--   - VET_SHIFT_DELETED → STAFF_SHIFT_DELETED
--   - VET_SHIFT_CREATED → STAFF_SHIFT_CREATED (if exists)
--   - VET_ON_WAY → STAFF_ON_WAY (if exists)
-- Updated: Drop constraint FIRST to allow both old and new values during update

-- =========================================================
-- STEP 1: Drop old constraint FIRST to allow STAFF_* values
-- =========================================================
DO $$
BEGIN
    -- Drop existing constraint if exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check') THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
    END IF;
END $$;

-- =========================================================
-- STEP 2: Update existing notification records (safe now without constraint)
-- =========================================================
UPDATE notifications SET type = 'STAFF_SHIFT_ASSIGNED' WHERE type = 'VET_SHIFT_ASSIGNED';
UPDATE notifications SET type = 'STAFF_SHIFT_UPDATED' WHERE type = 'VET_SHIFT_UPDATED';
UPDATE notifications SET type = 'STAFF_SHIFT_DELETED' WHERE type = 'VET_SHIFT_DELETED';
UPDATE notifications SET type = 'STAFF_SHIFT_CREATED' WHERE type = 'VET_SHIFT_CREATED';
UPDATE notifications SET type = 'STAFF_ON_WAY' WHERE type = 'VET_ON_WAY';

-- =========================================================
-- STEP 3: Add new constraint with all types (VET_* renamed to STAFF_*)
-- =========================================================
-- Only add if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check') THEN
        ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
            type::text = ANY(ARRAY[
                'APPROVED',
                'REJECTED',
                'PENDING',
                'CLINIC_PENDING_APPROVAL',
                'CLINIC_VERIFIED',
                'STAFF_SHIFT_ASSIGNED',
                'STAFF_SHIFT_UPDATED',
                'STAFF_SHIFT_DELETED',
                'STAFF_ON_WAY',
                'BOOKING_CREATED',
                'BOOKING_CONFIRMED',
                'BOOKING_ASSIGNED',
                'BOOKING_CANCELLED',
                'BOOKING_CHECKIN',
                'BOOKING_COMPLETED',
                'BOOKING_REMINDER',
                'RE_EXAMINATION_REMINDER',
                'SYSTEM',
                'PROMOTION'
            ])
        );
    END IF;
END $$;

-- Note: This migration:
-- 1. FIRST drops the constraint to allow any type values
-- 2. Updates all existing notification records with VET_* types to STAFF_* types
-- 3. THEN adds the new constraint with STAFF_* naming convention
