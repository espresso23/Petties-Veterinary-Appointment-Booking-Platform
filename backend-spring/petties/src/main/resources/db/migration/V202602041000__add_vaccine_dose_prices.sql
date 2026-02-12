-- Bảng giá vắc-xin theo mũi tiêm
-- Mỗi dịch vụ vắc-xin có thể có nhiều mức giá tùy theo số mũi (1, 2, 3, nhắc lại)

CREATE TABLE vaccine_dose_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES clinic_services(service_id) ON DELETE CASCADE,
    dose_number INTEGER NOT NULL,
    dose_label VARCHAR(50),
    price DECIMAL(19,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, dose_number)
);

-- Thêm cột vaccine_template_id vào clinic_services để link với VaccineTemplate
ALTER TABLE clinic_services 
ADD COLUMN IF NOT EXISTS vaccine_template_id UUID REFERENCES vaccine_templates(vaccine_template_id);

-- Index cho performance
CREATE INDEX idx_vaccine_dose_prices_service ON vaccine_dose_prices(service_id);
CREATE INDEX idx_clinic_services_vaccine_template ON clinic_services(vaccine_template_id);

COMMENT ON TABLE vaccine_dose_prices IS 'Giá vắc-xin theo số mũi tiêm. Clinic Owner cấu hình, Staff chọn khi tiêm.';
COMMENT ON COLUMN vaccine_dose_prices.dose_number IS '1, 2, 3 cho series. 4 = annual booster';
