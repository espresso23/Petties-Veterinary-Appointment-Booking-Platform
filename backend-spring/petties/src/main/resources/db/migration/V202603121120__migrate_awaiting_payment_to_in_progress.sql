-- Migrate deprecated AWAITING_PAYMENT status to IN_PROGRESS
-- New flow removes AWAITING_PAYMENT entirely.

UPDATE bookings
SET status = 'IN_PROGRESS'
WHERE status = 'AWAITING_PAYMENT';
