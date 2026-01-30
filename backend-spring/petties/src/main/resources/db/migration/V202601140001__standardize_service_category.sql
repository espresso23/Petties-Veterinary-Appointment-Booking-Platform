-- Standardize service_category values to match new enum
-- This migration converts Vietnamese category names to enum values

-- Update master_services table
UPDATE master_services
SET
    service_category = 'GROOMING_SPA'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%spa%'
        OR LOWER(service_category) LIKE '%grooming%'
        OR LOWER(service_category) LIKE '%làm đẹp%'
        OR LOWER(service_category) LIKE '%tắm%'
        OR LOWER(service_category) LIKE '%cắt lông%'
    );

UPDATE master_services
SET
    service_category = 'VACCINATION'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%vaccine%'
        OR LOWER(service_category) LIKE '%tiêm%'
        OR LOWER(service_category) LIKE '%phòng%'
    );

UPDATE master_services
SET
    service_category = 'CHECK_UP'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%check%'
        OR LOWER(service_category) LIKE '%khám%'
        OR LOWER(service_category) LIKE '%tổng quát%'
        OR LOWER(service_category) LIKE '%y tế%'
        OR LOWER(service_category) LIKE '%sức khỏe%'
    );

UPDATE master_services
SET
    service_category = 'SURGERY'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%surgery%'
        OR LOWER(service_category) LIKE '%phẫu thuật%'
        OR LOWER(service_category) LIKE '%mổ%'
    );

UPDATE master_services
SET
    service_category = 'DENTAL'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%dental%'
        OR LOWER(service_category) LIKE '%nha%'
        OR LOWER(service_category) LIKE '%răng%'
    );

UPDATE master_services
SET
    service_category = 'DERMATOLOGY'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%derma%'
        OR LOWER(service_category) LIKE '%da liễu%'
        OR LOWER(service_category) LIKE '%da%'
    );

-- Set remaining non-standard values to OTHER
UPDATE master_services
SET
    service_category = 'OTHER'
WHERE
    service_category IS NOT NULL
    AND service_category NOT IN(
        'GROOMING_SPA',
        'VACCINATION',
        'CHECK_UP',
        'SURGERY',
        'DENTAL',
        'DERMATOLOGY',
        'OTHER'
    );

-- Apply same updates to clinic_services table
UPDATE clinic_services
SET
    service_category = 'GROOMING_SPA'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%spa%'
        OR LOWER(service_category) LIKE '%grooming%'
        OR LOWER(service_category) LIKE '%làm đẹp%'
        OR LOWER(service_category) LIKE '%tắm%'
        OR LOWER(service_category) LIKE '%cắt lông%'
    );

UPDATE clinic_services
SET
    service_category = 'VACCINATION'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%vaccine%'
        OR LOWER(service_category) LIKE '%tiêm%'
        OR LOWER(service_category) LIKE '%phòng%'
    );

UPDATE clinic_services
SET
    service_category = 'CHECK_UP'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%check%'
        OR LOWER(service_category) LIKE '%khám%'
        OR LOWER(service_category) LIKE '%tổng quát%'
        OR LOWER(service_category) LIKE '%y tế%'
        OR LOWER(service_category) LIKE '%sức khỏe%'
    );

UPDATE clinic_services
SET
    service_category = 'SURGERY'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%surgery%'
        OR LOWER(service_category) LIKE '%phẫu thuật%'
        OR LOWER(service_category) LIKE '%mổ%'
    );

UPDATE clinic_services
SET
    service_category = 'DENTAL'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%dental%'
        OR LOWER(service_category) LIKE '%nha%'
        OR LOWER(service_category) LIKE '%răng%'
    );

UPDATE clinic_services
SET
    service_category = 'DERMATOLOGY'
WHERE
    service_category IS NOT NULL
    AND (
        LOWER(service_category) LIKE '%derma%'
        OR LOWER(service_category) LIKE '%da liễu%'
        OR LOWER(service_category) LIKE '%da%'
    );

UPDATE clinic_services
SET
    service_category = 'OTHER'
WHERE
    service_category IS NOT NULL
    AND service_category NOT IN(
        'GROOMING_SPA',
        'VACCINATION',
        'CHECK_UP',
        'SURGERY',
        'DENTAL',
        'DERMATOLOGY',
        'OTHER'
    );