-- Schema final de la base de donnees ActivMotiv
-- Fusion de toutes les migrations (0000000000000_database.sql a 0000000000005_create_sensor_table.sql)

CREATE TABLE users (
    id SERIAL PRIMARY KEY NOT NULL,
    uid varchar(8) NOT NULL UNIQUE,
    password varchar(60),
    team INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sam (
    id SERIAL PRIMARY KEY NOT NULL,
    image INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    valence INTEGER,
    arousal INTEGER,
    hidden BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_sam_user_image ON sam (user_id, image);

CREATE TABLE popups (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    image_top INTEGER NOT NULL,
    image_bottom INTEGER NOT NULL,
    measured_at TIMESTAMPTZ,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE questionnaires (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    label varchar(20) NOT NULL,
    completed_at TIMESTAMPTZ,
    data JSONB,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE devices (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,

    android_id varchar(16) NOT NULL UNIQUE,

    brand VARCHAR(50) NOT NULL,
    design_name VARCHAR(100),
    device_type SMALLINT,
    device_year_class INT,

    is_device BOOLEAN,

    manufacturer VARCHAR(100),
    model_name VARCHAR(100),

    os_build_fingerprint VARCHAR(255),
    os_build_id VARCHAR(100),
    os_internal_build_id VARCHAR(100),

    os_name VARCHAR(50),
    os_version VARCHAR(20),
    platform_api_level INT,

    product_name VARCHAR(100),

    supported_cpu_architectures VARCHAR(100),
    total_memory BIGINT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT unique_user_device UNIQUE (user_id, android_id)
);

CREATE TABLE notifications_token (
    id SERIAL PRIMARY KEY NOT NULL,
    device_id INTEGER NOT NULL UNIQUE,
    fcm_token varchar(200) NULL,
    CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY NOT NULL,
    device_id INTEGER NOT NULL,
    template varchar(20) NOT NULL,
    status varchar(10) DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
);

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

CREATE TABLE sensor (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    day DATE NOT NULL,
    updated_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_sensor_user_day UNIQUE (user_id, day)
);

-- adminacc / adminacc
INSERT INTO users (uid, password, team) VALUES ('adminacc', '$2b$12$B3QAODM2r6RRFkTBf17Pv.rgXyvuehNI/6cKPYwPGoCP0eU1BcvpW', 0);