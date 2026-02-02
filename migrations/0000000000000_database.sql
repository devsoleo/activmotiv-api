CREATE TABLE users (
    id SERIAL PRIMARY KEY NOT NULL,
    uid varchar(8) NOT NULL UNIQUE,
    password varchar(60),
    admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sam (
    id SERIAL PRIMARY KEY NOT NULL,
    image INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    valence INTEGER,
    arousal INTEGER,
    hidden BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE popups (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    image_top INTEGER NOT NULL,
    image_bottom INTEGER NOT NULL,
    measured_at TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE questionnaires (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    label varchar(20) NOT NULL,
    completed_at TIMESTAMP,
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

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

ALTER TABLE devices ADD CONSTRAINT unique_user_device UNIQUE (user_id, android_id);

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
    scheduled_at TIMESTAMP,
    CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
);

-- adminacc / adminacc
INSERT INTO users (uid, password, admin) VALUES ('adminacc', '$2b$12$B3QAODM2r6RRFkTBf17Pv.rgXyvuehNI/6cKPYwPGoCP0eU1BcvpW', true);