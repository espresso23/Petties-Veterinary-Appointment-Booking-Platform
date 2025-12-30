-- INIT SCHEMA FOR PETTIES PROJECT
-- Baseline for Flyway Migration

-- 1. Create EXTENSION for UUID if not exists (though PG usually has it)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Table: clinics (must exist before users if we have circular refs, or handle fk later)
-- We will create them in an order that respects foreign keys.

CREATE TABLE clinics (
    clinic_id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    address VARCHAR(500) NOT NULL,
    district VARCHAR(100),
    province VARCHAR(100),
    specific_location VARCHAR(200),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    logo VARCHAR(500),
    operating_hours JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    rating_avg DECIMAL(2, 1) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 3. Table: users
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    full_name VARCHAR(100),
    avatar VARCHAR(500),
    avatar_public_id VARCHAR(100),
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP,
    working_clinic_id UUID,
    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT uk_users_phone UNIQUE (phone),
    CONSTRAINT fk_users_clinic FOREIGN KEY (working_clinic_id) REFERENCES clinics (clinic_id)
);

-- Add Foreign Key to clinics for owner_id now that users table exists
ALTER TABLE clinics
ADD CONSTRAINT fk_clinics_owner FOREIGN KEY (owner_id) REFERENCES users (user_id);

-- 4. Table: pets
CREATE TABLE pets (
    pet_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    species VARCHAR(255) NOT NULL,
    breed VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    weight DOUBLE PRECISION NOT NULL,
    gender VARCHAR(255) NOT NULL,
    image_url VARCHAR(255),
    image_public_id VARCHAR(255),
    user_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    CONSTRAINT fk_pets_user FOREIGN KEY (user_id) REFERENCES users (user_id)
);

-- 5. Table: master_services
CREATE TABLE master_services (
    master_service_id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    default_price DECIMAL(19, 2) NOT NULL,
    duration_time INTEGER NOT NULL,
    slots_required INTEGER NOT NULL,
    is_home_visit BOOLEAN NOT NULL DEFAULT FALSE,
    default_price_per_km DECIMAL(19, 2),
    service_category VARCHAR(100),
    pet_type VARCHAR(100),
    icon VARCHAR(100),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP
);

-- 6. Table: clinic_services
CREATE TABLE clinic_services (
    service_id UUID PRIMARY KEY,
    clinic_id UUID NOT NULL,
    master_service_id UUID,
    is_custom BOOLEAN NOT NULL DEFAULT TRUE,
    name VARCHAR(200) NOT NULL,
    base_price DECIMAL(19, 2) NOT NULL,
    duration_time INTEGER NOT NULL,
    slots_required INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_home_visit BOOLEAN NOT NULL DEFAULT FALSE,
    price_per_km DECIMAL(19, 2),
    service_category VARCHAR(100),
    pet_type VARCHAR(100),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    CONSTRAINT fk_clinic_services_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (clinic_id),
    CONSTRAINT fk_clinic_services_master FOREIGN KEY (master_service_id) REFERENCES master_services (master_service_id)
);

-- 7. Table: service_weight_prices
CREATE TABLE service_weight_prices (
    weight_price_id UUID PRIMARY KEY,
    service_id UUID,
    master_service_id UUID,
    min_weight DECIMAL(10, 2) NOT NULL,
    max_weight DECIMAL(10, 2) NOT NULL,
    price DECIMAL(19, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    CONSTRAINT fk_weight_prices_service FOREIGN KEY (service_id) REFERENCES clinic_services (service_id),
    CONSTRAINT fk_weight_prices_master FOREIGN KEY (master_service_id) REFERENCES master_services (master_service_id)
);

-- 8. Table: clinic_images
CREATE TABLE clinic_images (
    image_id UUID PRIMARY KEY,
    clinic_id UUID NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    caption VARCHAR(200),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_clinic_images_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (clinic_id)
);

-- 9. Table: clinic_price_per_km
CREATE TABLE clinic_price_per_km (
    clinic_id UUID PRIMARY KEY,
    price_per_km DECIMAL(12, 2),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_clinic_price_per_km_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (clinic_id)
);

-- 10. Table: notifications
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    clinic_id UUID NOT NULL,
    type VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reason TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT fk_notifications_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (clinic_id)
);

-- 11. Table: refresh_tokens
CREATE TABLE refresh_tokens (
    token_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);

-- 12. Table: blacklisted_tokens
CREATE TABLE blacklisted_tokens (
    token_id UUID PRIMARY KEY,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_blacklisted_tokens_token_hash ON blacklisted_tokens (token_hash);

CREATE INDEX idx_blacklisted_tokens_user_id ON blacklisted_tokens (user_id);