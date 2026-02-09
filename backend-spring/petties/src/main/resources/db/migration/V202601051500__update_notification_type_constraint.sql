-- Migration: Update notifications type check constraint to include new types
-- Date: 2025-01-05 15:00
-- Author: Claude Code
-- Purpose: Add CLINIC_PENDING_APPROVAL and VET_SHIFT_* types to the check constraint

-- 1. Drop the existing check constraint (if exists)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 2. Re-create the check constraint with all valid notification types
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
    'APPROVED',
    'REJECTED',
    'PENDING',
    'CLINIC_PENDING_APPROVAL',
    'VET_SHIFT_ASSIGNED',
    'VET_SHIFT_UPDATED',
    'VET_SHIFT_DELETED',
    'BOOKING_ASSIGNED',
    'BOOKING_CREATED',
    'BOOKING_CANCELLED',
    'BOOKING_REMINDER'
));
