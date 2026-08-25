CREATE TABLE reminders (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    reminder_time TIME NOT NULL,
    label varchar(20) NOT NULL,
    day_of_week varchar(3) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_reminder UNIQUE (user_id, label, day_of_week)
);

CREATE INDEX idx_reminders_trigger ON reminders(day_of_week, reminder_time, label);