-- update all bookings for the clinic
DO $$
DECLARE
    cid UUID;
    rec RECORD;
    i INT := 0;
BEGIN
    SELECT clinic_id INTO cid FROM clinics c JOIN users u ON c.owner_id = u.user_id WHERE u.username = 'clinicOwner' LIMIT 1;
    
    FOR rec IN SELECT booking_id, total_price FROM bookings WHERE clinic_id = cid LOOP
        -- Set status to COMPLETED
        UPDATE bookings SET status = 'COMPLETED' WHERE booking_id = rec.booking_id;
        
        -- Delete existing payments if any to avoid uniqueness issues, though there probably aren't any
        DELETE FROM payments WHERE booking_id = rec.booking_id;
        
        -- Insert a payment
        IF i % 2 = 0 THEN
            INSERT INTO payments (payment_id, booking_id, amount, method, status, paid_at, created_at)
            VALUES (gen_random_uuid(), rec.booking_id, rec.total_price, 'QR', 'PAID', current_timestamp - (i || ' days')::interval, current_timestamp - (i || ' days')::interval);
        ELSE
            INSERT INTO payments (payment_id, booking_id, amount, method, status, paid_at, created_at)
            VALUES (gen_random_uuid(), rec.booking_id, rec.total_price, 'CASH', 'PAID', current_timestamp - (i || ' days')::interval, current_timestamp - (i || ' days')::interval);
        END IF;
        
        i := i + 1;
    END LOOP;
END $$;
