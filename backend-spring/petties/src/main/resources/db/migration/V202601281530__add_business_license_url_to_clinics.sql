-- Add business_license_url column to clinics table
-- This stores the URL to the uploaded business license document (PDF/Image)

ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS business_license_url VARCHAR(500);

COMMENT ON COLUMN clinics.business_license_url IS 'URL to business license/veterinary practice certificate uploaded to Cloudinary';
