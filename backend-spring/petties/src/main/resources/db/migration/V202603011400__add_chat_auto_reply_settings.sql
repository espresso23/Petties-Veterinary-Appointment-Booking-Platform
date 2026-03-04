-- Chat auto-reply settings per clinic (quick reply + away message + action buttons)
CREATE TABLE IF NOT EXISTS chat_auto_reply_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    quick_reply_enabled BOOLEAN NOT NULL DEFAULT true,
    quick_reply_message TEXT,
    away_message_enabled BOOLEAN NOT NULL DEFAULT false,
    away_condition VARCHAR(50) NOT NULL DEFAULT 'OFF_HOURS',
    away_message TEXT,
    action_buttons TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_auto_reply_settings_clinic_id ON chat_auto_reply_settings(clinic_id);
