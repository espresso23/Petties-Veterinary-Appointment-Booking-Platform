-- Flyway Migration: Create Booking System Tables
-- Version: V202601110100
-- Description: Creates bookings, booking_slots, booking_services, payments tables

-- ========== BOOKINGS TABLE ==========
CREATE TABLE bookings (
    booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_code VARCHAR(20) UNIQUE NOT NULL,
    pet_id UUID NOT NULL REFERENCES pets (pet_id),
    pet_owner_id UUID NOT NULL REFERENCES users (user_id),
    clinic_id UUID NOT NULL REFERENCES clinics (clinic_id),
    assigned_vet_id UUID REFERENCES users (user_id),
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (
        type IN (
            'IN_CLINIC',
            'HOME_VISIT',
            'SOS'
        )
    ),
    home_address TEXT,
    home_lat DECIMAL(10, 7),
    home_long DECIMAL(10, 7),
    distance_km DECIMAL(5, 2),
    total_price DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN (
            'PENDING',
            'CONFIRMED',
            'ASSIGNED',
            'ON_THE_WAY',
            'ARRIVED',
            'CHECK_IN',
            'IN_PROGRESS',
            'CHECK_OUT',
            'COMPLETED',
            'CANCELLED',
            'NO_SHOW'
        )
    ),
    cancellation_reason TEXT,
    cancelled_by UUID,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for bookings
CREATE INDEX idx_bookings_pet_id ON bookings (pet_id);

CREATE INDEX idx_bookings_pet_owner_id ON bookings (pet_owner_id);

CREATE INDEX idx_bookings_clinic_id ON bookings (clinic_id);

CREATE INDEX idx_bookings_assigned_vet_id ON bookings (assigned_vet_id);

CREATE INDEX idx_bookings_date ON bookings (booking_date);

CREATE INDEX idx_bookings_status ON bookings (status);

-- ========== BOOKING_SLOTS TABLE (Junction: Booking <-> Slot) ==========
CREATE TABLE booking_slots (
    booking_slot_id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (booking_id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES slots (slot_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (booking_id, slot_id)
);

CREATE INDEX idx_booking_slots_booking_id ON booking_slots (booking_id);

CREATE INDEX idx_booking_slots_slot_id ON booking_slots (slot_id);

-- ========== BOOKING_SERVICES TABLE (Junction: Booking <-> Service) ==========
CREATE TABLE booking_services (
    booking_service_id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (booking_id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES clinic_services (service_id),
    unit_price DECIMAL(12, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booking_services_booking_id ON booking_services (booking_id);

CREATE INDEX idx_booking_services_service_id ON booking_services (service_id);

-- ========== PAYMENTS TABLE ==========
CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings (booking_id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    method VARCHAR(20) NOT NULL CHECK (
        method IN ('CASH', 'QR', 'CARD')
    ),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN (
            'PENDING',
            'PAID',
            'REFUNDED',
            'FAILED'
        )
    ),
    stripe_payment_id VARCHAR(255),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_booking_id ON payments (booking_id);

CREATE INDEX idx_payments_status ON payments (status);