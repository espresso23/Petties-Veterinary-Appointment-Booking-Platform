-- Reports: optional image attachment URLs (HTTPS, client uploads via /files then passes URLs) + support WITHDRAWN status
-- Date: 2026-04-01

ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reports.attachment_urls IS 'Array of HTTPS image URLs (e.g. Cloudinary), max 5 enforced in application layer';
