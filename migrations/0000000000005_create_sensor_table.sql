CREATE TABLE IF NOT EXISTS sensor (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    measurement_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sensor_user_date ON sensor (user_id, measurement_date);
