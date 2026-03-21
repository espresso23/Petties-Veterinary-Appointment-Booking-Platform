-- Migration for Subscription System
-- V202603180840__create_subscription_tables.sql

CREATE TABLE subscription_plans (
    plan_id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    duration_days INTEGER NOT NULL,
    features TEXT, -- JSON string or comma-separated list of feature codes
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_subscriptions (
    subscription_id UUID PRIMARY KEY,
    user_id UUID NOT NULL, -- The Clinic Owner who pays
    clinic_id UUID NOT NULL, -- The Clinic that gets the benefits
    plan_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL, -- PENDING_PAYMENT, ACTIVE, CANCELLED, EXPIRED
    payment_method VARCHAR(20), -- QR, STRIPE
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_subscription_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id),
    CONSTRAINT fk_subscription_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(plan_id)
);

-- Index for checking active subscriptions for a clinic
CREATE INDEX idx_user_subscriptions_clinic_status ON user_subscriptions(clinic_id, status);
