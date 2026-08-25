ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Europe/Paris',
  ALTER COLUMN last_login TYPE TIMESTAMPTZ USING last_login AT TIME ZONE 'Europe/Paris';

ALTER TABLE sam
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'Europe/Paris';

ALTER TABLE popups
  ALTER COLUMN measured_at TYPE TIMESTAMPTZ USING measured_at AT TIME ZONE 'Europe/Paris';

ALTER TABLE questionnaires
  ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'Europe/Paris';

ALTER TABLE devices
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'Europe/Paris';

ALTER TABLE notifications
  ALTER COLUMN scheduled_at TYPE TIMESTAMPTZ USING scheduled_at AT TIME ZONE 'Europe/Paris';
