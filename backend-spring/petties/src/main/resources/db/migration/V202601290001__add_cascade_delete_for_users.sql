-- Add ON DELETE CASCADE to all foreign keys referencing users table
-- This allows deleting a user and automatically cleaning up all related records

-- 1. NOTIFICATIONS table - drop and recreate FK with CASCADE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'fk_notifications_user' AND table_name = 'notifications') THEN
        ALTER TABLE notifications DROP CONSTRAINT fk_notifications_user;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'notifications_user_id_fkey' AND table_name = 'notifications') THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_user_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
        ALTER TABLE notifications
            ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. PETS table - drop and recreate FK with CASCADE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'fk_pets_user' AND table_name = 'pets') THEN
        ALTER TABLE pets DROP CONSTRAINT fk_pets_user;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'pets_user_id_fkey' AND table_name = 'pets') THEN
        ALTER TABLE pets DROP CONSTRAINT pets_user_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'pets' AND column_name = 'user_id') THEN
        ALTER TABLE pets
            ADD CONSTRAINT fk_pets_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. CLINICS table (owner_id) - SET NULL when owner deleted
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'fk_clinics_owner' AND table_name = 'clinics') THEN
        ALTER TABLE clinics DROP CONSTRAINT fk_clinics_owner;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'clinics_owner_id_fkey' AND table_name = 'clinics') THEN
        ALTER TABLE clinics DROP CONSTRAINT clinics_owner_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'clinics' AND column_name = 'owner_id') THEN
        ALTER TABLE clinics
            ADD CONSTRAINT fk_clinics_owner FOREIGN KEY (owner_id) REFERENCES users (user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. STAFF_SHIFTS table (staff_id) - CASCADE delete shifts
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'staff_shifts_staff_id_fkey' AND table_name = 'staff_shifts') THEN
        ALTER TABLE staff_shifts DROP CONSTRAINT staff_shifts_staff_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'vet_shifts_vet_id_fkey' AND table_name = 'staff_shifts') THEN
        ALTER TABLE staff_shifts DROP CONSTRAINT vet_shifts_vet_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'staff_shifts' AND column_name = 'staff_id') THEN
        ALTER TABLE staff_shifts
            ADD CONSTRAINT staff_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES users (user_id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. CLINIC_STAFF table - CASCADE delete staff assignments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'fk_clinic_staff_user' AND table_name = 'clinic_staff') THEN
        ALTER TABLE clinic_staff DROP CONSTRAINT fk_clinic_staff_user;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'clinic_staff_user_id_fkey' AND table_name = 'clinic_staff') THEN
        ALTER TABLE clinic_staff DROP CONSTRAINT clinic_staff_user_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'clinic_staff' AND column_name = 'user_id') THEN
        ALTER TABLE clinic_staff
            ADD CONSTRAINT fk_clinic_staff_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. BOOKINGS table (pet_owner_id) - CASCADE delete bookings
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'bookings_pet_owner_id_fkey' AND table_name = 'bookings') THEN
        ALTER TABLE bookings DROP CONSTRAINT bookings_pet_owner_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'bookings' AND column_name = 'pet_owner_id') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_pet_owner_id_fkey FOREIGN KEY (pet_owner_id) REFERENCES users (user_id) ON DELETE CASCADE;
    END IF;
END $$;

-- 7. BOOKINGS table (assigned_staff_id) - SET NULL when staff deleted
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'bookings_assigned_staff_id_fkey' AND table_name = 'bookings') THEN
        ALTER TABLE bookings DROP CONSTRAINT bookings_assigned_staff_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'bookings_assigned_vet_id_fkey' AND table_name = 'bookings') THEN
        ALTER TABLE bookings DROP CONSTRAINT bookings_assigned_vet_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'bookings' AND column_name = 'assigned_staff_id') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_assigned_staff_id_fkey
            FOREIGN KEY (assigned_staff_id) REFERENCES users (user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- 8. BOOKING_SERVICES table (assigned_staff_id) - SET NULL when staff deleted
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'booking_services_assigned_staff_id_fkey' AND table_name = 'booking_services') THEN
        ALTER TABLE booking_services DROP CONSTRAINT booking_services_assigned_staff_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'booking_services_assigned_vet_id_fkey' AND table_name = 'booking_services') THEN
        ALTER TABLE booking_services DROP CONSTRAINT booking_services_assigned_vet_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'booking_services' AND column_name = 'assigned_staff_id') THEN
        ALTER TABLE booking_services
            ADD CONSTRAINT booking_services_assigned_staff_id_fkey
            FOREIGN KEY (assigned_staff_id) REFERENCES users (user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- 9. EMR (Electronic Medical Records) - SET NULL for created_by
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'emr_created_by_fkey' AND table_name = 'emr') THEN
        ALTER TABLE emr DROP CONSTRAINT emr_created_by_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'fk_emr_created_by' AND table_name = 'emr') THEN
        ALTER TABLE emr DROP CONSTRAINT fk_emr_created_by;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'emr' AND column_name = 'created_by') THEN
        ALTER TABLE emr
            ADD CONSTRAINT emr_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL;
    END IF;
END $$;