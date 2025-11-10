CREATE TABLE users (
    id SERIAL PRIMARY KEY NOT NULL,
    uid varchar(8) NOT NULL UNIQUE,
    password varchar(60),
    admin BOOLEAN DEFAULT FALSE,
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE images (
    id SERIAL PRIMARY KEY NOT NULL,
    image INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    valence INTEGER,
    arousal INTEGER,
    hidden BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    title varchar(60) NOT NULL,
    body varchar(100) NOT NULL,
    action_type varchar(10) NOT NULL, -- ex: link
    action_data varchar(10) NOT NULL, -- /path
    action_text varchar(10) NOT NULL, -- /path
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tracking_opening (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    measurement_date TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE questionnaires (
    id SERIAL PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    label varchar(60) NOT NULL,
    validation_date TIMESTAMP,
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- adminacc / adminacc
INSERT INTO users (uid, password, admin) VALUES ('adminacc', '$2b$12$B3QAODM2r6RRFkTBf17Pv.rgXyvuehNI/6cKPYwPGoCP0eU1BcvpW', true);