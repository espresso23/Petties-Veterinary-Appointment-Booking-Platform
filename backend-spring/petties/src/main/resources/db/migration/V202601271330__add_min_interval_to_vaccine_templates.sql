-- Add min_interval_days column to vaccine_templates for safety validation
ALTER TABLE vaccine_templates ADD COLUMN min_interval_days INTEGER DEFAULT 14;

COMMENT ON COLUMN vaccine_templates.min_interval_days IS 'Minimum number of days required between doses for safety';
