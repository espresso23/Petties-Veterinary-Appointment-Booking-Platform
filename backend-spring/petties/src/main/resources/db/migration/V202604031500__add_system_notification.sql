CREATE TABLE IF NOT EXISTS system_notifications (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    target_audience VARCHAR(50) NOT NULL,
    target_count INTEGER NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT fk_system_notifications_created_by FOREIGN KEY (created_by) REFERENCES users (user_id)
);

CREATE INDEX IF NOT EXISTS idx_system_notifications_created_at ON system_notifications (created_at DESC);
