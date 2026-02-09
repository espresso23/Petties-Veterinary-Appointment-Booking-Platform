CREATE TABLE vaccine_templates (
    vaccine_template_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100),
    description TEXT,
    default_price DECIMAL(19, 2),
    min_age_weeks INT,
    repeat_interval_days INT,
    series_doses INT,
    is_annual_repeat BOOLEAN DEFAULT FALSE,
    target_species VARCHAR(10) DEFAULT 'DOG' NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT pk_vaccine_templates PRIMARY KEY (vaccine_template_id),
    CONSTRAINT chk_target_species CHECK (target_species IN ('DOG', 'CAT', 'BOTH'))
);
