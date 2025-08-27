-- Add unique constraint to device_test table
ALTER TABLE device_test ADD CONSTRAINT device_test_imei_unique UNIQUE (imei);
