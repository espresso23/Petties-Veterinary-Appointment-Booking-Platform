BEGIN;

DO $$
DECLARE
    v_owner_id UUID;
    v_clinic_id UUID;

    v_manager_id UUID;
    v_staff1_id UUID;
    v_staff2_id UUID;

    v_pet_owner1_id UUID;
    v_pet_owner2_id UUID;
    v_pet1_id UUID;
    v_pet2_id UUID;

    v_service_id UUID;
    v_shift_id UUID;

    v_booking1 UUID;
    v_booking2 UUID;
    v_booking3 UUID;
    v_booking4 UUID;
    v_booking5 UUID;

    v_qr_total NUMERIC := 950000;
    v_cash_total NUMERIC := 400000;
    v_platform_fee_qr NUMERIC;
    v_platform_fee_cash NUMERIC;
    v_withdrawable NUMERIC;
BEGIN
    SELECT user_id INTO v_owner_id
    FROM users
    WHERE username = 'clinicOwnerNew' AND deleted_at IS NULL
    LIMIT 1;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy user clinicOwnerNew';
    END IF;

    SELECT clinic_id INTO v_clinic_id
    FROM clinics
    WHERE owner_id = v_owner_id AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_clinic_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy clinic thuộc clinicOwnerNew';
    END IF;

    RAISE NOTICE 'Reset dữ liệu cho clinic_id=% owner_id=%', v_clinic_id, v_owner_id;

    DELETE FROM withdrawals WHERE clinic_id = v_clinic_id;
    DELETE FROM refund_applications WHERE clinic_id = v_clinic_id;

    DELETE FROM payments p
    USING bookings b
    WHERE p.booking_id = b.booking_id
      AND b.clinic_id = v_clinic_id;

    DELETE FROM booking_services bs
    USING bookings b
    WHERE bs.booking_id = b.booking_id
      AND b.clinic_id = v_clinic_id;

    DELETE FROM booking_slots bsl
    USING bookings b
    WHERE bsl.booking_id = b.booking_id
      AND b.clinic_id = v_clinic_id;

    DELETE FROM bookings WHERE clinic_id = v_clinic_id;

    DELETE FROM slots s
    USING staff_shifts sh
    WHERE s.shift_id = sh.shift_id
      AND sh.clinic_id = v_clinic_id;

    DELETE FROM staff_shifts WHERE clinic_id = v_clinic_id;

    DELETE FROM clinic_balances WHERE clinic_id = v_clinic_id;
    DELETE FROM clinic_services WHERE clinic_id = v_clinic_id;

    DELETE FROM notifications
    WHERE clinic_id = v_clinic_id
       OR user_id IN (
            SELECT user_id FROM users
            WHERE working_clinic_id = v_clinic_id
              AND role IN ('CLINIC_MANAGER', 'STAFF')
       )
       OR user_id IN (
            SELECT user_id FROM users
            WHERE username LIKE 'petOwnerNewSeed%'
       );

    DELETE FROM reviews
    WHERE user_id IN (
        SELECT user_id FROM users
        WHERE working_clinic_id = v_clinic_id
          AND role IN ('CLINIC_MANAGER', 'STAFF')
    )
    OR user_id IN (
        SELECT user_id FROM users
        WHERE username LIKE 'petOwnerNewSeed%'
    );

    DELETE FROM pets
    WHERE user_id IN (
        SELECT user_id FROM users
        WHERE username LIKE 'petOwnerNewSeed%'
    );

    DELETE FROM users
    WHERE username LIKE 'petOwnerNewSeed%';

    DELETE FROM users
    WHERE working_clinic_id = v_clinic_id
      AND role IN ('CLINIC_MANAGER', 'STAFF');

    UPDATE clinics
    SET name = 'Phòng Khám PetCare Mới',
        status = 'APPROVED',
        approved_at = NOW(),
        bank_name = 'Vietcombank',
        account_number = '0123456789',
        updated_at = NOW()
    WHERE clinic_id = v_clinic_id;

    v_manager_id := gen_random_uuid();
    INSERT INTO users (
        user_id, username, password, phone, email, full_name, role,
        created_at, updated_at, working_clinic_id, specialty, rating_avg, rating_count
    ) VALUES (
        v_manager_id,
        'clinicManagerNewSeed',
        '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi2N8sRP/6IDdnh3oX1N1pAVccawJ4i',
        '0901000001',
        'manager_new_seed@test.com',
        'Clinic Manager Seed',
        'CLINIC_MANAGER',
        NOW(), NOW(), v_clinic_id,
        NULL, 0, 0
    );

    v_staff1_id := gen_random_uuid();
    INSERT INTO users (
        user_id, username, password, phone, email, full_name, role,
        created_at, updated_at, working_clinic_id, specialty, rating_avg, rating_count
    ) VALUES (
        v_staff1_id,
        'staffNewSeed1',
        '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi2N8sRP/6IDdnh3oX1N1pAVccawJ4i',
        '0901000002',
        'staff_new_seed1@test.com',
        'Staff Seed 1',
        'STAFF',
        NOW(), NOW(), v_clinic_id,
        'GENERAL', 0, 0
    );

    v_staff2_id := gen_random_uuid();
    INSERT INTO users (
        user_id, username, password, phone, email, full_name, role,
        created_at, updated_at, working_clinic_id, specialty, rating_avg, rating_count
    ) VALUES (
        v_staff2_id,
        'staffNewSeed2',
        '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi2N8sRP/6IDdnh3oX1N1pAVccawJ4i',
        '0901000003',
        'staff_new_seed2@test.com',
        'Staff Seed 2',
        'STAFF',
        NOW(), NOW(), v_clinic_id,
        'SURGERY', 0, 0
    );

    v_pet_owner1_id := gen_random_uuid();
    INSERT INTO users (
        user_id, username, password, phone, email, full_name, role,
        created_at, updated_at, working_clinic_id
    ) VALUES (
        v_pet_owner1_id,
        'petOwnerNewSeed1',
        '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi2N8sRP/6IDdnh3oX1N1pAVccawJ4i',
        '0901000011',
        'pet_owner_new_seed1@test.com',
        'Pet Owner Seed 1',
        'PET_OWNER',
        NOW(), NOW(), NULL
    );

    v_pet_owner2_id := gen_random_uuid();
    INSERT INTO users (
        user_id, username, password, phone, email, full_name, role,
        created_at, updated_at, working_clinic_id
    ) VALUES (
        v_pet_owner2_id,
        'petOwnerNewSeed2',
        '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi2N8sRP/6IDdnh3oX1N1pAVccawJ4i',
        '0901000012',
        'pet_owner_new_seed2@test.com',
        'Pet Owner Seed 2',
        'PET_OWNER',
        NOW(), NOW(), NULL
    );

    v_pet1_id := gen_random_uuid();
    INSERT INTO pets (
        pet_id, name, species, breed, date_of_birth, weight, gender,
        user_id, created_at, updated_at, color, allergies
    ) VALUES (
        v_pet1_id,
        'Milu',
        'DOG',
        'Poodle',
        DATE '2022-06-01',
        4.8,
        'FEMALE',
        v_pet_owner1_id,
        NOW(), NOW(), 'Trắng', ''
    );

    v_pet2_id := gen_random_uuid();
    INSERT INTO pets (
        pet_id, name, species, breed, date_of_birth, weight, gender,
        user_id, created_at, updated_at, color, allergies
    ) VALUES (
        v_pet2_id,
        'Bim',
        'CAT',
        'Munchkin',
        DATE '2021-08-15',
        3.2,
        'MALE',
        v_pet_owner2_id,
        NOW(), NOW(), 'Vàng', ''
    );

    v_service_id := gen_random_uuid();
    INSERT INTO clinic_services (
        service_id, clinic_id, master_service_id, is_custom, name,
        base_price, duration_time, slots_required, is_active, is_home_visit,
        service_category, pet_type, created_at, updated_at, description
    ) VALUES (
        v_service_id,
        v_clinic_id,
        NULL,
        TRUE,
        'Khám tổng quát Seed',
        200000,
        30,
        1,
        TRUE,
        FALSE,
        'KHAM',
        'DOG,CAT',
        NOW(), NOW(), 'Dịch vụ seed để test booking/refund'
    );

    v_shift_id := gen_random_uuid();
    INSERT INTO staff_shifts (
        shift_id, staff_id, clinic_id, work_date, start_time, end_time,
        break_start, break_end, notes, created_at, updated_at, is_overnight
    ) VALUES (
        v_shift_id,
        v_staff1_id,
        v_clinic_id,
        CURRENT_DATE,
        TIME '08:00:00',
        TIME '12:00:00',
        NULL,
        NULL,
        'Shift seed test',
        NOW(), NOW(), FALSE
    );

    INSERT INTO slots (slot_id, shift_id, start_time, end_time, status, created_at, updated_at)
    VALUES
        (gen_random_uuid(), v_shift_id, TIME '08:00:00', TIME '08:30:00', 'AVAILABLE', NOW(), NOW()),
        (gen_random_uuid(), v_shift_id, TIME '08:30:00', TIME '09:00:00', 'AVAILABLE', NOW(), NOW()),
        (gen_random_uuid(), v_shift_id, TIME '09:00:00', TIME '09:30:00', 'AVAILABLE', NOW(), NOW());

    v_booking1 := gen_random_uuid();
    INSERT INTO bookings (
        booking_id, booking_code, pet_id, pet_owner_id, clinic_id, assigned_staff_id,
        booking_date, booking_time, type, total_price, status, notes, created_at,
        distance_fee, version, confirmed_at
    ) VALUES (
        v_booking1, 'CONEW-0001', v_pet1_id, v_pet_owner1_id, v_clinic_id, v_staff1_id,
        CURRENT_DATE - 5, TIME '09:00:00', 'IN_CLINIC', 300000, 'COMPLETED', 'Seed booking 1', NOW(),
        0, 0, NOW()
    );

    v_booking2 := gen_random_uuid();
    INSERT INTO bookings (
        booking_id, booking_code, pet_id, pet_owner_id, clinic_id, assigned_staff_id,
        booking_date, booking_time, type, total_price, status, notes, created_at,
        distance_fee, version, confirmed_at
    ) VALUES (
        v_booking2, 'CONEW-0002', v_pet2_id, v_pet_owner2_id, v_clinic_id, v_staff2_id,
        CURRENT_DATE - 4, TIME '10:00:00', 'IN_CLINIC', 250000, 'COMPLETED', 'Seed booking 2', NOW(),
        0, 0, NOW()
    );

    v_booking3 := gen_random_uuid();
    INSERT INTO bookings (
        booking_id, booking_code, pet_id, pet_owner_id, clinic_id, assigned_staff_id,
        booking_date, booking_time, type, total_price, status, notes, created_at,
        distance_fee, version, confirmed_at
    ) VALUES (
        v_booking3, 'CONEW-0003', v_pet1_id, v_pet_owner1_id, v_clinic_id, v_staff1_id,
        CURRENT_DATE - 3, TIME '14:00:00', 'IN_CLINIC', 450000, 'COMPLETED', 'Seed booking 3', NOW(),
        0, 0, NOW()
    );

    v_booking4 := gen_random_uuid();
    INSERT INTO bookings (
        booking_id, booking_code, pet_id, pet_owner_id, clinic_id, assigned_staff_id,
        booking_date, booking_time, type, total_price, status, notes, created_at,
        distance_fee, version, confirmed_at
    ) VALUES (
        v_booking4, 'CONEW-0004', v_pet2_id, v_pet_owner2_id, v_clinic_id, v_staff2_id,
        CURRENT_DATE - 2, TIME '15:00:00', 'IN_CLINIC', 150000, 'COMPLETED', 'Seed booking 4', NOW(),
        0, 0, NOW()
    );

    v_booking5 := gen_random_uuid();
    INSERT INTO bookings (
        booking_id, booking_code, pet_id, pet_owner_id, clinic_id, assigned_staff_id,
        booking_date, booking_time, type, total_price, status, notes, created_at,
        distance_fee, version, confirmed_at
    ) VALUES (
        v_booking5, 'CONEW-0005', v_pet1_id, v_pet_owner1_id, v_clinic_id, v_staff1_id,
        CURRENT_DATE - 1, TIME '16:00:00', 'IN_CLINIC', 200000, 'COMPLETED', 'Seed booking 5', NOW(),
        0, 0, NOW()
    );

    INSERT INTO booking_services (
        booking_service_id, booking_id, service_id, unit_price, quantity, created_at,
        assigned_staff_id, base_price, weight_price, is_add_on, pet_id
    ) VALUES
        (gen_random_uuid(), v_booking1, v_service_id, 300000, 1, NOW(), v_staff1_id, 300000, 0, FALSE, v_pet1_id),
        (gen_random_uuid(), v_booking2, v_service_id, 250000, 1, NOW(), v_staff2_id, 250000, 0, FALSE, v_pet2_id),
        (gen_random_uuid(), v_booking3, v_service_id, 450000, 1, NOW(), v_staff1_id, 450000, 0, FALSE, v_pet1_id),
        (gen_random_uuid(), v_booking4, v_service_id, 150000, 1, NOW(), v_staff2_id, 150000, 0, FALSE, v_pet2_id),
        (gen_random_uuid(), v_booking5, v_service_id, 200000, 1, NOW(), v_staff1_id, 200000, 0, FALSE, v_pet1_id);

    INSERT INTO payments (
        payment_id, booking_id, amount, method, status, paid_at, created_at, payment_description
    ) VALUES
        (gen_random_uuid(), v_booking1, 300000, 'QR', 'PAID', NOW() - INTERVAL '5 day', NOW() - INTERVAL '5 day', 'SEED-CONEW-0001'),
        (gen_random_uuid(), v_booking2, 250000, 'CASH', 'PAID', NOW() - INTERVAL '4 day', NOW() - INTERVAL '4 day', 'SEED-CONEW-0002'),
        (gen_random_uuid(), v_booking3, 450000, 'QR', 'PAID', NOW() - INTERVAL '3 day', NOW() - INTERVAL '3 day', 'SEED-CONEW-0003'),
        (gen_random_uuid(), v_booking4, 150000, 'CASH', 'PAID', NOW() - INTERVAL '2 day', NOW() - INTERVAL '2 day', 'SEED-CONEW-0004'),
        (gen_random_uuid(), v_booking5, 200000, 'QR', 'PAID', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'SEED-CONEW-0005');

    v_platform_fee_qr := ROUND(v_qr_total * 0.05, 2);
    v_platform_fee_cash := ROUND(v_cash_total * 0.05, 2);
    v_withdrawable := v_qr_total - v_platform_fee_qr - v_platform_fee_cash;

    INSERT INTO clinic_balances (
        clinic_balance_id, clinic_id, current_balance, total_withdrawn,
        total_platform_fees, total_transaction_fees, notes, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_clinic_id,
        v_withdrawable,
        0,
        v_platform_fee_qr + v_platform_fee_cash,
        0,
        'Seed lại dữ liệu full cho ClinicOwnerNew',
        NOW(), NOW()
    );

    INSERT INTO refund_applications (
        refund_application_id, clinic_id, period_year_month, month_revenue,
        web_deduction_percent, web_deduction_amount, amount_after_deduction,
        status, rejection_reason, reviewed_by, reviewed_at, created_at,
        qr_revenue, cash_revenue, requested_amount
    ) VALUES (
        gen_random_uuid(),
        v_clinic_id,
        TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
        v_qr_total + v_cash_total,
        5,
        v_platform_fee_qr + v_platform_fee_cash,
        (v_qr_total + v_cash_total) - (v_platform_fee_qr + v_platform_fee_cash),
        'PENDING',
        NULL,
        NULL,
        NULL,
        NOW(),
        v_qr_total,
        v_cash_total,
        10000
    );

    RAISE NOTICE 'Seed hoàn tất cho clinic % | withdrawable balance=%', v_clinic_id, v_withdrawable;
END $$;

COMMIT;
