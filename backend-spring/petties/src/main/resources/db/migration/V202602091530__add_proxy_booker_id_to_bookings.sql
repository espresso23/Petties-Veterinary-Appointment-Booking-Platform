-- Add proxy_booker_id column to bookings table for proxy booking feature
ALTER TABLE bookings ADD COLUMN proxy_booker_id UUID REFERENCES users(user_id);

-- Add index for faster lookup of bookings by proxy_booker
CREATE INDEX idx_bookings_proxy_booker_id ON bookings(proxy_booker_id);

COMMENT ON COLUMN bookings.proxy_booker_id IS 'The user who created this booking on behalf of another person (proxy booking). NULL if the pet owner booked themselves.';
