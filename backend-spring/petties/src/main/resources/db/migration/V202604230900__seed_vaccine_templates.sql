-- Seed data for common vaccine templates in Vietnam
-- Run after V202602041000__add_vaccine_dose_prices.sql
-- Idempotent: Only inserts if not exists

-- ============================================
-- VACCINE TEMPLATES FOR DOGS
-- ============================================

-- Vaccine 5 bệnh (FVRPC)
INSERT INTO vaccine_templates (vaccine_template_id, name, manufacturer, description, default_price, min_age_weeks, repeat_interval_days, series_doses, is_annual_repeat, target_species, created_at)
SELECT gen_random_uuid(), 'Vaccine 5 bệnh cho chó (FVRPC)', 'Nobivac / Vanguard / Eurcan',
    'Vaccine phòng 5 bệnh cho chó: Parvovirus, Distemper, Adenovirus (hepatitis), Parainfluenza, Coronavirus. Tiêm từ 6-8 tuần tuổi, nhắc lại hàng năm.',
    350000.00, 6, 365, 3, true, 'DOG', NOW()
WHERE NOT EXISTS (SELECT 1 FROM vaccine_templates WHERE name = 'Vaccine 5 bệnh cho chó (FVRPC)');

-- Vaccine 7 bệnh cho chó
INSERT INTO vaccine_templates (vaccine_template_id, name, manufacturer, description, default_price, min_age_weeks, repeat_interval_days, series_doses, is_annual_repeat, target_species, created_at)
SELECT gen_random_uuid(), 'Vaccine 7 bệnh cho chó', 'Nobivac DHPPi + Leptospirosis',
    'Vaccine phòng 7 bệnh: Parvovirus, Distemper, Adenovirus, Parainfluenza, Leptospirosis (2 loại). Bảo vệ toàn diện hơn vaccine 5 bệnh.',
    450000.00, 6, 365, 3, true, 'DOG', NOW()
WHERE NOT EXISTS (SELECT 1 FROM vaccine_templates WHERE name = 'Vaccine 7 bệnh cho chó');

-- Vaccine dại cho chó
INSERT INTO vaccine_templates (vaccine_template_id, name, manufacturer, description, default_price, min_age_weeks, repeat_interval_days, series_doses, is_annual_repeat, target_species, created_at)
SELECT gen_random_uuid(), 'Vaccine dại cho chó', 'Nobivac Rabies / Rabisin',
    'Vaccine phòng bệnh dại (Rabies). Bắt buộc theo luật thú y. Tiêm từ 12 tuần tuổi trở lên.',
    150000.00, 12, 365, 1, true, 'DOG', NOW()
WHERE NOT EXISTS (SELECT 1 FROM vaccine_templates WHERE name = 'Vaccine dại cho chó');

-- Vaccine kennel cough cho chó
INSERT INTO vaccine_templates (vaccine_template_id, name, manufacturer, description, default_price, min_age_weeks, repeat_interval_days, series_doses, is_annual_repeat, target_species, created_at)
SELECT gen_random_uuid(), 'Vaccine Kennel Cough cho chó', 'Nobivac KC / Bronchishield',
    'Vaccine phòng bệnh đường hô hấp (Kennel Cough): Bordetella bronchiseptica + Parainfluenza. Dùng cho chó có nguy cơ cao tiếp xúc nhiều.',
    250000.00, 8, 365, 2, true, 'DOG', NOW()
WHERE NOT EXISTS (SELECT 1 FROM vaccine_templates WHERE name = 'Vaccine Kennel Cough cho chó');

-- ============================================
-- VACCINE TEMPLATES FOR CATS
-- ============================================

-- Vaccine 4 bệnh cho mèo (FVRCP)
INSERT INTO vaccine_templates (vaccine_template_id, name, manufacturer, description, default_price, min_age_weeks, repeat_interval_days, series_doses, is_annual_repeat, target_species, created_at)
SELECT gen_random_uuid(), 'Vaccine 4 bệnh cho mèo (FVRCP)', 'Nobivac Tricat / Felocell',
    'Vaccine phòng 4 bệnh cho mèo: Feline Parvovirus (Panleukopenia), Feline Calicivirus, Feline Rhinotracheitis (herpesvirus), Feline Chlamydia. Tiêm từ 8 tuần tuổi.',
    350000.00, 8, 365, 3, true, 'CAT', NOW()
WHERE NOT EXISTS (SELECT 1 FROM vaccine_templates WHERE name = 'Vaccine 4 bệnh cho mèo (FVRCP)');

-- Vaccine dại cho mèo
INSERT INTO vaccine_templates (vaccine_template_id, name, manufacturer, description, default_price, min_age_weeks, repeat_interval_days, series_doses, is_annual_repeat, target_species, created_at)
SELECT gen_random_uuid(), 'Vaccine dại cho mèo', 'Nobivac Rabies / Rabisin',
    'Vaccine phòng bệnh dại cho mèo. Tiêm từ 12 tuần tuổi trở lên.',
    150000.00, 12, 365, 1, true, 'CAT', NOW()
WHERE NOT EXISTS (SELECT 1 FROM vaccine_templates WHERE name = 'Vaccine dại cho mèo');

-- Vaccine leukemia (FeLV) cho mèo
INSERT INTO vaccine_templates (vaccine_template_id, name, manufacturer, description, default_price, min_age_weeks, repeat_interval_days, series_doses, is_annual_repeat, target_species, created_at)
SELECT gen_random_uuid(), 'Vaccine Leukemia (FeLV) cho mèo', 'Nobivac FeLV / Purevax FeLV',
    'Vaccine phòng bệnh bạch cầu (Leukemia) cho mèo. Khuyến nghị cho mèo có nguy cơ tiếp xúc bên ngoài.',
    400000.00, 8, 365, 2, true, 'CAT', NOW()
WHERE NOT EXISTS (SELECT 1 FROM vaccine_templates WHERE name = 'Vaccine Leukemia (FeLV) cho mèo');

-- ============================================
-- VERIFY SEED
-- ============================================
SELECT 'Vaccine templates seeded:' AS info, COUNT(*) AS count FROM vaccine_templates;