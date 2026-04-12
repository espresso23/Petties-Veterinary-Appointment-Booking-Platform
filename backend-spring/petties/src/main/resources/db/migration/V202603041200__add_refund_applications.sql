-- Đơn hoàn tiền: Clinic nộp đơn rút tiền sau khấu trừ 5% nền tảng, Admin duyệt.
CREATE TABLE IF NOT EXISTS refund_applications (
    refund_application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    period_year_month VARCHAR(7) NOT NULL,
    month_revenue NUMERIC(19, 2) NOT NULL,
    web_deduction_percent INTEGER NOT NULL DEFAULT 5,
    web_deduction_amount NUMERIC(19, 2) NOT NULL,
    amount_after_deduction NUMERIC(19, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(user_id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_app_clinic ON refund_applications(clinic_id);
CREATE INDEX IF NOT EXISTS idx_refund_app_status ON refund_applications(status);
CREATE INDEX IF NOT EXISTS idx_refund_app_created ON refund_applications(created_at);
