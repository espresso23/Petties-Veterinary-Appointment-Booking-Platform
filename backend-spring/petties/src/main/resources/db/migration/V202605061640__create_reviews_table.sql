-- Create reviews table for booking reviews
CREATE TABLE IF NOT EXISTS reviews (
    review_id UUID PRIMARY KEY,
    rating INTEGER NOT NULL,
    comment TEXT,
    booking_id UUID NOT NULL UNIQUE,
    clinic_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings (booking_id),
    CONSTRAINT fk_reviews_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (clinic_id),
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_clinic_id ON reviews (clinic_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews (user_id);
